import { createStructure, DirEntry, toCamelCase, toPascalCase } from "@/utils";
import * as path from "path";
import * as fs from "fs";
import * as ts from "typescript";

export function addFeature(name: string) {
  const featureDir = path.join(process.cwd(), "src", "features", name);

  addModule(name, featureDir);

  updateFeaturesIndex(name);

  updateAppModule(name);
}

export function addModule(name: string, baseDir: string, root?: boolean) {
  const structure: DirEntry = {
    files: [
      { name: `${name}.module.ts`, content: createModule(name, root) },
      { name: `${name}.service.ts`, content: createService(name) },
      { name: `${name}.page.tsx`, content: createPage(name) },
    ],
    dirs: [
      {
        name: "schemas",
        files: [
          {
            name: "get.ts",
            content: createGetSchema(name),
          },
          {
            name: "create.ts",
            content: createCreateSchema(name),
          },
          {
            name: "update.ts",
            content: createUpdateSchema(name),
          },
          {
            name: "list.ts",
            content: createListSchema(name),
          },
          {
            name: "delete.ts",
            content: createDeleteSchema(name),
          },
        ],
      },
      {
        name: "components",
        files: [
          {
            name: `${name}-list.component.tsx`,
            content: createListComponent(name),
          },
        ],
      },
    ],
  };

  createStructure(baseDir, structure);
}

function updateFeaturesIndex(featureName: string) {
  const featuresIndexPath = path.join(
    process.cwd(),
    "src",
    "features",
    "index.ts"
  );

  const moduleName = toPascalCase(featureName + "_" + "Module");
  const importPath = `./${featureName}/${featureName}.module`;

  if (fs.existsSync(featuresIndexPath)) {
    let content = fs.readFileSync(featuresIndexPath, "utf-8");
    const sourceFile = ts.createSourceFile(
      "index.ts",
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const hasExport = sourceFile.statements.some((statement) => {
      if (ts.isExportDeclaration(statement)) {
        const moduleSpecifier = statement.moduleSpecifier;
        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
          return moduleSpecifier.text === importPath;
        }
        if (
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          return statement.exportClause.elements.some(
            (element) => element.name.text === moduleName
          );
        }
      }
      return false;
    });

    if (hasExport) {
      return;
    }

    const exportStatement = `export { ${moduleName} } from "${importPath}";\n`;
    fs.appendFileSync(featuresIndexPath, exportStatement);
  } else {
    const featuresDir = path.dirname(featuresIndexPath);
    if (!fs.existsSync(featuresDir)) {
      fs.mkdirSync(featuresDir, { recursive: true });
    }

    const exportStatement = `export { ${moduleName} } from "${importPath}";\n`;
    fs.writeFileSync(featuresIndexPath, exportStatement, "utf-8");
  }
}

function updateAppModule(featureName: string) {
  const appModulePath = path.join(process.cwd(), "src", "app", "app.module.ts");

  if (!fs.existsSync(appModulePath)) {
    return;
  }

  const moduleName = toPascalCase(featureName + "_" + "Module");
  let content = fs.readFileSync(appModulePath, "utf-8");

  const sourceFile = ts.createSourceFile(
    "app.module.ts",
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const hasImport = sourceFile.statements.some((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        return importPath.includes(`/${featureName}/${featureName}.module`);
      }

      if (
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        return statement.importClause.namedBindings.elements.some(
          (element) => element.name.text === moduleName
        );
      }
    }
    return false;
  });

  if (hasImport) {
    content = addToModuleImportsArray(content, sourceFile, moduleName);
    fs.writeFileSync(appModulePath, content, "utf-8");
    return;
  }

  let lastImportEnd = 0;
  sourceFile.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement)) {
      lastImportEnd = statement.end;
    }
  });

  const importStatement = `import { ${moduleName} } from "../features/${featureName}/${featureName}.module";\n`;
  content =
    content.slice(0, lastImportEnd) +
    "\n" +
    importStatement +
    content.slice(lastImportEnd);

  const newSourceFile = ts.createSourceFile(
    "app.module.ts",
    content,
    ts.ScriptTarget.Latest,
    true
  );

  content = addToModuleImportsArray(content, newSourceFile, moduleName);

  fs.writeFileSync(appModulePath, content, "utf-8");
}

function addToModuleImportsArray(
  content: string,
  sourceFile: ts.SourceFile,
  moduleName: string
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
    return content;
  }

  const callExpression = decoratorNode.expression as ts.CallExpression;
  const objectLiteral = callExpression
    .arguments[0] as ts.ObjectLiteralExpression;

  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) {
    return content;
  }

  let importsProperty: ts.PropertyAssignment | undefined;
  objectLiteral.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const propName = prop.name.getText(sourceFile);
      if (propName === "imports") {
        importsProperty = prop;
      }
    }
  });

  if (!importsProperty) {
    return content;
  }

  const arrayLiteral = importsProperty.initializer;
  if (!ts.isArrayLiteralExpression(arrayLiteral)) {
    return content;
  }

  const hasModule = arrayLiteral.elements.some((element) => {
    return element.getText(sourceFile).trim() === moduleName;
  });

  if (hasModule) {
    return content;
  }

  const arrayStart = arrayLiteral.getStart(sourceFile);
  const arrayEnd = arrayLiteral.getEnd();

  if (arrayLiteral.elements.length === 0) {
    const newArray = `[${moduleName}]`;
    return (
      content.substring(0, arrayStart) + newArray + content.substring(arrayEnd)
    );
  }

  const lastElement = arrayLiteral.elements[arrayLiteral.elements.length - 1];
  const insertPos = lastElement.getEnd();
  const newElement = `, ${moduleName}`;

  return (
    content.substring(0, insertPos) + newElement + content.substring(insertPos)
  );
}

function createModule(name: string, root?: boolean) {
  const serviceName = toPascalCase(name + "_" + "Service");
  const pageName = toPascalCase(name + "_" + "Page");
  const moduleName = toPascalCase(name + "_" + "Module");
  const componentName = toPascalCase(name + "_" + "List");

  if (root) {
    return `import { Module, RouterModule, ServeStaticModule } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { ${serviceName} } from "./${name}.service";
import { ${pageName} } from "./${name}.page";
import { ${componentName} } from "./components/${name}-list.component";

@Module({
    imports: [
      ServeStaticModule.forRoot({
        rootPath: "./public",
      }),
      RouterModule.forRoot(),
      ComponentModule
    ],
    providers: [${serviceName}],
    declarations: [${pageName}, ${componentName}],
    exports: [${serviceName}, ${pageName}],
    bootstrap: ${pageName}
})
export class ${moduleName} {}
`;
  }

  return `import { Module } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { ${serviceName} } from "./${name}.service";
import { ${pageName} } from "./${name}.page";
import { ${componentName} } from "./components/${name}-list.component";

@Module({
    imports: [ComponentModule],
    providers: [${serviceName}],
    declarations: [${pageName}, ${componentName}],
    exports: [${serviceName}, ${pageName}],
})
export class ${moduleName} {}
`;
}

function createGetSchema(name: string) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_" + "GetInput")} = z.object({
  id: z.string().uuid(),
});

export const ${toCamelCase(name + "_" + "GetOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});
`;
}

function createCreateSchema(name: string) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_" + "CreateInput")} = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const ${toCamelCase(name + "_" + "CreateOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
});
`;
}

function createUpdateSchema(name: string) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_" + "UpdateInput")} = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const ${toCamelCase(name + "_" + "UpdateOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
`;
}

function createListSchema(name: string) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_" + "ListOutput")} = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date().optional(),
  })
);
`;
}

function createDeleteSchema(name: string) {
  return `import { z } from "zod";

export const ${toCamelCase(name + "_" + "DeleteInput")} = z.object({
  id: z.string().uuid(),
});

export const ${toCamelCase(name + "_" + "DeleteOutput")} = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});
`;
}

function createService(name: string) {
  const serviceName = toPascalCase(name + "_" + "Service");

  return `"use public";

import { Injectable, Signature } from "@kithinji/orca";
import { 
  ${toCamelCase(name + "_" + "CreateInput")}, 
  ${toCamelCase(name + "_" + "CreateOutput")} 
} from "./schemas/create";
import { 
  ${toCamelCase(name + "_" + "GetInput")}, 
  ${toCamelCase(name + "_" + "GetOutput")} 
} from "./schemas/get";
import { 
  ${toCamelCase(name + "_" + "UpdateInput")}, 
  ${toCamelCase(name + "_" + "UpdateOutput")} 
} from "./schemas/update";
import { ${toCamelCase(name + "_" + "ListOutput")} } from "./schemas/list";
import { 
  ${toCamelCase(name + "_" + "DeleteInput")}, 
  ${toCamelCase(name + "_" + "DeleteOutput")} 
} from "./schemas/delete";

@Injectable()
export class ${serviceName} {
    private items: any[] = [];

    @Signature(${toCamelCase(name + "_" + "CreateInput")}, ${toCamelCase(
    name + "_" + "CreateOutput"
  )})
    public async create(input: any) {
        const item = {
            id: crypto.randomUUID(),
            ...input,
            createdAt: new Date(),
        };
        this.items.push(item);
        return item;
    }

    @Signature(${toCamelCase(name + "_" + "GetInput")}, ${toCamelCase(
    name + "_" + "GetOutput"
  )})
    public async get(input: any) {
        const item = this.items.find((i) => i.id === input.id);
        if (!item) {
            throw new Error("Item not found");
        }
        return item;
    }

    @Signature(${toCamelCase(name + "_" + "ListOutput")})
    public async list() {
        return this.items;
    }

    @Signature(${toCamelCase(name + "_" + "UpdateInput")}, ${toCamelCase(
    name + "_" + "UpdateOutput"
  )})
    public async update(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        this.items[index] = {
            ...this.items[index],
            ...input,
            updatedAt: new Date(),
        };
        
        return this.items[index];
    }

    @Signature(${toCamelCase(name + "_" + "DeleteInput")}, ${toCamelCase(
    name + "_" + "DeleteOutput"
  )})
    public async delete(input: any) {
        const index = this.items.findIndex((i) => i.id === input.id);
        if (index === -1) {
            throw new Error("Item not found");
        }
        
        const deleted = this.items.splice(index, 1)[0];
        return deleted;
    }
}
`;
}

function createPage(name: string) {
  const pageName = toPascalCase(name + "_" + "Page");
  const listComponent = toPascalCase(name + "_" + "List");

  return `import { Component } from "@kithinji/orca";
import { ${listComponent} } from "./components/${name}-list.component";

@Component({
  deps: [${listComponent}]
})
export class ${pageName} {
    build() {
        return (
            <div>
                <h1>${toPascalCase(name)} Management</h1>
                <${listComponent} name="hello" />
            </div>
        );
    }
}
`;
}

function createListComponent(name: string) {
  const componentName = toPascalCase(name + "_" + "List");
  const serviceName = toPascalCase(name + "_" + "Service");
  const serviceVar = toCamelCase(name + "_" + "Service");

  return `"use client";

import { Component } from "@kithinji/orca";
import { ${serviceName} } from "../${name}.service";

@Component()
export class ${componentName} {
    props!: {
        name: string;
    };

    constructor(
        public readonly ${serviceVar}: ${serviceName}
    ) {}

    build() {
        return (
            <div>
                <h2>${toPascalCase(name)} List</h2>
                <p>List component for ${name}</p>
                {/* Add your list implementation here */}
            </div>
        );
    }
}
`;
}
