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
    context.error("env$ key must be a string literal");
  }

  const sourceDir = path.dirname(context.sourceFile.fileName);

  let envPath = envFileCache.get(sourceDir);

  if (!envPath) {
    envPath = findEnvFile(sourceDir) ?? undefined;

    if (!envPath) {
      throw new Error(
        `.env file not found (searched from ${context.sourceFile.fileName})`,
      );
    }

    envFileCache.set(sourceDir, envPath);
  }

  let envVars = envVarsCache.get(envPath);

  if (!envVars) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envVars = parseEnvFile(envContent);
    envVarsCache.set(envPath, envVars);
  }

  if (!(resolvedKey in envVars)) {
    context.error(
      `Environment variable "${resolvedKey}" not found in ${envPath}`,
    );
  }

  return context.factory.createStringLiteral(envVars[resolvedKey]) as any;
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
