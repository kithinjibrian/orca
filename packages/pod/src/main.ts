#!/usr/bin/env node
import { Command } from "commander";
import { startDevServer } from "./dev";

import * as store from "./store";
export { store };

import * as config from "./config";
export { config };

export * from "./config/config";

import * as macros from "./macros";
export { macros };

export * from "./macros/expand_macros";

import * as plugins from "./plugins";
export { plugins };
export * from "./plugins/css";

import { addComponent, addNew, addTs } from "./add";
import { addFeature } from "./add/module";

import path from "path";
import { exec, execSync } from "child_process";
import { dockerize } from "./docker";
import { deploy } from "./deploy";
import chalk from "chalk";

const program = new Command();

program.name("pod").description("Pod cli tool").version("1.0.30");

program
  .command("new <name> [type]")
  .description("Start a new Orca Project")
  .action(async (name: string, type?: string) => {
    const orca = async () => {
      await addNew(name);

      const appDir = path.resolve(process.cwd());

      const shell =
        process.platform === "win32"
          ? process.env.ComSpec || "cmd.exe"
          : "/bin/sh";

      console.log("Installing dependencies...");
      execSync("npm install", { stdio: "inherit", cwd: appDir, shell });

      console.log("Starting development server...");
      execSync("npm run dev", { stdio: "inherit", cwd: appDir, shell });

      console.log(
        `All done! Your app "${name}" is running in development mode.`
      );
    };

    const ts = async () => {
      await addTs(name);

      const appDir = path.resolve(process.cwd());

      const shell =
        process.platform === "win32"
          ? process.env.ComSpec || "cmd.exe"
          : "/bin/sh";

      console.log("Installing dependencies...");
      execSync("npm install", { stdio: "inherit", cwd: appDir, shell });
    };

    switch (type) {
      case "orca":
        return await orca();
      case "ts":
        return await ts();
      default:
        return await orca();
    }
  });

program
  .command("dev")
  .description("Start Pod development server")
  .action(async (opts) => {
    await startDevServer();
  });

program
  .command("add <type> <name>")
  .description("Add a component (c) or a feature (f)")
  .action(async (type, name) => {
    try {
      if (type === "c") {
        await addComponent(name);
      } else if (type === "f") {
        // create a module (service, component, module)
        await addFeature(name);
      } else {
        console.error("❌ Unknown type. Use 'c' or 'f'.");
      }
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("dockerize <env>")
  .description("Dockerize a pod project.")
  .action(async (env) => {
    try {
      await dockerize(env);
    } catch (err: any) {
      console.error("❌ Error:", err.message);
    }
  });

program
  .command("deploy")
  .description("Deploy to a target environment")
  .argument("<target>", "Target environment (e.g., ec2)")
  .option("--force-install", "Force reinstallation even if already installed")
  .action(async (target: string, options: { forceEnsure?: boolean }) => {
    try {
      await deploy(target, options);
    } catch (error: any) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);
