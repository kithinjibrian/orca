import fs from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import os from "os";
import { NodeSSH } from "node-ssh";
import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface PodConfig {
  name: string;
  version: string;
  targets: Record<string, TargetConfig>;
}

interface TargetConfig {
  type?: "ssh" | "local";
  host?: string;
  user?: string;
  keyPath?: string;
  port?: number;
  deployPath?: string;
  operations: Operation[];
}

type Operation = EnsureOperation | ActionOperation | VerifyOperation;

interface EnsureOperation {
  name: string;
  type: "ensure";
  ensure: {
    swap?: { size: string };
    docker?: { version: string; addUserToGroup?: boolean };
    directory?: { path: string; owner?: string };
  };
}

interface ActionOperation {
  name: string;
  type: "action";
  when?: "always" | "once" | "never";
  action: {
    rsync?: {
      source: string;
      destination: string;
      exclude?: string[];
    };
    command?: string;
  };
}

interface VerifyOperation {
  name: string;
  type: "verify";
  verify: {
    http?: { url: string; timeout?: string };
    command?: string;
  };
}

interface LockFile {
  deployment_version?: string;
  ensures: Record<string, { version: string; config: any }>;
  once_actions: string[];
}

function interpolate(
  str: string | undefined,
  context: Record<string, any>
): string {
  if (!str) return "";
  return str.replace(/\${([^}]+)}/g, (match, key) => {
    return context[key] !== undefined ? String(context[key]) : match;
  });
}

function deepInterpolate(obj: any, context: Record<string, any>): any {
  if (typeof obj === "string") {
    return interpolate(obj, context);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepInterpolate(item, context));
  }
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepInterpolate(value, context);
    }
    return result;
  }
  return obj;
}

function expandTilde(fp: string): string {
  if (!fp || typeof fp !== "string") return fp;
  return fp.startsWith("~/") ? path.join(os.homedir(), fp.slice(2)) : fp;
}

function resolveLocalPaths(obj: any, cwd: string): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveLocalPaths(item, cwd));
  }
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const isLocalPathKey = key === "keyPath" || key === "source";
      if (isLocalPathKey && typeof value === "string") {
        const expanded = expandTilde(value);
        result[key] = path.isAbsolute(expanded)
          ? expanded
          : path.resolve(cwd, expanded);
      } else {
        result[key] = resolveLocalPaths(value, cwd);
      }
    }
    return result;
  }
  return obj;
}

const SCRIPTS = {
  SWAP: (size: string) => `#!/bin/bash
set -euo pipefail

# Check if swap file exists
if [ -f /swapfile ]; then
  CURRENT_SIZE=$(stat -c%s /swapfile 2>/dev/null || echo "0")
  CURRENT_SIZE_GB=$((CURRENT_SIZE / 1024 / 1024 / 1024))
  REQ_SIZE=$(echo "${size}" | tr -d 'G' | tr -d 'g')
  
  if [ "$CURRENT_SIZE_GB" -ge "$REQ_SIZE" ]; then
    echo "LOG: Swap of sufficient size exists. Skipping."
    exit 0
  fi
  
  # Remove old swap if size doesn't match
  sudo swapoff /swapfile || true
  sudo rm /swapfile
fi

echo "LOG: Creating ${size} swap file..."
sudo fallocate -l ${size} /swapfile || \\
  sudo dd if=/dev/zero of=/swapfile bs=1M count=$(($(echo ${size} | tr -d 'G' | tr -d 'g') * 1024))

sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Add to fstab if not already there
grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "LOG: Swap file configured successfully"
`,

  DOCKER: (version: string, user: string, addToGroup: boolean) => `#!/bin/bash
set -euo pipefail

echo "LOG: Target Docker version: ${version}"

# Check current Docker installation
INSTALLED_VER=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' || echo "none")
echo "LOG: Currently installed: $INSTALLED_VER"

# Determine if we need to install/reinstall
NEEDS_INSTALL=false

if [ "$INSTALLED_VER" = "none" ]; then
  echo "LOG: Docker not installed"
  NEEDS_INSTALL=true
elif [ "${version}" = "latest" ]; then
  echo "LOG: Latest version requested"
  NEEDS_INSTALL=true
elif [[ "$INSTALLED_VER" != *"${version}"* ]]; then
  echo "LOG: Version mismatch detected (need ${version}, have $INSTALLED_VER)"
  echo "LOG: Uninstalling current Docker..."
  
  # Stop Docker services
  sudo systemctl stop docker.socket 2>/dev/null || true
  sudo systemctl stop docker 2>/dev/null || true
  sudo systemctl stop containerd 2>/dev/null || true
  
  # Remove Docker packages (data is preserved)
  sudo apt-get purge -y \\
    docker-ce \\
    docker-ce-cli \\
    containerd.io \\
    docker-buildx-plugin \\
    docker-compose-plugin \\
    docker-ce-rootless-extras \\
    2>/dev/null || true
  
  sudo apt-get purge -y docker docker-engine docker.io runc 2>/dev/null || true
  sudo apt-get autoremove -y
  
  echo "LOG: Uninstall complete"
  NEEDS_INSTALL=true
else
  echo "LOG: Correct version already installed"
fi

if [ "$NEEDS_INSTALL" = true ]; then
  echo "LOG: Installing Docker ${version}..."
  
  # Update and install prerequisites
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  
  # Add Docker GPG key
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
    sudo gpg --dearmor --batch --yes -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  
  # Add Docker repository
  ARCH="$(dpkg --print-architecture)"
  RELEASE="$(lsb_release -cs)"
  echo "deb [arch=\${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \${RELEASE} stable" | \\
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  sudo apt-get update -y
  
  # Install Docker
  if [ "${version}" = "latest" ]; then
    echo "LOG: Installing latest Docker version"
    sudo apt-get install -y \\
      docker-ce \\
      docker-ce-cli \\
      containerd.io \\
      docker-buildx-plugin \\
      docker-compose-plugin
  else
    echo "LOG: Finding version ${version}..."
    VERSION_STRING=$(apt-cache madison docker-ce | grep "${version}" | head -1 | awk '{print $3}')
    
    if [ -z "$VERSION_STRING" ]; then
      echo "LOG: ERROR - Version ${version} not found!"
      echo "LOG: Available versions:"
      apt-cache madison docker-ce | head -10
      exit 1
    fi
    
    echo "LOG: Installing Docker CE version: $VERSION_STRING"
    sudo apt-get install -y \\
      docker-ce=$VERSION_STRING \\
      docker-ce-cli=$VERSION_STRING \\
      containerd.io \\
      docker-buildx-plugin \\
      docker-compose-plugin
  fi
  
  # Enable and start Docker
  sudo systemctl enable docker
  sudo systemctl start docker
  
  FINAL_VER=$(docker --version | awk '{print $3}' | tr -d ',')
  echo "LOG: Docker installed successfully - $FINAL_VER"
fi

# Configure docker group
if [ "${addToGroup}" = "true" ]; then
  if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
    echo "LOG: Created docker group"
  fi
  
  if groups ${user} | grep -q '\\bdocker\\b'; then
    echo "LOG: User ${user} already in docker group"
  else
    sudo usermod -aG docker ${user}
    echo "LOG: Added ${user} to docker group (logout required)"
  fi
fi
`,
};

interface ExecutionStrategy {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  runCommand(
    cmd: string,
    silent?: boolean
  ): Promise<{ stdout: string; stderr: string; code: number | null }>;
  runScript(
    name: string,
    content: string,
    context: Record<string, any>
  ): Promise<void>;

  uploadContent(remotePath: string, content: string): Promise<void>;
  readJson<T>(remotePath: string): Promise<T | null>;

  syncDirectory(
    source: string,
    destination: string,
    exclude?: string[]
  ): Promise<void>;
}

class SSHStrategy implements ExecutionStrategy {
  private ssh: NodeSSH;
  private target: TargetConfig;
  private currentDir: string;

  constructor(target: TargetConfig) {
    this.ssh = new NodeSSH();
    this.target = target;
    this.currentDir = target.deployPath || ".";
  }

  async connect(): Promise<void> {
    await this.ssh.connect({
      host: this.target.host!,
      username: this.target.user!,
      privateKeyPath: this.target.keyPath!,
      port: this.target.port || 22,
    });
  }

  async disconnect(): Promise<void> {
    this.ssh.dispose();
  }

  async runCommand(
    cmd: string,
    silent = false
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const trimmed = cmd.trim();

    if (trimmed.startsWith("cd ")) {
      const newPath = trimmed.replace("cd ", "").trim();
      this.currentDir = path.posix.resolve(this.currentDir, newPath);
      if (!silent) console.log(chalk.gray(` [SSH Path: ${this.currentDir}]`));
      return { stdout: "", stderr: "", code: 0 };
    }

    const result = await this.ssh.execCommand(trimmed, {
      cwd: this.currentDir,
    });

    if (result.code !== 0 && result.code !== null) {
      throw new Error(`Execution failed: ${trimmed}\nSTDERR: ${result.stderr}`);
    }

    if (!silent && result.stdout) {
      result.stdout
        .split("\n")
        .filter((l) => l.startsWith("LOG:"))
        .forEach((l) => console.log(chalk.gray(` ${l.replace("LOG: ", "")}`)));
    }

    return result;
  }

  async runScript(
    name: string,
    content: string,
    context: Record<string, any>
  ): Promise<void> {
    const interpolated = interpolate(content, context);
    const remotePath = `/tmp/pod_script_${name}_${Date.now()}.sh`;

    await this.uploadContent(remotePath, interpolated);

    try {
      await this.ssh.execCommand(`chmod +x ${remotePath}`);
      await this.runCommand(remotePath);
    } finally {
      await this.ssh.execCommand(`rm -f ${remotePath}`);
    }
  }

  async uploadContent(remotePath: string, content: string): Promise<void> {
    const localTmp = path.join(os.tmpdir(), `pod_tmp_${Date.now()}`);
    fs.writeFileSync(localTmp, content);

    try {
      await this.ssh.execCommand(`mkdir -p $(dirname ${remotePath})`);
      await this.ssh.putFile(localTmp, remotePath);
    } finally {
      if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    }
  }

  async readJson<T>(remotePath: string): Promise<T | null> {
    const res = await this.ssh.execCommand(`cat ${remotePath}`);
    try {
      return res.code === 0 ? JSON.parse(res.stdout) : null;
    } catch {
      return null;
    }
  }

  async syncDirectory(
    source: string,
    destination: string,
    exclude?: string[]
  ): Promise<void> {
    const putOptions: any = { recursive: true, concurrency: 10 };

    if (exclude?.length) {
      putOptions.validate = (filePath: string) => {
        const relative = path.relative(source, filePath);
        if (relative === "") return true;

        return !exclude.some((pattern) => {
          if (pattern.endsWith("/")) {
            const dir = pattern.slice(0, -1);
            const segment = "/" + dir + "/";
            return (
              relative === dir ||
              relative.startsWith(dir + "/") ||
              relative.includes(segment)
            );
          }

          if (pattern.startsWith("*.")) {
            return relative.endsWith(pattern.slice(1));
          }

          return relative === pattern;
        });
      };
    }

    console.log(chalk.gray(` Syncing ${source} → ${destination}`));
    await this.ssh.putDirectory(source, destination, putOptions);
  }
}

class LocalStrategy implements ExecutionStrategy {
  private target: TargetConfig;
  private currentDir: string;

  constructor(target: TargetConfig, cwd: string) {
    this.target = target;
    this.currentDir = cwd;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async runCommand(
    cmd: string,
    silent = false
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const trimmed = cmd.trim();

    if (trimmed.startsWith("cd ")) {
      const newPath = trimmed.replace("cd ", "").trim();
      this.currentDir = path.resolve(this.currentDir, newPath);
      if (!silent) console.log(chalk.gray(` [Local Path: ${this.currentDir}]`));
      return { stdout: "", stderr: "", code: 0 };
    }

    try {
      const { stdout, stderr } = await execAsync(trimmed, {
        cwd: this.currentDir,
      });

      if (!silent && stdout) {
        stdout
          .split("\n")
          .filter((l) => l.startsWith("LOG:"))
          .forEach((l) =>
            console.log(chalk.gray(` ${l.replace("LOG: ", "")}`))
          );
      }

      return { stdout, stderr, code: 0 };
    } catch (err: any) {
      throw new Error(
        `Execution failed: ${trimmed}\nSTDERR: ${err.stderr || err.message}`
      );
    }
  }

  async runScript(
    name: string,
    content: string,
    context: Record<string, any>
  ): Promise<void> {
    const interpolated = interpolate(content, context);
    const scriptPath = path.join(
      os.tmpdir(),
      `pod_script_${name}_${Date.now()}.sh`
    );

    fs.writeFileSync(scriptPath, interpolated);
    fs.chmodSync(scriptPath, "755");

    try {
      await this.runCommand(scriptPath);
    } finally {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    }
  }

  async uploadContent(localPath: string, content: string): Promise<void> {
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, content);
  }

  async readJson<T>(localPath: string): Promise<T | null> {
    try {
      if (!fs.existsSync(localPath)) return null;
      const content = fs.readFileSync(localPath, "utf8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async syncDirectory(
    source: string,
    destination: string,
    exclude?: string[]
  ): Promise<void> {
    console.log(chalk.gray(` Copying ${source} → ${destination}`));

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const shouldExclude = (relativePath: string): boolean => {
      if (!exclude?.length) return false;

      return exclude.some((pattern) => {
        if (pattern.endsWith("/")) {
          const dir = pattern.slice(0, -1);
          const segment = "/" + dir + "/";
          return (
            relativePath === dir ||
            relativePath.startsWith(dir + "/") ||
            relativePath.includes(segment)
          );
        }

        if (pattern.startsWith("*.")) {
          return relativePath.endsWith(pattern.slice(1));
        }

        return relativePath === pattern;
      });
    };

    const copyRecursive = (src: string, dest: string) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relativePath = path.relative(source, srcPath);

        if (shouldExclude(relativePath)) continue;

        if (entry.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(source, destination);
  }
}

class StrategyFactory {
  static create(target: TargetConfig, cwd: string): ExecutionStrategy {
    const targetType = target.type || (target.host ? "ssh" : "local");

    switch (targetType) {
      case "ssh":
        return new SSHStrategy(target);
      case "local":
        return new LocalStrategy(target, cwd);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  }
}

class OperationHandler {
  constructor(
    private strategy: ExecutionStrategy,
    private target: TargetConfig,
    private lock: LockFile,
    private lockPath: string
  ) {}

  async handleEnsure(
    op: EnsureOperation,
    options?: { forceEnsure?: boolean }
  ): Promise<void> {
    if (!op.ensure) {
      throw new Error(`Ensure operation "${op.name}" missing ensure config`);
    }

    if (op.ensure.swap) {
      await this.ensureSwap(op, options);
    }

    if (op.ensure.docker) {
      await this.ensureDocker(op, options);
    }

    if (op.ensure.directory) {
      await this.ensureDirectory(op, options);
    }
  }

  private async ensureSwap(
    op: EnsureOperation,
    options?: { forceEnsure?: boolean }
  ): Promise<void> {
    const key = "swap";
    const locked = this.lock.ensures[key];
    const currentConfig = op.ensure.swap!;
    const configChanged =
      JSON.stringify(locked?.config) !== JSON.stringify(currentConfig);

    if (
      options?.forceEnsure ||
      !locked ||
      locked.version !== currentConfig.size ||
      configChanged
    ) {
      console.log(chalk.yellow(`→ Ensuring: ${op.name}`));
      const script = SCRIPTS.SWAP(currentConfig.size);
      await this.strategy.runScript(key, script, this.target);
      this.lock.ensures[key] = {
        version: currentConfig.size,
        config: currentConfig,
      };
      await this.saveLock();
    } else {
      console.log(chalk.gray(`✓ ${op.name} (already satisfied)`));
    }
  }

  private async ensureDocker(
    op: EnsureOperation,
    options?: { forceEnsure?: boolean }
  ): Promise<void> {
    const key = "docker";
    const locked = this.lock.ensures[key];
    const currentConfig = op.ensure.docker!;
    const configChanged =
      JSON.stringify(locked?.config) !== JSON.stringify(currentConfig);

    if (
      options?.forceEnsure ||
      !locked ||
      locked.version !== currentConfig.version ||
      configChanged
    ) {
      console.log(chalk.yellow(`→ Ensuring: ${op.name}`));
      const script = SCRIPTS.DOCKER(
        currentConfig.version,
        this.target.user || os.userInfo().username,
        !!currentConfig.addUserToGroup
      );
      await this.strategy.runScript(key, script, this.target);
      this.lock.ensures[key] = {
        version: currentConfig.version,
        config: currentConfig,
      };
      await this.saveLock();
    } else {
      console.log(chalk.gray(`✓ ${op.name} (already satisfied)`));
    }
  }

  private async ensureDirectory(
    op: EnsureOperation,
    options?: { forceEnsure?: boolean }
  ): Promise<void> {
    const key = `directory_${op.ensure.directory!.path}`;
    const locked = this.lock.ensures[key];
    const currentConfig = op.ensure.directory!;
    const configChanged =
      JSON.stringify(locked?.config) !== JSON.stringify(currentConfig);

    if (options?.forceEnsure || !locked || configChanged) {
      console.log(chalk.yellow(`→ Ensuring: ${op.name}`));
      const dirPath = interpolate(currentConfig.path, this.target);
      const owner = currentConfig.owner
        ? interpolate(currentConfig.owner, this.target)
        : this.target.user || os.userInfo().username;

      await this.strategy.runCommand(`mkdir -p ${dirPath}`, true);

      if (this.target.user) {
        await this.strategy.runCommand(
          `sudo chown -R ${owner}:${owner} ${dirPath}`,
          true
        );
      }

      this.lock.ensures[key] = {
        version: dirPath,
        config: currentConfig,
      };
      await this.saveLock();
    } else {
      console.log(chalk.gray(`✓ ${op.name} (already satisfied)`));
    }
  }

  async handleAction(op: ActionOperation): Promise<void> {
    if (!op.action) {
      throw new Error(`Action operation "${op.name}" missing action config`);
    }

    const when = op.when || "always";

    if (when === "never") {
      console.log(chalk.gray(`⊘ ${op.name} (disabled)`));
      return;
    }

    const actionId = `action_${op.name}`;

    if (when === "once" && this.lock.once_actions.includes(actionId)) {
      console.log(chalk.gray(`✓ ${op.name} (already completed)`));
      return;
    }

    console.log(chalk.cyan(`→ Running: ${op.name}`));

    if (op.action.rsync) {
      const src = op.action.rsync.source;
      const dest = interpolate(op.action.rsync.destination || ".", this.target);
      await this.strategy.syncDirectory(src, dest, op.action.rsync.exclude);
    }

    if (op.action.command) {
      const cmd = interpolate(op.action.command, this.target);
      await this.strategy.runCommand(cmd);
    }

    if (when === "once") {
      this.lock.once_actions.push(actionId);
      await this.saveLock();
    }
  }

  async handleVerify(op: VerifyOperation): Promise<void> {
    if (!op.verify) {
      throw new Error(`Verify operation "${op.name}" missing verify config`);
    }

    console.log(chalk.cyan(`→ Verifying: ${op.name}`));

    if (op.verify.http) {
      const url = interpolate(op.verify.http.url, this.target);
      const timeout = op.verify.http.timeout || "30s";
      await this.strategy.runCommand(
        `curl -f --max-time ${timeout} ${url}`,
        true
      );
    }

    if (op.verify.command) {
      const cmd = interpolate(op.verify.command, this.target);
      await this.strategy.runCommand(cmd, true);
    }
  }

  private async saveLock(): Promise<void> {
    await this.strategy.uploadContent(
      this.lockPath,
      JSON.stringify(this.lock, null, 2)
    );
  }
}

export async function deploy(
  targetName: string,
  options?: { forceEnsure?: boolean }
) {
  const cwd = process.cwd();
  const rawConfig = yaml.load(
    fs.readFileSync(path.join(cwd, "pod.deploy.yml"), "utf8"),
    { schema: yaml.DEFAULT_SCHEMA }
  ) as any;

  const rawTarget = rawConfig.targets?.[targetName];
  if (!rawTarget) throw new Error(`Target ${targetName} not found.`);

  console.log(
    chalk.blue.bold(
      `\nPod Deploy: ${rawConfig.name} v${rawConfig.version} → ${targetName}\n`
    )
  );

  let target = deepInterpolate(rawTarget, {
    ...rawConfig,
    ...rawTarget,
  }) as TargetConfig;

  target = resolveLocalPaths(target, cwd);

  const strategy = StrategyFactory.create(target, cwd);

  try {
    await strategy.connect();

    const lockPath = target.deployPath
      ? path.posix.join(target.deployPath, "pod-lock.json")
      : path.join(cwd, "pod-lock.json");

    let lock = (await strategy.readJson<LockFile>(lockPath)) || {
      ensures: {},
      once_actions: [],
    };

    if (lock.deployment_version !== rawConfig.version) {
      console.log(chalk.magenta(`→ Version change: ${rawConfig.version}`));
      lock.deployment_version = rawConfig.version;
      lock.once_actions = [];
      await strategy.uploadContent(lockPath, JSON.stringify(lock, null, 2));
    }

    const handler = new OperationHandler(strategy, target, lock, lockPath);

    for (const op of target.operations) {
      try {
        if (op.type === "ensure") {
          await handler.handleEnsure(op, options);
        } else if (op.type === "action") {
          await handler.handleAction(op);
        } else if (op.type === "verify") {
          await handler.handleVerify(op);
        } else {
          throw new Error(`Unknown operation type: ${(op as any).type}`);
        }
      } catch (err: any) {
        throw new Error(`Failed at operation "${op.name}": ${err.message}`);
      }
    }

    console.log(chalk.green.bold(`\nDeployment successful!\n`));
  } catch (err: any) {
    console.error(chalk.red.bold(`\nDeployment Failed: ${err.message}`));
    throw err;
  } finally {
    await strategy.disconnect();
  }
}
