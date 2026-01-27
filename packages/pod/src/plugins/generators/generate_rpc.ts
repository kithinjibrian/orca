import { printSync } from "@swc/core";
import {
  extractServiceInfo,
  GenerationError,
  parseTypeScript,
  ServiceInfo,
  ServiceMethod,
  serviceNameToPath,
  ImportReference,
} from "./utils";

export function generateRpcStub(filePath: string, code: string): string {
  try {
    const ast = parseTypeScript(filePath, code);
    const serviceInfo = extractServiceInfo(ast, filePath, false, true, true);

    if (!serviceInfo) {
      throw {
        type: "validation",
        message: "No exported class with @Injectable decorator found",
        filePath,
      } as GenerationError;
    }

    return generateStubCode(serviceInfo);
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

function getNonFileParams(
  method: ServiceMethod,
): Array<{ name: string; type: string }> {
  return method.params.filter(
    (p) =>
      p.type !== "Array<Express.Multer.File>" &&
      p.type !== "Express.Multer.File[]" &&
      p.type !== "Express.Multer.File",
  );
}

function collectSharedImports(serviceInfo: ServiceInfo): ImportReference[] {
  const allImports: ImportReference[] = [];
  const seen = new Set<string>();

  const sharedParams = serviceInfo.constructorParams.filter((c) =>
    c.decorators?.some((d) => d === "@Shared()"),
  );

  for (const param of sharedParams) {
    if (param.imports) {
      for (const imp of param.imports) {
        const key = `${imp.identifier}:${imp.source}`;
        if (!seen.has(key)) {
          allImports.push(imp);
          seen.add(key);
        }
      }
    }
  }

  return allImports;
}

function generateImportStatements(imports: ImportReference[]): string {
  const importsBySource = new Map<string, Set<string>>();

  for (const imp of imports) {
    if (!importsBySource.has(imp.source)) {
      importsBySource.set(imp.source, new Set());
    }
    importsBySource.get(imp.source)!.add(imp.identifier);
  }

  const statements: string[] = [];
  for (const [source, identifiers] of importsBySource) {
    const identifierList = Array.from(identifiers).sort().join(", ");
    statements.push(`import { ${identifierList} } from "${source}";`);
  }

  return statements.sort().join("\n");
}

function generateStubCode(serviceInfo: ServiceInfo): string {
  const className = serviceInfo.className;
  const basePath = serviceNameToPath(className);

  const methods = serviceInfo.methods
    .map((method) => generateMethod(method, basePath, className))
    .join("\n\n");

  const hasStreamable = serviceInfo.methods.some((m) => m.isStreamable);

  const sharedImports = collectSharedImports(serviceInfo);

  const imports = generateImports(hasStreamable, sharedImports);

  let clientConstructorFields = serviceInfo.constructorParams
    .filter((c) => c.decorators?.some((d) => d === "@Shared()"))
    .map((c) => {
      const filteredDecorators =
        c.decorators?.filter((d) => d !== "@Shared()") || [];
      const decoratorStr =
        filteredDecorators.length > 0
          ? filteredDecorators.join("\n") + "\n"
          : "";

      return `${decoratorStr}${c.accessibility}${
        c.isReadonly ? " readonly " : " "
      }${c.name}: ${c.type},`;
    })
    .join("\n");

  return `${imports}

@Injectable()
export class ${className} {
constructor(
${clientConstructorFields}
) {}

${methods}
}`;
}

function generateImports(
  hasStreamable: boolean,
  sharedImports: ImportReference[],
): string {
  let imports = `import { Injectable } from "@kithinji/orca";\n`;

  if (hasStreamable) {
    imports += `import { Observable } from "rxjs";\n`;
  }

  if (sharedImports.length > 0) {
    const sharedImportStatements = generateImportStatements(sharedImports);
    if (sharedImportStatements) {
      imports += sharedImportStatements + "\n";
    }
  }

  return imports;
}

function generateMethod(
  method: ServiceMethod,
  basePath: string,
  serviceName: string,
): string {
  if (method.lift) {
    const classWrapper = {
      type: "Module",
      span: { start: 0, end: 0 },
      body: [
        {
          type: "ClassDeclaration",
          span: { start: 0, end: 0 },
          declare: false,
          ctxt: 0,
          identifier: {
            type: "Identifier",
            value: "",
            optional: false,
            span: { start: 0, end: 0 },
            ctxt: 0,
          },
          body: [JSON.parse(JSON.stringify(method.ast))],
          decorators: [],
          superClass: null,
        },
      ],
      shebang: null,
    };

    let { code } = printSync(classWrapper as any);

    const lines = code.split("\n");

    lines.shift();
    lines.pop();
    lines.pop();

    const methodCode = lines.join("\n");

    return methodCode;
  }

  if (method.isStreamable) {
    if (hasMulterFileParams(method)) {
      throw new Error(
        `Method '${method.name}' cannot have file parameters for streaming endpoints`,
      );
    }
    return generateSseMethod(method, basePath);
  }

  const fileParams = getFileParams(method);
  const hasFileParams = fileParams.length > 0;

  if (hasFileParams) {
    return generateFileUploadMethod(method, basePath, fileParams);
  }

  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const hasParams = method.params.length > 0;

  if (!hasParams) {
    return generateGetMethod(method, basePath);
  }

  return generatePostMethod(method, basePath, params);
}

function generateFileUploadMethod(
  method: ServiceMethod,
  basePath: string,
  fileParams: FileParamInfo[],
): string {
  const allParams = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const nonFileParams = getNonFileParams(method);
  const returnType = `Promise<${method.returnType}>`;

  const lines: string[] = [];

  lines.push(`    const formData = new FormData();`);
  lines.push(``);

  fileParams.forEach((fp) => {
    if (fp.isArray) {
      lines.push(`    if (${fp.name} && Array.isArray(${fp.name})) {`);
      lines.push(`      ${fp.name}.forEach((file) => {`);
      lines.push(`        formData.append('${fp.name}', file);`);
      lines.push(`      });`);
      lines.push(`    }`);
    } else {
      lines.push(`    if (${fp.name}) {`);
      lines.push(`      formData.append('${fp.name}', ${fp.name});`);
      lines.push(`    }`);
    }
  });

  if (nonFileParams.length > 0) {
    lines.push(``);
    nonFileParams.forEach((p) => {
      lines.push(`    if (${p.name} !== undefined) {`);
      lines.push(
        `      formData.append('${p.name}', typeof ${p.name} === 'object' ? JSON.stringify(${p.name}) : String(${p.name}));`,
      );
      lines.push(`    }`);
    });
  }

  lines.push(``);
  lines.push(`    let headers = this.${method.name}Headers?.() || {};`);
  lines.push(``);
  lines.push(`    if(headers instanceof Promise) {`);
  lines.push(`      headers = await headers;`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(
    `    const response = await fetch(\`/api/${basePath}/${method.name}\`, {`,
  );
  lines.push(`      method: 'POST',`);
  lines.push(`      headers: {`);
  lines.push(`        ...headers`);
  lines.push(`      },`);
  lines.push(`      body: formData,`);
  lines.push(`    });`);
  lines.push(``);
  lines.push(`    if (!response.ok) {`);
  lines.push(
    `      throw new Error(\`HTTP error! status: \${response.status}\`);`,
  );
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    return response.json();`);

  return `  async ${method.name}(${allParams}): ${returnType} {
${lines.join("\n")}
  }`;
}

function generateSseMethod(method: ServiceMethod, basePath: string): string {
  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const hasParams = method.params.length > 0;

  let urlBuilder: string;
  const headerCheck = `this.${method.name}Headers`;

  if (hasParams) {
    const queryParams = method.params
      .map((p) => `${p.name}=\${encodeURIComponent(${p.name})}`)
      .join("&");
    urlBuilder = `\`/api/${basePath}/${method.name}?${queryParams}\``;
  } else {
    urlBuilder = `\`/api/${basePath}/${method.name}\``;
  }

  return `  ${method.name}(${params}): Observable<${method.returnType}> {
    return new Observable((observer) => {
      let url = ${urlBuilder};

      // Get headers and append them as query parameters for SSE
      const getHeaders = async () => {
        let headers = ${headerCheck}?.() || {};
        
        if (headers instanceof Promise) {
          headers = await headers;
        }

        // Convert headers to query parameters for EventSource
        const headerParams = new URLSearchParams();
        for (const [key, value] of Object.entries(headers)) {
          headerParams.append(key, String(value));
        }

        const headerString = headerParams.toString();
        if (headerString) {
          url += ${hasParams ? "`&${headerString}`" : "`?${headerString}`"};
        }

        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            observer.next(data);
          } catch (error) {
            observer.error?.(error);
          }
        };

        eventSource.onerror = (error) => {
          observer.error?.(error);
          eventSource.close();
        };

        return () => {
          eventSource.close();
        };
      };

      getHeaders().then((cleanup) => {
        // Store cleanup function for unsubscribe
        if (cleanup) {
          observer.add(cleanup);
        }
      }).catch((error) => {
        observer.error?.(error);
      });

      return () => {
        // Cleanup handled in getHeaders
      };
    });
  }`;
}

function generateGetMethod(method: ServiceMethod, basePath: string): string {
  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const returnType = `Promise<${method.returnType}>`;

  return `  async ${method.name}(${params}): ${returnType} {
    let headers = this.${method.name}Headers?.() || {};

    if(headers instanceof Promise) {
      headers = await headers;
    }

    const response = await fetch(\`/api/${basePath}/${method.name}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
}

function generatePostMethod(
  method: ServiceMethod,
  basePath: string,
  params: string,
): string {
  const paramNames = method.params.map((p) => p.name).join(", ");
  const returnType = `Promise<${method.returnType}>`;

  return `  async ${method.name}(${params}): ${returnType} {
    let headers = this.${method.name}Headers?.() || {};

    if(headers instanceof Promise) {
      headers = await headers;
    }

    const response = await fetch(\`/api/${basePath}/${method.name}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ ${paramNames} }),
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
}
