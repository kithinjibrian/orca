import { MacroContext } from "@kithinji/pod";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const projectRootCache = new Map<string, string | null>();

export function assert$<T>(
  condition: T,
  message: string = "",
  context?: MacroContext,
): asserts condition is NonNullable<T> {
  if (!context) {
    throw new Error("assert$ must be called within a macro context");
  }

  const conditionNode = condition as unknown as ts.Node;
  const messageNode = message as unknown as ts.Node;

  if (!context.ts.isExpression(conditionNode)) {
    context.error("assert$ condition must be an expression");
  }

  const conditionText = conditionNode.getText(context.sourceFile);

  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
    context.node.getStart(),
  );
  const fileName = context.sourceFile.fileName;

  const projectRoot = findProjectRoot(fileName);
  const relativePath = projectRoot
    ? path.relative(projectRoot, fileName)
    : path.basename(fileName);
  const location = `${relativePath}:${line + 1}:${character + 1}`;

  let resolvedMessage = "";
  try {
    const messageValue = context.resolveNodeValue(messageNode);
    if (typeof messageValue === "string") {
      resolvedMessage = messageValue.trim();
    }
  } catch {
    // If we can't resolve it, treat it as no message
  }

  let errorMessage = `Assertion failed: ${conditionText}`;
  if (resolvedMessage !== "") {
    errorMessage += `\n  ${resolvedMessage}`;
  }
  errorMessage += `\n  at ${location}`;

  // Create the runtime assertion code wrapped in an IIFE:
  // (() => {
  //   if (!(condition)) {
  //     throw new Error("...");
  //   }
  // })()

  const throwStatement = context.factory.createThrowStatement(
    context.factory.createNewExpression(
      context.factory.createIdentifier("Error"),
      undefined,
      [context.factory.createStringLiteral(errorMessage)],
    ),
  );

  const ifStatement = context.factory.createIfStatement(
    context.factory.createPrefixUnaryExpression(
      context.ts.SyntaxKind.ExclamationToken,
      context.factory.createParenthesizedExpression(
        conditionNode as ts.Expression,
      ),
    ),
    context.factory.createBlock([throwStatement], true),
  );

  const iife = context.factory.createCallExpression(
    context.factory.createParenthesizedExpression(
      context.factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        context.factory.createToken(
          context.ts.SyntaxKind.EqualsGreaterThanToken,
        ),
        context.factory.createBlock([ifStatement], true),
      ),
    ),
    undefined,
    [],
  );

  return iife as any;
}

function findProjectRoot(startPath: string): string | null {
  const dir = path.dirname(startPath);

  if (projectRootCache.has(dir)) {
    return projectRootCache.get(dir)!;
  }

  let currentDir = dir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      projectRootCache.set(dir, currentDir);
      return currentDir;
    }

    const parent = path.dirname(currentDir);

    if (parent === currentDir) {
      projectRootCache.set(dir, null);
      return null;
    }

    currentDir = parent;
  }
}
