import {
  extractServiceInfo,
  GenerationError,
  parseTypeScript,
  ServiceInfo,
  ServiceMethod,
  serviceNameToPath,
  validateServiceInfo,
} from "./utils";

export function generateRpcStub(filePath: string, code: string): string {
  try {
    const ast = parseTypeScript(filePath, code);
    const serviceInfo = extractServiceInfo(ast, filePath, false);

    if (!serviceInfo) {
      throw {
        type: "validation",
        message: "No exported class with @Injectable decorator found",
        filePath,
      } as GenerationError;
    }

    validateServiceInfo(serviceInfo, filePath);
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

function generateStubCode(serviceInfo: ServiceInfo): string {
  const className = serviceInfo.className;
  const basePath = serviceNameToPath(className);

  const methods = serviceInfo.methods
    .map((method) => generateMethod(method, basePath, className))
    .join("\n\n");

  const hasStreamable = serviceInfo.methods.some((m) => m.isStreamable);

  const imports = generateImports(hasStreamable);

  return `${imports}

@Injectable()
export class ${className} {
${methods}
}`;
}

function generateImports(hasStreamable: boolean): string {
  let imports = `import { Injectable } from "@kithinji/orca";\n`;

  if (hasStreamable) {
    imports += `import { Observable } from "@kithinji/orca";\n`;
  }

  return imports;
}

function generateMethod(
  method: ServiceMethod,
  basePath: string,
  serviceName: string
): string {
  if (method.isStreamable) {
    return generateSseMethod(method, basePath);
  }

  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const hasParams = method.params.length > 0;

  if (!hasParams) {
    return generateGetMethod(method, basePath);
  }

  return generatePostMethod(method, basePath, params);
}

function generateSseMethod(method: ServiceMethod, basePath: string): string {
  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const hasParams = method.params.length > 0;

  let urlBuilder: string;
  if (hasParams) {
    const queryParams = method.params
      .map((p) => `${p.name}=\${encodeURIComponent(${p.name})}`)
      .join("&");
    urlBuilder = `\`/${basePath}/${method.name}?${queryParams}\``;
  } else {
    urlBuilder = `\`/${basePath}/${method.name}\``;
  }

  return `  ${method.name}(${params}): Observable<${method.returnType}> {
    return new Observable((observer) => {
      const eventSource = new EventSource(${urlBuilder});

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
    });
  }`;
}

function generateGetMethod(method: ServiceMethod, basePath: string): string {
  const params = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  const returnType = `Promise<${method.returnType}>`;

  return `  async ${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${basePath}/${method.name}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
  params: string
): string {
  const paramNames = method.params.map((p) => p.name).join(", ");
  const returnType = `Promise<${method.returnType}>`;

  return `  async ${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${basePath}/${method.name}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ${paramNames} }),
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
}
