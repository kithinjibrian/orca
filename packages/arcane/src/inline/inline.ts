import { MacroContext } from "@kithinji/pod";
import ts from "typescript";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",

  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",

  ".pdf": "application/pdf",
  ".zip": "application/zip",

  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function validateContext(
  context?: MacroContext,
  macroName?: string,
): asserts context is MacroContext {
  if (!context) {
    throw new Error(
      `${macroName || "Macro"} requires MacroContext. Ensure you're using this as a build-time macro.`,
    );
  }
}

function resolveFilePath(
  filePath: string,
  context: MacroContext,
  macroName: string,
): string {
  const pathNode = filePath as unknown as ts.Node;
  const resolvedPath = context.resolveNodeValue(pathNode);

  if (typeof resolvedPath !== "string") {
    throw new Error(
      `${macroName} requires a string literal path, got: ${typeof resolvedPath}`,
    );
  }

  const sourceFile = context.sourceFile;
  const sourceDir = path.dirname(sourceFile.fileName);
  const absolutePath = path.resolve(sourceDir, resolvedPath);

  return absolutePath;
}

export interface InlineFileOptions {
  maxSize?: number;
}

export interface InlineDataURLOptions {
  maxSize?: number;
  mimeType?: string;
}

export interface InlineBase64Options {
  maxSize?: number;
}

/**
 * Inline a text file as a UTF-8 string literal at build time
 * @param filePath - Relative path to the file
 * @param options - Optional configuration
 * @returns String literal containing file contents
 */
export function inlineFile$(filePath: string, context?: MacroContext): string {
  validateContext(context, "inlineFile$");

  const absolutePath = resolveFilePath(filePath, context, "inlineFile$");

  let content: string;
  try {
    content = fs.readFileSync(absolutePath, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `File not found: "${absolutePath}" (referenced in ${context.sourceFile.fileName})`,
      );
    }
    throw new Error(
      `Failed to read file "${absolutePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return context.factory.createStringLiteral(content) as any;
}

/**
 * Inline multiple text files as an array of UTF-8 string literals at build time
 * @param filePaths - Array of relative paths to files
 * @param options - Optional configuration
 * @returns Array literal containing file contents
 */
export function inlineFiles$(
  filePaths: string[],
  context?: MacroContext,
): string[] {
  validateContext(context, "inlineFiles$");

  const pathsNode = filePaths as unknown as ts.Node;
  const resolvedPaths = context.resolveNodeValue(pathsNode);

  if (!Array.isArray(resolvedPaths)) {
    throw new Error(
      `inlineFiles$ requires an array of string literals, got: ${typeof resolvedPaths}`,
    );
  }

  const sourceFile = context.sourceFile;
  const sourceDir = path.dirname(sourceFile.fileName);

  const fileContents: string[] = [];

  for (const filePath of resolvedPaths) {
    if (typeof filePath !== "string") {
      throw new Error(
        `inlineFiles$ requires all paths to be string literals, got: ${typeof filePath}`,
      );
    }

    const absolutePath = path.resolve(sourceDir, filePath);

    try {
      const content = fs.readFileSync(absolutePath, "utf-8");
      fileContents.push(content);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(
          `File not found: "${absolutePath}" (referenced in ${sourceFile.fileName})`,
        );
      }
      throw new Error(
        `Failed to read file "${absolutePath}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const elements = fileContents.map((content) =>
    context.factory.createStringLiteral(content),
  );

  return context.factory.createArrayLiteralExpression(elements, true) as any;
}

/**
 * Inline a binary file as a base64 string literal at build time
 * @param filePath - Relative path to the file
 * @param options - Optional configuration
 * @returns String literal containing base64-encoded file contents
 */
export function inlineFileBase64$(
  filePath: string,
  context?: MacroContext,
): string {
  validateContext(context, "inlineFileBase64$");

  const absolutePath = resolveFilePath(filePath, context, "inlineFileBase64$");

  let content: string;
  try {
    const buffer = fs.readFileSync(absolutePath);
    content = buffer.toString("base64");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `File not found: "${absolutePath}" (referenced in ${context.sourceFile.fileName})`,
      );
    }
    throw new Error(
      `Failed to read file "${absolutePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return context.factory.createStringLiteral(content) as any;
}

/**
 * Inline a file as a Data URL (data:mime/type;base64,...) at build time
 * Useful for embedding images, fonts, and other assets directly in code
 * @param filePath - Relative path to the file
 * @param options - Optional configuration
 * @returns String literal containing Data URL
 */
export function inlineDataURL$(
  filePath: string,
  context?: MacroContext,
): string {
  validateContext(context, "inlineDataURL$");

  const absolutePath = resolveFilePath(filePath, context, "inlineDataURL$");

  let dataURL: string;
  try {
    const mimeType = getMimeType(absolutePath);
    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString("base64");

    dataURL = `data:${mimeType};base64,${base64}`;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `File not found: "${absolutePath}" (referenced in ${context.sourceFile.fileName})`,
      );
    }
    throw new Error(
      `Failed to read file "${absolutePath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return context.factory.createStringLiteral(dataURL) as any;
}

/**
 * Inline multiple files as Data URLs at build time
 * @param filePaths - Array of relative paths to files
 * @param options - Optional configuration
 * @returns Array literal containing Data URLs
 */
export function inlineDataURLs$(
  filePaths: string[],
  context?: MacroContext,
): string[] {
  validateContext(context, "inlineDataURLs$");

  const pathsNode = filePaths as unknown as ts.Node;
  const resolvedPaths = context.resolveNodeValue(pathsNode);

  if (!Array.isArray(resolvedPaths)) {
    throw new Error(
      `inlineDataURLs$ requires an array of string literals, got: ${typeof resolvedPaths}`,
    );
  }

  const sourceFile = context.sourceFile;
  const sourceDir = path.dirname(sourceFile.fileName);

  const dataURLs: string[] = [];

  for (const filePath of resolvedPaths) {
    if (typeof filePath !== "string") {
      throw new Error(
        `inlineDataURLs$ requires all paths to be string literals, got: ${typeof filePath}`,
      );
    }

    const absolutePath = path.resolve(sourceDir, filePath);

    try {
      const mimeType = getMimeType(absolutePath);
      const buffer = fs.readFileSync(absolutePath);
      const base64 = buffer.toString("base64");

      const dataURL = `data:${mimeType};base64,${base64}`;
      dataURLs.push(dataURL);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(
          `File not found: "${absolutePath}" (referenced in ${sourceFile.fileName})`,
        );
      }
      throw new Error(
        `Failed to read file "${absolutePath}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const elements = dataURLs.map((dataURL) =>
    context.factory.createStringLiteral(dataURL),
  );

  return context.factory.createArrayLiteralExpression(elements, true) as any;
}
