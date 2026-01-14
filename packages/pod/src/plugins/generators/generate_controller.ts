import * as path from "path";
import {
  capitalize,
  extractServiceInfo,
  GenerationError,
  parseTypeScript,
  ServiceInfo,
  ServiceMethod,
  serviceNameToPath,
  StreamType,
  toInstanceName,
  validateServiceInfo,
} from "./utils";

export function generateController(
  filePath: string,
  code: string
): string | null {
  try {
    const ast = parseTypeScript(filePath, code);
    const serviceInfo = extractServiceInfo(ast, filePath, true);

    if (!serviceInfo || !serviceInfo.hasInjectable) {
      return null;
    }

    validateServiceInfo(serviceInfo, filePath);
    return generateControllerCode(serviceInfo, filePath);
  } catch (error) {
    if ((error as any).type) {
      throw error;
    }
    throw {
      type: "parse",
      message: `Failed to parse TypeScript file: ${(error as Error).message}`,
      filePath,
      details: error,
    } as GenerationError;
  }
}

function generateControllerCode(
  serviceInfo: ServiceInfo,
  filePath: string
): string {
  const serviceName = serviceInfo.className;
  const controllerName = serviceName.replace(/Service$/, "GenController");
  const serviceImportPath = getImportPath(filePath);
  const controllerPath = serviceNameToPath(serviceName);

  const imports = generateImports(serviceInfo, serviceName, serviceImportPath);
  const methods = generateMethods(serviceInfo);
  const serviceInstance = toInstanceName(serviceName);

  return `${imports}

@Controller("/${controllerPath}", {
  providedIn: "root",
})
export class ${controllerName} {
  constructor(
    private readonly ${serviceInstance}: ${serviceName}
  ) {}

${methods}
}`;
}


function getImportPath(filePath: string): string {
  const basename = path.basename(filePath);
  return `./${basename.replace(/\.tsx?$/, "")}`;
}

function generateImports(
  serviceInfo: ServiceInfo,
  serviceName: string,
  serviceImportPath: string
): string {
  const importGroups = new Map<string, Set<string>>();

  const registerIdentifier = (id: string) => {
    const source = serviceInfo.importMap[id] || serviceImportPath;
    if (!importGroups.has(source)) {
      importGroups.set(source, new Set());
    }
    importGroups.get(source)!.add(id);
  };

  serviceInfo.methods.forEach((m) => {
    [...m.paramSchemas, m.returnSchema].filter(Boolean).forEach((s) => {
      const matches = s!.match(/[A-Z][a-zA-Z0-9]*/g);
      matches?.forEach(registerIdentifier);
      if (s!.includes("z.")) {
        registerIdentifier("z");
      }
    });
  });

  const hasPost = serviceInfo.methods.some(
    (m) => !m.isStreamable && m.params.length > 0
  );
  const hasGet = serviceInfo.methods.some(
    (m) => !m.isStreamable && m.params.length === 0
  );
  const hasSse = serviceInfo.methods.some(
    (m) => m.isStreamable && m.streamType == StreamType.Observable
  );
  const hasStreamableWithParams = serviceInfo.methods.some(
    (m) => m.isStreamable && m.params.length > 0
  );

  const decorators = ["Controller"];
  if (hasPost) decorators.push("Post");
  if (hasGet) decorators.push("Get");
  if (hasPost) decorators.push("Body");
  if (hasSse) decorators.push("Sse");
  if (hasStreamableWithParams) decorators.push("Query");

  let importStrings = `import { ${decorators.join(
    ", "
  )} } from "@kithinji/orca";\n`;

  importGroups.forEach((ids, source) => {
    const filteredIds = Array.from(ids).filter((id) => id !== serviceName);
    if (filteredIds.length > 0) {
      importStrings += `import { ${filteredIds.join(
        ", "
      )} } from "${source}";\n`;
    }
  });

  return importStrings;
}

function generateMethods(serviceInfo: ServiceInfo): string {
  return serviceInfo.methods
    .map((m) => generateMethod(m, serviceInfo.className))
    .join("\n\n");
}

function generateMethod(method: ServiceMethod, serviceName: string): string {
  const hasParams = method.params.length > 0;
  const serviceInstance = toInstanceName(serviceName);

  if (method.isStreamable) {
    const queryParams = hasParams
      ? method.params
          .map((p) => `@Query('${p.name}') ${p.name}: ${p.type}`)
          .join(", ")
      : "";
    const body = generateMethodBody(method, serviceInstance, false);
    const returnTypeName = method.streamType || "Observable";

    return `  @Sse("${method.name}")
  ${method.name}(${queryParams}): ${returnTypeName}<${method.returnType}> {
${body}
  }`;
  }

  const decorator = hasParams ? "Post" : "Get";
  const bodyParam = hasParams ? `@Body() body: any` : "";
  const body = generateMethodBody(method, serviceInstance, true);

  return `  @${decorator}("${method.name}")
  async ${method.name}(${bodyParam}): Promise<${method.returnType}> {
${body}
  }`;
}

function generateMethodBody(
  method: ServiceMethod,
  serviceInstance: string,
  isAsync: boolean
): string {
  const lines: string[] = [];
  const hasParams = method.params.length > 0;

  if (hasParams && method.isStreamable && method.paramSchemas.length > 0) {
    method.params.forEach((p, i) => {
      lines.push(
        `    const validated${capitalize(p.name)} = ${
          method.paramSchemas[i]
        }.parse(${p.name});`
      );
    });
  }

  if (hasParams && !method.isStreamable) {
    if (method.paramSchemas.length > 0) {
      lines.push(
        `    const b = typeof body === 'object' && body !== null ? body : {};`
      );
      method.params.forEach((p, i) => {
        lines.push(
          `    const ${p.name} = ${method.paramSchemas[i]}.parse(b.${p.name});`
        );
      });
    } else {
      const paramNames = method.params.map((p) => p.name).join(", ");
      lines.push(`    const { ${paramNames} } = body || {};`);
    }
  }

  let callArgs: string;
  if (hasParams && method.isStreamable && method.paramSchemas.length > 0) {
    callArgs = method.params
      .map((p) => `validated${capitalize(p.name)}`)
      .join(", ");
  } else {
    callArgs = method.params.map((p) => p.name).join(", ");
  }
  const serviceCall = `${serviceInstance}.${method.name}(${callArgs})`;

  if (method.returnSchema && isAsync) {
    lines.push(`    const res = await this.${serviceCall};`);
    lines.push(`    return ${method.returnSchema}.parse(res);`);
  } else if (isAsync) {
    lines.push(`    return this.${serviceCall};`);
  } else {
    lines.push(`    return this.${serviceCall};`);
  }

  return lines.join("\n");
}
