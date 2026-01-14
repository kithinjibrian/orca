import * as ts from "typescript";

export class Project {
  public program: ts.Program;
  public checker: ts.TypeChecker;

  constructor(entryPoints: string[]) {
    this.program = ts.createProgram(entryPoints, {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      jsx: ts.JsxEmit.ReactJSX,
    });
    this.checker = this.program.getTypeChecker();
  }

  isPublicFile(sourceFile: ts.SourceFile): boolean {
    for (const stmt of sourceFile.statements) {
      if (
        ts.isExpressionStatement(stmt) &&
        ts.isStringLiteral(stmt.expression)
      ) {
        if (stmt.expression.text === "use public") return true;
      } else {
        break;
      }
    }
    return false;
  }

  isClientFile(sourceFile: ts.SourceFile): boolean {
    for (const stmt of sourceFile.statements) {
      if (
        ts.isExpressionStatement(stmt) &&
        ts.isStringLiteral(stmt.expression)
      ) {
        if (stmt.expression.text === "use client") return true;
      } else {
        break;
      }
    }
    return false;
  }
}
