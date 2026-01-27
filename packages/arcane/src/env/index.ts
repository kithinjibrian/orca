import { MacroContext } from "@kithinji/pod";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const envFileCache = new Map<string, string>();
const envVarsCache = new Map<string, Record<string, string>>();

export function env$(key: string, context?: MacroContext): string {
  if (!context) {
    throw new Error("env$ must be called within a macro context");
  }

  const keyNode = key as unknown as ts.Node;
  const resolvedKey = context.resolveNodeValue(keyNode);

  if (typeof resolvedKey !== "string") {
    throw new Error("env$ key must be a string literal");
  }

  const sourceDir = path.dirname(context.sourceFile.fileName);
  let envPath = envFileCache.get(sourceDir);

  if (!envPath) {
    envPath = findEnvFile(sourceDir) ?? undefined;
    if (envPath) {
      envFileCache.set(sourceDir, envPath);
    }
  }

  let envVars: Record<string, string> = {};

  if (envPath) {
    let cached = envVarsCache.get(envPath);
    if (!cached) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      cached = parseEnvFile(envContent);
      envVarsCache.set(envPath, cached);
    }
    envVars = cached;
  }

  let value: string | undefined;

  if (resolvedKey in envVars) {
    value = envVars[resolvedKey];
  } else if (resolvedKey in process.env) {
    value = process.env[resolvedKey];
  }

  if (value === undefined) {
    throw new Error(
      `Environment variable "${resolvedKey}" not found in ${
        envPath ? `${envPath} or ` : ""
      }process.env`,
    );
  }

  return context.factory.createStringLiteral(value) as any;
}

function findEnvFile(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const envPath = path.join(currentDir, ".env");

    if (fs.existsSync(envPath)) {
      return envPath;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (match) {
      const [, key, value] = match;

      let parsedValue = value.trim();
      if (
        (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
        (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
      ) {
        parsedValue = parsedValue.slice(1, -1);
      }

      envVars[key] = parsedValue;
    }
  }

  return envVars;
}
