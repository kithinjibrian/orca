import * as vm from "node:vm";
import * as esbuild from "esbuild";
import * as path from "node:path";
import Module from "node:module";
import * as fs from "node:fs";

type MacroFunction = Function & { name: string };
type LoadedMacros = Record<string, MacroFunction>;

export class MacroExecutor {
  private cache = new Map<string, LoadedMacros>();

  getMacro(specifier: string, macroName?: string): MacroFunction {
    if (!this.cache.has(specifier)) {
      this.load(specifier);
    }
    const macros = this.cache.get(specifier)!;
    if (macroName) {
      const fn = macros[macroName];
      if (!fn) {
        throw new Error(`Macro "${macroName}" not found in ${specifier}`);
      }
      return fn;
    }
    const names = Object.keys(macros);
    if (names.length === 1) {
      return macros[names[0]];
    }
    if (macros.default) {
      return macros.default;
    }
    throw new Error(`Multiple macros in ${specifier}: ${names.join(", ")}`);
  }

  private load(specifier: string) {
    const requireFromHere = Module.createRequire(
      process.cwd() + "/package.json"
    );
    const entry = requireFromHere.resolve(specifier);

    const { outputFiles } = esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      external: [
        ...Module.builtinModules,
        ...Module.builtinModules.map((m) => `node:${m}`),
      ],
      target: "node18",
      mainFields: ["module", "main"],
      conditions: ["node", "import", "require"],
      packages: "bundle",
      logLevel: "warning",
    });

    const code = outputFiles[0].text;
    const sandboxRequire = Module.createRequire(entry);

    const sandbox: any = {
      // Module system
      module: { exports: {} },
      exports: {},
      require: sandboxRequire,

      console,
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      atob,
      btoa,

      __filename: entry,
      __dirname: path.dirname(entry),

      process: {
        env: process.env,
        cwd: process.cwd,
        version: process.version,
        versions: process.versions,
        platform: process.platform,
        arch: process.arch,
        argv: process.argv,
        execPath: process.execPath,
        pid: process.pid,
      },

      setTimeout,
      setInterval,
      setImmediate,
      clearTimeout,
      clearInterval,
      clearImmediate,

      Promise,

      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      RegExp,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      BigInt,
      Proxy,
      Reflect,
    };

    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox, {
      name: `macro-${path.basename(entry)}`,
      codeGeneration: {
        strings: true,
        wasm: false,
      },
    });

    try {
      const script = new vm.Script(code, {
        filename: entry,
        lineOffset: 0,
        columnOffset: 0,
      });

      script.runInContext(context, {
        breakOnSigint: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to execute macro from ${specifier}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const macros: LoadedMacros = {};
    const exports = sandbox.module.exports;

    if (typeof exports === "function") {
      macros.default = exports;
    } else if (typeof exports === "object" && exports !== null) {
      for (const [name, value] of Object.entries(exports)) {
        if (typeof value === "function" && name.endsWith("$")) {
          macros[name] = value as MacroFunction;
        }
      }

      if (typeof exports.default === "function") {
        macros.default = exports.default;
      }
    }

    if (!Object.keys(macros).length) {
      throw new Error(`No macros found in ${specifier}`);
    }

    this.cache.set(specifier, macros);
  }

  clearCache(specifier?: string) {
    if (specifier) {
      this.cache.delete(specifier);
    } else {
      this.cache.clear();
    }
  }
}

const macroExecutor = new MacroExecutor();

export function macroExecuter(): MacroExecutor {
  return macroExecutor;
}
