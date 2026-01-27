import { MacroContext } from "@kithinji/pod";
import * as fs from "fs";
import * as path from "path";

const packageJsonCache = new Map<string, string>();
const versionCache = new Map<string, string>();

export function version$(context?: MacroContext): string {
  if (!context) {
    throw new Error("version$ must be called within a macro context");
  }

  const sourceDir = path.dirname(context.sourceFile.fileName);

  let packageJsonPath = packageJsonCache.get(sourceDir);

  if (!packageJsonPath) {
    packageJsonPath = findPackageJson(sourceDir) ?? undefined;

    if (!packageJsonPath) {
      throw new Error(
        `package.json not found (searched from ${context.sourceFile.fileName})`,
      );
    }

    packageJsonCache.set(sourceDir, packageJsonPath);
  }

  let version = versionCache.get(packageJsonPath);

  if (!version) {
    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      if (!packageJson.version || typeof packageJson.version !== "string") {
        throw new Error(`No "version" field found in ${packageJsonPath}`);
      }

      version = packageJson.version;
      versionCache.set(packageJsonPath, version!);
    } catch (error) {
      throw new Error(
        `Failed to read or parse ${packageJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return context.factory.createStringLiteral(version!) as any;
}

function findPackageJson(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}
