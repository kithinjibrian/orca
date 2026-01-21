import * as esbuild from "esbuild";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { WebSocketServer, WebSocket } from "ws";
import * as path from "path";
import { loadConfig, mergeConfig, getDefaultConfig } from "../config/config";
import { buildGraph, useMyPlugin } from "@/plugins";
import { Store } from "@/store";
import {
  HtmlPreprocessor,
  HtmlPreprocessorOptions,
  createHotReloadTransformer,
} from "../html";

interface VirtualFile {
  output: string;
  code: string;
}

interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const createLogger = (debugMode: boolean = false): Logger => ({
  info: (...args) => console.log("[INFO]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  debug: (...args) => debugMode && console.log("[DEBUG]", ...args),
});

const virtualClientFiles: Record<string, VirtualFile> = {
  "virtual:navigate": {
    output: "navigate",
    code: `
export async function navigate(event, url) {
  event.preventDefault();  
  
  try {
    const { Navigate, getCurrentInjector } = await import("/src/client/client.js");
    const injector = getCurrentInjector();
    
    if (injector) {
      const navigate = injector.resolve(Navigate);
      navigate.go(url);
    } else {
      window.location.href = url;
    }
  } catch (error) {
    console.error("Navigation error:", error);
    window.location.href = url;
  }
}
    `.trim(),
  },
};

function createVirtualModulePlugin(
  virtualFiles: Record<string, VirtualFile>,
): esbuild.Plugin {
  return {
    name: "virtual-module",
    setup(build) {
      build.onResolve({ filter: /^virtual:/ }, (args) => {
        if (virtualFiles[args.path]) {
          return {
            path: args.path,
            namespace: "virtual",
          };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
        const virtualFile = virtualFiles[args.path];

        if (virtualFile) {
          return {
            contents: virtualFile.code,
            loader: "js",
          };
        }
      });
    },
  };
}

class HotReloadManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number;
  private logger: Logger;

  constructor(port: number = 3001, logger: Logger) {
    this.port = port;
    this.logger = logger;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      this.logger.debug(
        `Client connected. Total clients: ${this.clients.size}`,
      );

      ws.on("close", () => {
        this.clients.delete(ws);
        this.logger.debug(
          `Client disconnected. Total clients: ${this.clients.size}`,
        );
      });

      ws.on("error", (error) => {
        this.logger.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    this.logger.info(
      `Hot reload server listening on ws://localhost:${this.port}`,
    );
  }

  reload(): void {
    const activeClients = Array.from(this.clients).filter(
      (client) => client.readyState === WebSocket.OPEN,
    );

    if (activeClients.length === 0) {
      this.logger.debug("No active clients to reload");
      return;
    }

    this.logger.debug(
      `Sending reload signal to ${activeClients.length} client(s)`,
    );

    activeClients.forEach((client) => {
      try {
        client.send("reload");
      } catch (error) {
        this.logger.error("Failed to send reload signal:", error);
        this.clients.delete(client);
      }
    });
  }

  close(): void {
    if (this.wss) {
      this.clients.forEach((client) => client.close());
      this.wss.close();
      this.logger.debug("Hot reload server closed");
    }
  }
}

async function copyAndProcessHtml(
  hotReloadPort: number | null,
  preprocessorOptions?: HtmlPreprocessorOptions,
  logger?: Logger,
): Promise<void> {
  try {
    await fs.mkdir("public", { recursive: true });

    const transformers = hotReloadPort
      ? [createHotReloadTransformer(hotReloadPort)]
      : [];

    const preprocessor = new HtmlPreprocessor({
      transformers,
      injectScripts: ["./navigate.js"],
      ...preprocessorOptions,
    });

    await preprocessor.processFile(
      "./src/client/index.html",
      "./public/index.html",
    );

    logger?.debug("HTML processed successfully");
  } catch (error) {
    logger?.error("Failed to copy and process index.html:", error);
    throw error;
  }
}

async function cleanDirectories(logger?: Logger): Promise<void> {
  logger?.debug("Cleaning build directories...");
  await Promise.all([
    fs.rm("dist", { recursive: true, force: true }),
    fs.rm("public", { recursive: true, force: true }),
  ]);
}

function waitForProcessExit(
  process: ChildProcess,
  timeout: number = 5000,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      process.kill("SIGKILL");
      resolve();
    }, timeout);

    process.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    process.kill("SIGTERM");
  });
}

function createRestartServerPlugin(
  serverProcess: { current: ChildProcess | null },
  onServerReady: () => void,
  hotReloadManager: HotReloadManager | null,
  logger: Logger,
): esbuild.Plugin {
  return {
    name: "restart-server",
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          logger.error(
            `Server build failed with ${result.errors.length} error(s)`,
          );
          return;
        }

        logger.info("Server build completed");

        if (serverProcess.current) {
          logger.debug("Stopping existing server process...");
          await waitForProcessExit(serverProcess.current);
        }

        serverProcess.current = spawn("node", ["dist/main.js"], {
          stdio: "inherit",
        });

        serverProcess.current.on("error", (err) => {
          logger.error("Server process error:", err);
        });

        serverProcess.current.on("exit", (code) => {
          if (code !== null && code !== 0) {
            logger.warn(`Server process exited with code ${code}`);
          }
        });

        setTimeout(() => {
          onServerReady();
          if (hotReloadManager) {
            hotReloadManager.reload();
          }
        }, 500);
      });
    },
  };
}

async function buildVirtualFiles(config: any, logger: Logger): Promise<void> {
  logger.debug("Building virtual files...");

  const virtualEntryPoints: Record<string, string> = {};
  Object.entries(virtualClientFiles).forEach(([key, value]) => {
    virtualEntryPoints[value.output] = key;
  });

  await esbuild.build({
    entryPoints: virtualEntryPoints,
    bundle: true,
    outdir: "public",
    platform: "browser",
    format: "iife",
    globalName: "Orca",
    sourcemap: config.build?.sourcemap ?? true,
    minify: config.build?.minify ?? false,
    plugins: [createVirtualModulePlugin(virtualClientFiles)],
    write: true,
  });

  logger.debug("Virtual files built successfully");
}

async function buildClient(
  clientFiles: Set<string>,
  config: any,
  store: any,
  isWatch: boolean = false,
  onBuildComplete?: () => void,
  logger?: Logger,
): Promise<esbuild.BuildContext | null> {
  if (clientFiles.size === 0) {
    logger?.debug("No client files to build");
    return null;
  }

  logger?.debug(`Building ${clientFiles.size} client file(s)...`);

  const entryPoints = Array.from(clientFiles);
  const graph = buildGraph(entryPoints);

  const buildOptions: esbuild.BuildOptions = {
    entryPoints,
    bundle: true,
    outdir: "public",
    outbase: ".",
    platform: "browser",
    format: "esm",
    sourcemap: config.build?.sourcemap ?? true,
    splitting: true,
    minify: config.build?.minify ?? false,
    plugins: [
      ...(config.plugins?.map((cb: any) => cb(store)) || []),
      ...(config.client_plugins?.map((cb: any) => cb(store)) || []),
      useMyPlugin({
        graph,
        isServerBuild: false,
        onClientFound: () => {},
      }),
      {
        name: "client-build-logger",
        setup(build: any) {
          build.onEnd((result: any) => {
            if (result.errors.length > 0) {
              logger?.error(
                `Client build failed with ${result.errors.length} error(s)`,
              );
            } else {
              logger?.info("Client build completed");
              onBuildComplete?.();
            }
          });
        },
      },
    ],
    write: true,
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    return ctx;
  } else {
    await esbuild.build(buildOptions);
    return null;
  }
}

async function checkClientFilesExist(): Promise<boolean> {
  try {
    await Promise.all([
      fs.access("src/client/client.tsx"),
      fs.access("src/client/index.html"),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function startDevServer(): Promise<void> {
  const logger = createLogger(process.env.DEBUG === "true");
  const store = Store.getInstance();
  const userConfig = await loadConfig();
  const config = mergeConfig(getDefaultConfig(), userConfig);

  const HOT_RELOAD_PORT = 3001;
  const hasClientFiles = await checkClientFilesExist();

  if (!hasClientFiles) {
    logger.warn(
      "Client files not found (src/client/client.tsx or src/client/index.html missing). Skipping client build.",
    );
  }

  const hotReloadManager = hasClientFiles
    ? new HotReloadManager(HOT_RELOAD_PORT, logger)
    : null;

  await cleanDirectories(logger);

  if (hasClientFiles) {
    await copyAndProcessHtml(HOT_RELOAD_PORT, config.htmlPreprocessor, logger);
    hotReloadManager!.start();
  }

  const entryPoints = ["src/main.ts"];
  const clientFiles = hasClientFiles
    ? new Set<string>(["src/client/client.tsx"])
    : new Set<string>();
  const serverProcessRef = { current: null as ChildProcess | null };
  let clientCtx: esbuild.BuildContext | null = null;
  let isShuttingDown = false;

  let pendingClientFiles = new Set<string>();
  let rebuildTimer: NodeJS.Timeout | null = null;

  async function rebuildClient(): Promise<void> {
    if (isShuttingDown || !hasClientFiles) return;

    try {
      logger.debug("Scheduling client rebuild...");

      if (clientCtx) {
        await clientCtx.dispose();
        clientCtx = null;
      }

      // Add pending files to the main set
      pendingClientFiles.forEach((file) => clientFiles.add(file));
      pendingClientFiles.clear();

      clientCtx = await buildClient(
        clientFiles,
        config,
        store,
        true,
        () => hotReloadManager?.reload(),
        logger,
      );
    } catch (error) {
      logger.error("Failed to rebuild client:", error);
    }
  }

  function scheduleClientRebuild(): void {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }
    rebuildTimer = setTimeout(() => {
      rebuildClient();
    }, 100);
  }

  async function onServerReady(): Promise<void> {
    if (pendingClientFiles.size > 0) {
      scheduleClientRebuild();
    }
  }

  const serverCtx = await esbuild.context({
    entryPoints,
    bundle: true,
    outdir: config.build?.outDir || "dist",
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: config.build?.sourcemap ?? true,
    minify: config.build?.minify ?? false,
    plugins: [
      ...(config.plugins?.map((cb: any) => cb(store)) || []),
      ...(config.server_plugins?.map((cb: any) => cb(store)) || []),
      useMyPlugin({
        isServerBuild: true,
        onClientFound: async (filePath: string) => {
          const isNewFile = !clientFiles.has(filePath);

          if (isNewFile) {
            logger.debug(`New client file discovered: ${filePath}`);
            pendingClientFiles.add(filePath);
          }
        },
      }),
      createRestartServerPlugin(
        serverProcessRef,
        onServerReady,
        hotReloadManager,
        logger,
      ),
    ],
    write: true,
  });

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info("Shutting down dev server...");

    try {
      if (serverProcessRef.current) {
        logger.debug("Stopping server process...");
        await waitForProcessExit(serverProcessRef.current);
      }

      await serverCtx.dispose();
      if (clientCtx) await clientCtx.dispose();
      if (hotReloadManager) hotReloadManager.close();

      logger.info("Dev server shut down successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Starting dev server...");

  if (hasClientFiles) {
    await buildVirtualFiles(config, logger);
  }

  await serverCtx.watch();
}

export async function startBuild(): Promise<void> {
  const logger = createLogger(false);
  const store = Store.getInstance();

  logger.info("Starting production build...");

  try {
    const userConfig = await loadConfig();
    const config = mergeConfig(getDefaultConfig(), userConfig);

    const hasClientFiles = await checkClientFilesExist();

    if (!hasClientFiles) {
      logger.warn(
        "Client files not found (src/client/client.tsx or src/client/index.html missing). Skipping client build.",
      );
    }

    await cleanDirectories(logger);

    if (hasClientFiles) {
      await copyAndProcessHtml(null, config.htmlPreprocessor, logger);
      await buildVirtualFiles(config, logger);
    }

    const clientFiles = hasClientFiles
      ? new Set<string>(["src/client/client.tsx"])
      : new Set<string>();
    const entryPoints = ["src/main.ts"];

    logger.info("Building server...");
    await esbuild.build({
      entryPoints,
      bundle: true,
      outdir: config.build?.outDir || "dist",
      platform: "node",
      format: "esm",
      packages: "external",
      sourcemap: config.build?.sourcemap ?? false,
      minify: config.build?.minify ?? true,
      plugins: [
        ...(config.plugins?.map((cb: any) => cb(store)) || []),
        ...(config.server_plugins?.map((cb: any) => cb(store)) || []),
        useMyPlugin({
          isServerBuild: true,
          onClientFound: async (filePath: string) => {
            if (hasClientFiles) {
              clientFiles.add(filePath);
            }
          },
        }),
        {
          name: "build-complete-logger",
          setup(build: any) {
            build.onEnd((result: any) => {
              if (result.errors.length > 0) {
                logger.error(
                  `Server build failed with ${result.errors.length} error(s)`,
                );
              } else {
                logger.info("Server build completed");
              }
            });
          },
        },
      ],
      write: true,
    });

    if (hasClientFiles && clientFiles.size > 0) {
      logger.info(`Building ${clientFiles.size} client file(s)...`);
      await buildClient(clientFiles, config, store, false, undefined, logger);
    }

    logger.info("Production build completed successfully!");
    logger.info(`Output: dist/${hasClientFiles ? " and public/" : ""}`);
  } catch (error) {
    logger.error("Build failed:", error);
    process.exit(1);
  }
}
