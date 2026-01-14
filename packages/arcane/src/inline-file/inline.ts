import { MacroContext } from "@kithinji/pod";
import ts from "typescript";
import fs from "fs";
import path from "path";

export function inlineFile$(filePath: string, context?: MacroContext): string {
  if (!context) {
    throw new Error(
      "inlineFile$ macro requires MacroContext. Ensure you're using this as a build-time macro."
    );
  }

  const pathNode = filePath as unknown as ts.Node;
  const resolvedPath = context.resolveNodeValue(pathNode);

  if (typeof resolvedPath !== "string") {
    throw new Error(
      `inlineFile$ macro requires a string literal path, got: ${typeof resolvedPath}`
    );
  }

  const sourceFile = context.sourceFile;
  const sourceDir = path.dirname(sourceFile.fileName);
  const absolutePath = path.resolve(sourceDir, resolvedPath);

  let content: string;
  try {
    content = fs.readFileSync(absolutePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read file "${absolutePath}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return context.factory.createStringLiteral(content) as any;
}

export function inlineFiles$(
  filePaths: string[],
  context?: MacroContext
): string[] {
  if (!context) {
    throw new Error(
      "inlineFiles$ macro requires MacroContext. Ensure you're using this as a build-time macro."
    );
  }

  const pathsNode = filePaths as unknown as ts.Node;
  const resolvedPaths = context.resolveNodeValue(pathsNode);

  if (!Array.isArray(resolvedPaths)) {
    throw new Error(
      `inlineFiles$ macro requires an array of string literals, got: ${typeof resolvedPaths}`
    );
  }

  const sourceFile = context.sourceFile;
  const sourceDir = path.dirname(sourceFile.fileName);

  const fileContents: string[] = [];

  for (const filePath of resolvedPaths) {
    if (typeof filePath !== "string") {
      throw new Error(
        `inlineFiles$ macro requires all paths to be string literals, got: ${typeof filePath}`
      );
    }

    const absolutePath = path.resolve(sourceDir, filePath);

    try {
      const content = fs.readFileSync(absolutePath, "utf-8");
      fileContents.push(content);
    } catch (error) {
      throw new Error(
        `Failed to read file "${absolutePath}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const elements = fileContents.map((content) =>
    context.factory.createStringLiteral(content)
  );

  return context.factory.createArrayLiteralExpression(elements, true) as any;
}
