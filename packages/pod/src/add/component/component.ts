import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

abstract class ComponentDefinition {
  abstract name: string;
  abstract dependencies: string[];
  abstract generate(): string;
}

class ButtonComponent extends ComponentDefinition {
  name = "button";
  dependencies: string[] = [];

  generate(): string {
    return `"use client";

import { Component, JSX } from "@kithinji/orca";

@Component()
export class Button {
    props!: {
        children: any
    };
    
    build() {
        return (
            <button>
                {this.props.children}
            </button>
        );
    }
}
`;
  }
}

class InputComponent extends ComponentDefinition {
  name = "input";
  dependencies: string[] = [];

  generate(): string {
    return `"use client";

import { Component } from "@kithinji/orca";

@Component()
export class Input {    
    build() {
        return (
            <input />
        );
    }
}
`;
  }
}

class FormComponent extends ComponentDefinition {
  name = "form";
  dependencies = ["button", "input"];

  generate(): string {
    return `"use client";

import { Component } from "@kithinji/orca";
import { Button } from "./button.component";
import { Input } from "./input.component";

@Component()
export class Form {
    props!: {
        onSubmit?: () => void;
    };
    
    build() {
        return (
            <form onSubmit={this.props.onSubmit}>
                <Input />
                <Button>Submit</Button>
            </form>
        );
    }
}
`;
  }
}

class CardComponent extends ComponentDefinition {
  name = "card";
  dependencies = ["button"];

  generate(): string {
    return `"use client";
    
import { Component } from "@kithinji/orca";
import { Button } from "./button.component";

@Component()
export class Card {
    props!: {
        title: string;
        children: any;
        onAction?: () => void;
    };
    
    build() {
        return (
            <div className="card">
                <h3>{this.props.title}</h3>
                <div>{this.props.children}</div>
                {this.props.onAction && (
                    <Button onClick={this.props.onAction}>Action</Button>
                )}
            </div>
        );
    }
}
`;
  }
}

class ComponentRegistry {
  private static components = new Map<string, ComponentDefinition>([
    ["button", new ButtonComponent()],
    ["input", new InputComponent()],
    ["form", new FormComponent()],
    ["card", new CardComponent()],
  ]);

  static get(name: string): ComponentDefinition | undefined {
    return this.components.get(name);
  }

  static has(name: string): boolean {
    return this.components.has(name);
  }

  static getAll(): string[] {
    return Array.from(this.components.keys());
  }

  static register(component: ComponentDefinition): void {
    this.components.set(component.name, component);
  }
}

export function addComponent(
  name: string,
  processedComponents: Set<string> = new Set()
) {
  if (processedComponents.has(name)) {
    return;
  }

  const component = ComponentRegistry.get(name);
  if (!component) {
    throw new Error(
      `Component "${name}" not found. Available components: ${ComponentRegistry.getAll().join(
        ", "
      )}`
    );
  }

  processedComponents.add(name);

  if (component.dependencies.length > 0) {
    console.log(
      `\nProcessing dependencies for "${name}": [${component.dependencies.join(
        ", "
      )}]`
    );
    for (const dependency of component.dependencies) {
      addComponent(dependency, processedComponents);
    }
  }

  const componentModulePath = path.join(
    process.cwd(),
    "src/component/component.module.ts"
  );
  const componentPath = path.join(
    process.cwd(),
    `src/component/component/${name}.component.tsx`
  );
  const componentDir = path.dirname(componentPath);
  const appModulePath = path.join(process.cwd(), "src/app/app.module.ts");

  if (!fs.existsSync(componentModulePath)) {
    const moduleDir = path.dirname(componentModulePath);
    if (!fs.existsSync(moduleDir)) {
      fs.mkdirSync(moduleDir, { recursive: true });
    }
    fs.writeFileSync(componentModulePath, createModule(), "utf-8");
  }

  if (!fs.existsSync(componentDir)) {
    fs.mkdirSync(componentDir, { recursive: true });
  }

  if (!fs.existsSync(componentPath)) {
    fs.writeFileSync(componentPath, component.generate(), "utf-8");
    console.log(`Created ${name}.component.tsx`);
  } else {
    console.log(`${name}.component.tsx already exists, skipping file creation`);
  }

  const moduleContent = fs.readFileSync(componentModulePath, "utf-8");
  const updatedModule = updateModuleWithComponent(moduleContent, name);
  fs.writeFileSync(componentModulePath, updatedModule, "utf-8");

  if (fs.existsSync(appModulePath)) {
    const appModuleContent = fs.readFileSync(appModulePath, "utf-8");
    const updatedAppModule = ensureComponentModuleImported(appModuleContent);
    if (updatedAppModule !== appModuleContent) {
      fs.writeFileSync(appModulePath, updatedAppModule, "utf-8");
    }
  }
}

export function getComponentDependencies(
  name: string,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(name)) {
    return [];
  }

  const component = ComponentRegistry.get(name);
  if (!component) {
    return [];
  }

  visited.add(name);
  const allDeps: string[] = [];

  for (const dep of component.dependencies) {
    allDeps.push(dep);
    allDeps.push(...getComponentDependencies(dep, visited));
  }

  return [...new Set(allDeps)];
}

export function printDependencyTree(name: string, indent: string = ""): void {
  const component = ComponentRegistry.get(name);
  if (!component) {
    console.log(`${indent}${name} (not found)`);
    return;
  }

  console.log(`${indent}${name}`);
  for (const dep of component.dependencies) {
    printDependencyTree(dep, indent + "  ├─ ");
  }
}

export function listComponents(): void {
  console.log("\nAvailable components:");
  for (const name of ComponentRegistry.getAll()) {
    const component = ComponentRegistry.get(name)!;
    const depsInfo =
      component.dependencies.length > 0
        ? ` (depends on: ${component.dependencies.join(", ")})`
        : " (no dependencies)";
    console.log(`  - ${name}${depsInfo}`);
  }
}

function updateModuleWithComponent(
  moduleContent: string,
  componentName: string
): string {
  const className = capitalize(componentName);
  const importPath = `./component/${componentName}.component`;

  const sourceFile = ts.createSourceFile(
    "component.module.ts",
    moduleContent,
    ts.ScriptTarget.Latest,
    true
  );

  const hasImport = sourceFile.statements.some((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        return moduleSpecifier.text === importPath;
      }
    }
    return false;
  });

  if (hasImport) {
    return moduleContent;
  }

  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });

  const importStatement = `import { ${className} } from "${importPath}";\n`;
  let updatedContent =
    moduleContent.slice(0, lastImportEnd) +
    "\n" +
    importStatement +
    moduleContent.slice(lastImportEnd);

  const newSourceFile = ts.createSourceFile(
    "component.module.ts",
    updatedContent,
    ts.ScriptTarget.Latest,
    true
  );

  updatedContent = addToDecoratorArray(
    updatedContent,
    newSourceFile,
    "declarations",
    className
  );
  updatedContent = addToDecoratorArray(
    updatedContent,
    ts.createSourceFile(
      "component.module.ts",
      updatedContent,
      ts.ScriptTarget.Latest,
      true
    ),
    "exports",
    className
  );

  return updatedContent;
}

function addToDecoratorArray(
  content: string,
  sourceFile: ts.SourceFile,
  arrayName: string,
  className: string
): string {
  let decoratorNode: ts.Decorator | undefined;

  sourceFile.statements.forEach((statement) => {
    if (ts.isClassDeclaration(statement) && statement.modifiers) {
      statement.modifiers.forEach((modifier) => {
        if (ts.isDecorator(modifier)) {
          const expression = modifier.expression;
          if (ts.isCallExpression(expression)) {
            const expressionText = expression.expression.getText(sourceFile);
            if (expressionText === "Module") {
              decoratorNode = modifier;
            }
          }
        }
      });
    }
  });

  if (!decoratorNode) {
    console.warn("Could not find @Module decorator");
    return content;
  }

  const callExpression = decoratorNode.expression as ts.CallExpression;
  const objectLiteral = callExpression
    .arguments[0] as ts.ObjectLiteralExpression;

  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) {
    return content;
  }

  let targetProperty: ts.PropertyAssignment | undefined;
  objectLiteral.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const propName = prop.name.getText(sourceFile);
      if (propName === arrayName) {
        targetProperty = prop;
      }
    }
  });

  if (!targetProperty) {
    console.warn(`Could not find ${arrayName} property`);
    return content;
  }

  const arrayLiteral = targetProperty.initializer;
  if (!ts.isArrayLiteralExpression(arrayLiteral)) {
    return content;
  }

  const hasClassName = arrayLiteral.elements.some((element) => {
    return element.getText(sourceFile).trim() === className;
  });

  if (hasClassName) {
    return content;
  }

  const arrayStart = arrayLiteral.getStart(sourceFile);
  const arrayEnd = arrayLiteral.getEnd();

  if (arrayLiteral.elements.length === 0) {
    const newArray = `[${className}]`;
    return (
      content.substring(0, arrayStart) + newArray + content.substring(arrayEnd)
    );
  }

  const lastElement = arrayLiteral.elements[arrayLiteral.elements.length - 1];
  const insertPos = lastElement.getEnd();
  const newElement = `, ${className}`;

  return (
    content.substring(0, insertPos) + newElement + content.substring(insertPos)
  );
}

function ensureComponentModuleImported(appModuleContent: string): string {
  const sourceFile = ts.createSourceFile(
    "app.module.ts",
    appModuleContent,
    ts.ScriptTarget.Latest,
    true
  );

  const hasComponentModuleImport = sourceFile.statements.some((statement) => {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const namedBindings = statement.importClause.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        return namedBindings.elements.some(
          (element) => element.name.text === "ComponentModule"
        );
      }
    }
    return false;
  });

  if (hasComponentModuleImport) {
    return ensureInImportsArray(appModuleContent, sourceFile);
  }

  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });

  const importStatement = `import { ComponentModule } from "../component/component.module";\n`;
  let updatedContent =
    appModuleContent.slice(0, lastImportEnd) +
    "\n" +
    importStatement +
    appModuleContent.slice(lastImportEnd);

  const newSourceFile = ts.createSourceFile(
    "app.module.ts",
    updatedContent,
    ts.ScriptTarget.Latest,
    true
  );

  updatedContent = ensureInImportsArray(updatedContent, newSourceFile);

  return updatedContent;
}

function ensureInImportsArray(
  content: string,
  sourceFile: ts.SourceFile
): string {
  return addToDecoratorArray(content, sourceFile, "imports", "ComponentModule");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function createModule() {
  return `import { Module } from "@kithinji/orca";

@Module({
    imports: [],
    providers: [],
    declarations: [],
    exports: [],
})
export class ComponentModule {}
`;
}
