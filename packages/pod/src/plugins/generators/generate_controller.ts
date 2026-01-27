import * as path from "path";
import { printSync } from "@swc/core";
import {
  capitalize,
  extractServiceInfo,
  GenerationError,
  parseTypeScript,
  removeLiftedDecoratorsFromAST,
  ServiceInfo,
  ServiceMethod,
  serviceNameToPath,
  shouldLiftDecorator,
  StreamType,
  toInstanceName,
  validateServiceInfo,
} from "./utils";

export interface ControllerGenerationResult {
  controllerCode: string;
  transformedServiceCode: string;
}

export function generateController(
  filePath: string,
  code: string,
): ControllerGenerationResult | null {
  try {
    const ast = parseTypeScript(filePath, code);
    const serviceInfo = extractServiceInfo(ast, filePath, true, false);

    if (!serviceInfo || !serviceInfo.hasInjectable) {
      return null;
    }

    validateServiceInfo(serviceInfo, filePath);

    const transformedAst = removeLiftedDecoratorsFromAST(ast);

    const transformedServiceCode = printSync(transformedAst).code;

    const controllerCode = generateControllerCode(serviceInfo, filePath);

    return {
      controllerCode,
      transformedServiceCode,
    };
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
  filePath: string,
): string {
  const serviceName = serviceInfo.className;
  const controllerName = serviceName.replace(/Service$/, "GenController");
  const serviceImportPath = getImportPath(filePath);
  const controllerPath = serviceNameToPath(serviceName);

  const imports = generateImports(serviceInfo, serviceName, serviceImportPath);
  const methods = generateMethods(serviceInfo);
  const serviceInstance = toInstanceName(serviceName);

  return `${imports}

@Controller("/api/${controllerPath}", {
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
  serviceImportPath: string,
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
    (m) => !m.isStreamable && m.params.length > 0,
  );
  const hasGet = serviceInfo.methods.some(
    (m) => !m.isStreamable && m.params.length === 0,
  );
  const hasSse = serviceInfo.methods.some(
    (m) => m.isStreamable && m.streamType == StreamType.Observable,
  );
  const hasStreamableWithParams = serviceInfo.methods.some(
    (m) => m.isStreamable && m.params.length > 0,
  );
  const hasFileUpload = serviceInfo.methods.some((m) => hasMulterFileParams(m));
  const hasSingleFileUpload = serviceInfo.methods.some(
    (m) =>
      getFileParams(m).length === 1 && !isArrayFileParam(getFileParams(m)[0]),
  );
  const hasMultipleFilesUpload = serviceInfo.methods.some(
    (m) =>
      getFileParams(m).length === 1 && isArrayFileParam(getFileParams(m)[0]),
  );
  const hasMultipleFileFields = serviceInfo.methods.some(
    (m) => getFileParams(m).length > 1,
  );

  const decorators = ["Controller", "Req"];
  if (hasPost) decorators.push("Post");
  if (hasGet) decorators.push("Get");
  if (hasPost) decorators.push("Body");
  if (hasSse) decorators.push("Sse");
  if (hasStreamableWithParams) decorators.push("Query");
  if (hasFileUpload) decorators.push("UseInterceptors");
  if (hasSingleFileUpload) decorators.push("UploadedFile");
  if (hasMultipleFilesUpload || hasMultipleFileFields)
    decorators.push("UploadedFiles");

  let importStrings = `import { ${decorators.join(
    ", ",
  )} } from "@kithinji/orca";\n`;

  if (hasFileUpload) {
    const interceptors = [];
    if (hasSingleFileUpload) interceptors.push("FileInterceptor");
    if (hasMultipleFilesUpload) interceptors.push("FilesInterceptor");
    if (hasMultipleFileFields) interceptors.push("FileFieldsInterceptor");

    importStrings += `import { ${interceptors.join(
      ", ",
    )} } from "@kithinji/express";\n`;
  }

  importGroups.forEach((ids, source) => {
    const filteredIds = Array.from(ids).filter((id) => id !== serviceName);
    if (filteredIds.length > 0) {
      importStrings += `import { ${filteredIds.join(
        ", ",
      )} } from "${source}";\n`;
    }
  });

  return importStrings;
}

interface FileParamInfo {
  name: string;
  type: string;
  isArray: boolean;
}

function hasMulterFileParams(method: ServiceMethod): boolean {
  return method.params.some((param) => {
    return (
      param.type === "Array<Express.Multer.File>" ||
      param.type === "Express.Multer.File[]" ||
      param.type === "Express.Multer.File"
    );
  });
}

function getFileParams(method: ServiceMethod): FileParamInfo[] {
  return method.params
    .filter(
      (p) =>
        p.type === "Array<Express.Multer.File>" ||
        p.type === "Express.Multer.File[]" ||
        p.type === "Express.Multer.File",
    )
    .map((p) => ({
      name: p.name,
      type: p.type,
      isArray: p.type.includes("Array") || p.type.includes("[]"),
    }));
}

function isArrayFileParam(param: FileParamInfo): boolean {
  return param.isArray;
}

function getNonFileParams(method: ServiceMethod): typeof method.params {
  return method.params.filter(
    (p) =>
      p.type !== "Array<Express.Multer.File>" &&
      p.type !== "Express.Multer.File[]" &&
      p.type !== "Express.Multer.File",
  );
}

function generateMethods(serviceInfo: ServiceInfo): string {
  return serviceInfo.methods
    .map((m) => generateMethod(m, serviceInfo.className))
    .join("\n\n");
}

function generateMethod(method: ServiceMethod, serviceName: string): string {
  const hasParams = method.params.length > 0;
  const serviceInstance = toInstanceName(serviceName);
  const fileParams = getFileParams(method);
  const hasFileParams = fileParams.length > 0;

  const liftedDecorators =
    method.decorators
      ?.filter(shouldLiftDecorator)
      .map((d) => `  ${d}`)
      .join("\n") || "";

  if (method.isStreamable) {
    if (hasFileParams) {
      throw new Error(
        `Method '${method.name}' cannot have file parameters for streaming endpoints`,
      );
    }

    const reqParam = `@Req() request: Request`;
    const queryParams = hasParams
      ? method.params
          .map((p) => `@Query('${p.name}') ${p.name}: ${p.type}`)
          .join(", ")
      : "";
    const allParams = [reqParam, queryParams].filter(Boolean).join(", ");

    const body = generateMethodBody(method, serviceInstance, false);

    const returnTypeName = method.streamType || "Observable";

    const decoratorPrefix = liftedDecorators ? `${liftedDecorators}\n` : "";

    return `${decoratorPrefix}  @Sse("${method.name}")
  ${method.name}(${allParams}): ${returnTypeName}<${method.returnType}> {
${body}
  }`;
  }

  if (hasFileParams) {
    return generateFileUploadMethod(
      method,
      serviceInstance,
      fileParams,
      liftedDecorators,
    );
  }

  const decorator = hasParams ? "Post" : "Get";
  const reqParam = `@Req() request: Request`;
  const bodyParam = hasParams ? `@Body() body: any` : "";
  const allParams = [reqParam, bodyParam].filter(Boolean).join(", ");
  const body = generateMethodBody(method, serviceInstance, true);

  const decoratorPrefix = liftedDecorators ? `${liftedDecorators}\n` : "";

  return `${decoratorPrefix}  @${decorator}("${method.name}")
  async ${method.name}(${allParams}): Promise<${method.returnType}> {
${body}
  }`;
}

function generateFileUploadMethod(
  method: ServiceMethod,
  serviceInstance: string,
  fileParams: FileParamInfo[],
  liftedDecorators: string,
): string {
  const nonFileParams = getNonFileParams(method);
  const interceptorDecorator = generateInterceptorDecorator(fileParams);
  const methodParams = generateFileMethodParams(fileParams, nonFileParams);

  const allParams = [`@Req() request: Request`, methodParams]
    .filter(Boolean)
    .join(", ");

  const body = generateFileMethodBody(
    method,
    serviceInstance,
    fileParams,
    nonFileParams,
  );

  const decoratorPrefix = liftedDecorators ? `${liftedDecorators}\n` : "";

  return `${decoratorPrefix}${interceptorDecorator}  @Post("${method.name}")
  async ${method.name}(${allParams}): Promise<${method.returnType}> {
${body}
  }`;
}

function generateInterceptorDecorator(fileParams: FileParamInfo[]): string {
  if (fileParams.length === 1) {
    const param = fileParams[0];
    if (param.isArray) {
      return `  @UseInterceptors(FilesInterceptor("${param.name}"))\n`;
    } else {
      return `  @UseInterceptors(FileInterceptor("${param.name}"))\n`;
    }
  } else {
    const fields = fileParams.map((p) => `{ name: "${p.name}" }`).join(", ");
    return `  @UseInterceptors(FileFieldsInterceptor([${fields}]))\n`;
  }
}

type MethodParam = ServiceMethod["params"][number];

function generateFileMethodParams(
  fileParams: FileParamInfo[],
  nonFileParams: MethodParam[],
): string {
  const params: string[] = [];

  if (fileParams.length === 1) {
    const param = fileParams[0];
    const decorator = param.isArray ? "@UploadedFiles()" : "@UploadedFile()";
    params.push(`${decorator} ${param.name}: ${param.type}`);
  } else if (fileParams.length > 1) {
    params.push(
      `@UploadedFiles() files: Record<string, Express.Multer.File[]>`,
    );
  }

  if (nonFileParams.length > 0) {
    params.push(`@Body() body: any`);
  }

  return params.join(", ");
}

function generateFileMethodBody(
  method: ServiceMethod,
  serviceInstance: string,
  fileParams: FileParamInfo[],
  nonFileParams: MethodParam[],
): string {
  const lines: string[] = [];

  lines.push(`    this.${serviceInstance}.request = request;`);

  if (fileParams.length > 1) {
    fileParams.forEach((p) => {
      if (p.isArray) {
        lines.push(`    const ${p.name} = files["${p.name}"] || [];`);
      } else {
        lines.push(
          `    const ${p.name} = files["${p.name}"]?.[0] || files["${p.name}"];`,
        );
      }
    });
  }

  if (nonFileParams.length > 0) {
    const nonFileSchemas = method.paramSchemas.filter((_, i) => {
      const param = method.params[i];
      return !fileParams.some((fp) => fp.name === param.name);
    });

    if (nonFileSchemas.length > 0 && nonFileSchemas.some((s) => s)) {
      lines.push(
        `    const b = typeof body === 'object' && body !== null ? body : {};`,
      );
      nonFileParams.forEach((p) => {
        const schemaIndex = method.params.findIndex((mp) => mp.name === p.name);
        if (method.paramSchemas[schemaIndex]) {
          lines.push(
            `    const ${p.name} = ${method.paramSchemas[schemaIndex]}.parse(b.${p.name});`,
          );
        }
      });
    } else {
      const paramNames = nonFileParams.map((p) => p.name).join(", ");
      lines.push(`    const { ${paramNames} } = body || {};`);
    }
  }

  const callArgs = method.params.map((p) => p.name).join(", ");
  const serviceCall = `${serviceInstance}.${method.name}(${callArgs})`;

  if (method.returnSchema) {
    lines.push(`    const res = await this.${serviceCall};`);
    lines.push(`    return ${method.returnSchema}.parse(res);`);
  } else {
    lines.push(`    return this.${serviceCall};`);
  }

  return lines.join("\n");
}

function generateMethodBody(
  method: ServiceMethod,
  serviceInstance: string,
  isAsync: boolean,
): string {
  const lines: string[] = [];
  const hasParams = method.params.length > 0;

  lines.push(`    this.${serviceInstance}.request = request;`);

  if (hasParams && method.isStreamable && method.paramSchemas.length > 0) {
    method.params.forEach((p, i) => {
      lines.push(
        `    const validated${capitalize(p.name)} = ${
          method.paramSchemas[i]
        }.parse(${p.name});`,
      );
    });
  }

  if (hasParams && !method.isStreamable) {
    if (method.paramSchemas.length > 0) {
      lines.push(
        `    const b = typeof body === 'object' && body !== null ? body : {};`,
      );
      method.params.forEach((p, i) => {
        lines.push(
          `    const ${p.name} = ${method.paramSchemas[i]}.parse(b.${p.name});`,
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
