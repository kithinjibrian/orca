import {
  type ClassDeclaration,
  type Decorator,
  type Param,
  type ClassMethod,
  type TsType,
  parseSync,
  ClassMember,
  ImportDeclaration,
} from "@swc/core";

export interface ServiceMethod {
  name: string;
  params: MethodParam[];
  returnType: string;
  isAsync: boolean;
  isStreamable: boolean;
  streamType?: StreamType;
  paramSchemas: string[];
  returnSchema?: string;
}

export interface MethodParam {
  name: string;
  type: string;
  decorators?: string[];
}

export interface ServiceInfo {
  className: string;
  methods: ServiceMethod[];
  hasInjectable: boolean;
  importMap: Record<string, string>;
}

export interface GenerationError {
  type: "parse" | "validation" | "generation";
  message: string;
  filePath: string;
  details?: any;
}

export enum StreamType {
  Observable = "Observable",
}

export interface ReturnTypeConfig {
  typeName: string;
  isStreamable: boolean;
  streamType?: StreamType;
  decoratorName: string;
  isSubjectLike: boolean;
}

export interface ReturnTypeInfo {
  type: string;
  isStreamable: boolean;
  streamType?: StreamType;
  isSubjectLike: boolean;
}

export const RETURN_TYPE_CONFIGS: ReturnTypeConfig[] = [
  {
    typeName: "Observable",
    isStreamable: true,
    streamType: StreamType.Observable,
    decoratorName: "Sse",
    isSubjectLike: false,
  },
  {
    typeName: "Promise",
    isStreamable: false,
    decoratorName: "Post",
    isSubjectLike: false,
  },
];

export function parseTypeScript(filePath: string, code: string) {
  return parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x") || filePath.endsWith(".tsx"),
    decorators: true,
  });
}

export function hasInjectableDecorator(decorators?: Decorator[]): boolean {
  if (!decorators) return false;

  return decorators.some((d) => {
    const expr = d.expression;
    return (
      (expr.type === "Identifier" && expr.value === "Injectable") ||
      (expr.type === "CallExpression" &&
        expr.callee.type === "Identifier" &&
        expr.callee.value === "Injectable")
    );
  });
}

export function isPublicMethod(member: ClassMember): member is ClassMethod {
  return (
    member.type === "ClassMethod" &&
    (member.accessibility === "public" || !member.accessibility)
  );
}

export function getMethodName(method: ClassMethod): string | null {
  if (method.key.type === "Identifier") {
    return method.key.value;
  }
  return null;
}

export function extractImportMap(ast: any): Record<string, string> {
  const importMap: Record<string, string> = {};

  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      const decl = item as ImportDeclaration;
      const source = decl.source.value;
      decl.specifiers.forEach((spec) => {
        if (
          spec.type === "ImportSpecifier" ||
          spec.type === "ImportDefaultSpecifier" ||
          spec.type === "ImportNamespaceSpecifier"
        ) {
          importMap[spec.local.value] = source;
        }
      });
    }
  }

  return importMap;
}

export function findInjectableClass(ast: any): ClassDeclaration | null {
  for (const item of ast.body) {
    if (
      item.type === "ExportDeclaration" &&
      item.declaration?.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration as ClassDeclaration;
      if (hasInjectableDecorator(classDecl.decorators)) {
        return classDecl;
      }
    }
  }
  return null;
}

export function analyzeReturnType(method: ClassMethod): ReturnTypeInfo {
  const returnType = method.function.returnType?.typeAnnotation;

  if (!returnType) {
    return {
      type: "any",
      isStreamable: false,
      isSubjectLike: false,
    };
  }

  if (
    returnType.type === "TsTypeReference" &&
    returnType.typeName.type === "Identifier"
  ) {
    const typeName = returnType.typeName.value;
    const config = RETURN_TYPE_CONFIGS.find((c) => c.typeName === typeName);

    if (config) {
      const innerType = returnType.typeParams?.params[0];
      return {
        type: innerType ? stringifyType(innerType) : "any",
        isStreamable: config.isStreamable,
        streamType: config.streamType,
        isSubjectLike: config.isSubjectLike,
      };
    }
  }

  return {
    type: stringifyType(returnType),
    isStreamable: false,
    isSubjectLike: false,
  };
}

export function stringifyType(node: TsType | undefined): string {
  if (!node) return "any";

  switch (node.type) {
    case "TsKeywordType":
      return node.kind;

    case "TsTypeReference":
      if (node.typeName.type !== "Identifier") return "any";
      const base = node.typeName.value;
      const args = node.typeParams?.params
        ? `<${node.typeParams.params.map(stringifyType).join(", ")}>`
        : "";
      return base + args;

    case "TsArrayType":
      return `${stringifyType(node.elemType)}[]`;

    case "TsUnionType":
      return node.types.map(stringifyType).join(" | ");

    case "TsIntersectionType":
      return node.types.map(stringifyType).join(" & ");

    case "TsTypeLiteral":
      const props = node.members
        .map((member: any) => {
          if (member.type === "TsPropertySignature") {
            const key =
              member.key.type === "Identifier" ? member.key.value : "";
            const type = member.typeAnnotation
              ? stringifyType(member.typeAnnotation.typeAnnotation)
              : "any";
            return `${key}: ${type}`;
          }
          return "";
        })
        .filter(Boolean);
      return `{ ${props.join("; ")} }`;

    default:
      return "any";
  }
}

export function extractMethodParams(params: Param[]): MethodParam[] {
  return params.map((p) => {
    const pat = (p as any).pat;

    if (pat.type !== "Identifier") {
      return {
        name: "param",
        type: "any",
        decorators: [],
      };
    }

    return {
      name: pat.value,
      type: pat.typeAnnotation
        ? stringifyType(pat.typeAnnotation.typeAnnotation)
        : "any",
      decorators: [],
    };
  });
}

export function extractSignature(
  decorators: Decorator[] | undefined,
  paramCount: number
) {
  if (!decorators) return { paramSchemas: [] };

  for (const decorator of decorators) {
    const expr = decorator.expression;
    if (
      expr.type === "CallExpression" &&
      expr.callee.type === "Identifier" &&
      expr.callee.value === "Signature"
    ) {
      const args = expr.arguments;
      if (args.length === 0) return { paramSchemas: [] };

      const schemaStrings = args.map((arg) =>
        stringifyExpression(arg.expression)
      );

      if (args.length === 1) {
        return { paramSchemas: [], returnSchema: schemaStrings[0] };
      }

      return {
        paramSchemas: schemaStrings.slice(0, -1),
        returnSchema: schemaStrings[schemaStrings.length - 1],
      };
    }
  }
  return { paramSchemas: [] };
}

function stringifyExpression(expr: any): string {
  if (!expr) return "any";

  if (expr.type === "Identifier") {
    return expr.value;
  }

  if (expr.type === "MemberExpression") {
    const object = stringifyExpression(expr.object);
    const property = expr.property.value || stringifyExpression(expr.property);
    return `${object}.${property}`;
  }

  if (expr.type === "CallExpression") {
    const args = expr.arguments
      .map((a: any) => stringifyExpression(a.expression))
      .join(", ");
    return `${stringifyExpression(expr.callee)}(${args})`;
  }

  return "any";
}

export function extractMethods(
  classDecl: ClassDeclaration,
  filePath: string,
  includeSignatures: boolean = true
): ServiceMethod[] {
  const methods: ServiceMethod[] = [];
  const className = classDecl.identifier?.value || "UnknownClass";

  for (const member of classDecl.body) {
    if (!isPublicMethod(member)) continue;

    const method = member as ClassMethod;
    const methodName = getMethodName(method);
    if (!methodName) continue;

    const returnTypeInfo = analyzeReturnType(method);

    if (!returnTypeInfo.isStreamable && !method.function.async) {
      throw {
        type: "validation",
        message: `Method ${className}.${methodName} must be async or return a streamable type (${RETURN_TYPE_CONFIGS.filter(
          (c) => c.isStreamable
        )
          .map((c) => c.typeName)
          .join(", ")})`,
        filePath,
        details: { className, methodName },
      } as GenerationError;
    }

    const signatures = includeSignatures
      ? extractSignature(
          method.function.decorators,
          method.function.params.length
        )
      : { paramSchemas: [] };

    methods.push({
      name: methodName,
      params: extractMethodParams(method.function.params),
      returnType: returnTypeInfo.type,
      isAsync: method.function.async,
      isStreamable: returnTypeInfo.isStreamable,
      streamType: returnTypeInfo.streamType,
      paramSchemas: signatures.paramSchemas,
      returnSchema: signatures.returnSchema,
    });
  }

  return methods;
}

export function serviceNameToPath(serviceName: string): string {
  return serviceName
    .replace(/Service$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function toInstanceName(className: string): string {
  return className.charAt(0).toLowerCase() + className.slice(1);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function validateServiceInfo(
  serviceInfo: ServiceInfo,
  filePath: string
): void {
  if (!serviceInfo.className) {
    throw {
      type: "validation",
      message: "Service class must have a valid name",
      filePath,
    } as GenerationError;
  }

  if (serviceInfo.methods.length === 0) {
    console.warn(
      `Warning: Service ${serviceInfo.className} has no public methods`
    );
  }

  serviceInfo.methods.forEach((method) => {
    if (method.params.length > 0 && method.paramSchemas?.length === 0) {
      console.warn(
        `Warning: Method ${serviceInfo.className}.${method.name} has parameters but no @Signature validation`
      );
    }
  });
}

export function extractServiceInfo(
  ast: any,
  filePath: string,
  includeSignatures: boolean = true
): ServiceInfo | null {
  try {
    const serviceClass = findInjectableClass(ast);
    const importMap = extractImportMap(ast);

    if (!serviceClass?.identifier) {
      return null;
    }

    return {
      className: serviceClass.identifier.value,
      methods: extractMethods(serviceClass, filePath, includeSignatures),
      hasInjectable: true,
      importMap,
    };
  } catch (error) {
    throw {
      type: "parse",
      message: `Failed to extract service info: ${(error as Error).message}`,
      filePath,
      details: error,
    } as GenerationError;
  }
}
