import {
  type ClassDeclaration,
  type Decorator,
  type Param,
  type ClassMethod,
  type TsType,
  type ClassProperty,
  type Constructor,
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
  decorators?: string[];
  lift: boolean;
  ast: any;
}

export interface MethodParam {
  name: string;
  type: string;
  decorators?: string[];
}

export interface ImportReference {
  identifier: string;
  source: string;
}

export interface ClassPropertyInfo {
  name: string;
  type: string;
  isReadonly: boolean;
  isStatic: boolean;
  accessibility?: "public" | "private" | "protected";
  decorators?: string[];
  hasInitializer: boolean;
  imports?: ImportReference[];
}

export interface ConstructorParam {
  name: string;
  type: string;
  accessibility?: "public" | "private" | "protected";
  isReadonly: boolean;
  decorators?: string[];
  imports?: ImportReference[];
}

export interface ServiceInfo {
  className: string;
  methods: ServiceMethod[];
  properties: ClassPropertyInfo[];
  constructorParams: ConstructorParam[];
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

export function isClassMethod(member: ClassMember): member is ClassMethod {
  return member.type === "ClassMethod";
}

export function isClassProperty(member: ClassMember): member is ClassProperty {
  return member.type === "ClassProperty";
}

export function isConstructor(member: ClassMember): member is Constructor {
  return member.type === "Constructor";
}

export function isPublicMethod(member: ClassMember): member is ClassMethod {
  return (
    member.type === "ClassMethod" &&
    (member.accessibility === "public" || member.accessibility === undefined)
  );
}

export function isPrivateMethod(member: ClassMember): member is ClassMethod {
  return member.type === "ClassMethod" && member.accessibility === "private";
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

function stringifyEntityName(node: any): string {
  if (!node) return "any";

  switch (node.type) {
    case "Identifier":
      return node.value;

    case "TsQualifiedName":
      return `${stringifyEntityName(node.left)}.${stringifyEntityName(
        node.right,
      )}`;

    default:
      return "any";
  }
}

export function stringifyType(node: TsType | undefined): string {
  if (!node) return "any";

  switch (node.type) {
    case "TsKeywordType":
      return node.kind;

    case "TsTypeReference": {
      const base = stringifyEntityName(node.typeName);
      const args = node.typeParams?.params
        ? `<${node.typeParams.params.map(stringifyType).join(", ")}>`
        : "";
      return base + args;
    }

    case "TsArrayType":
      return `${stringifyType(node.elemType)}[]`;

    case "TsUnionType":
      return node.types.map(stringifyType).join(" | ");

    case "TsIntersectionType":
      return node.types.map(stringifyType).join(" & ");

    case "TsTypeLiteral": {
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
    }

    default:
      return "any";
  }
}

export function stringifyDecorator(decorator: Decorator): string {
  const expr = decorator.expression;

  if (expr.type === "Identifier") {
    return `@${expr.value}`;
  }

  if (expr.type === "CallExpression" && expr.callee.type === "Identifier") {
    const args = expr.arguments
      .map((arg: any) => stringifyExpression(arg.expression))
      .join(", ");
    return args ? `@${expr.callee.value}(${args})` : `@${expr.callee.value}()`;
  }

  return "@Unknown";
}

export function shouldLiftDecorator(decoratorString: string): boolean {
  const match = decoratorString.match(/^@(_)?([A-Za-z0-9]+)/);
  if (!match) return false;

  const prefix = match[1];

  return !prefix;
}

export function extractMethodDecorators(method: ClassMethod): string[] {
  const decorators: string[] = [];

  if (method.function.decorators) {
    for (const decorator of method.function.decorators) {
      decorators.push(stringifyDecorator(decorator));
    }
  }

  return decorators;
}

export function extractParamDecorators(param: Param): string[] {
  const decorators: string[] = [];

  if ((param as any).decorators) {
    for (const decorator of (param as any).decorators) {
      decorators.push(stringifyDecorator(decorator));
    }
  }

  return decorators;
}

export function extractPropertyDecorators(property: ClassProperty): string[] {
  const decorators: string[] = [];

  if (property.decorators) {
    for (const decorator of property.decorators) {
      decorators.push(stringifyDecorator(decorator));
    }
  }

  return decorators;
}

export function extractMethodParams(params: Param[]): MethodParam[] {
  return params.map((p) => {
    const pat = (p as any).pat;

    if (pat.type !== "Identifier") {
      return {
        name: "param",
        type: "any",
        decorators: extractParamDecorators(p),
      };
    }

    return {
      name: pat.value,
      type: pat.typeAnnotation
        ? stringifyType(pat.typeAnnotation.typeAnnotation)
        : "any",
      decorators: extractParamDecorators(p),
    };
  });
}

// Helper function to extract identifiers from qualified names
function extractIdentifiersFromQualifiedName(node: any): string[] {
  const identifiers: string[] = [];

  if (node.type === "Identifier") {
    identifiers.push(node.value);
  } else if (node.type === "TsQualifiedName") {
    identifiers.push(...extractIdentifiersFromQualifiedName(node.left));
    identifiers.push(...extractIdentifiersFromQualifiedName(node.right));
  }

  return identifiers;
}

// Extract all identifiers from a type annotation
export function extractIdentifiersFromType(node: TsType | undefined): string[] {
  if (!node) return [];

  const identifiers: string[] = [];

  switch (node.type) {
    case "TsKeywordType":
      // Built-in types don't need imports
      return [];

    case "TsTypeReference": {
      // Extract the base type name
      if (node.typeName.type === "Identifier") {
        identifiers.push(node.typeName.value);
      } else if (node.typeName.type === "TsQualifiedName") {
        identifiers.push(...extractIdentifiersFromQualifiedName(node.typeName));
      }

      // Recursively extract from type parameters
      if (node.typeParams?.params) {
        for (const param of node.typeParams.params) {
          identifiers.push(...extractIdentifiersFromType(param));
        }
      }
      break;
    }

    case "TsArrayType":
      identifiers.push(...extractIdentifiersFromType(node.elemType));
      break;

    case "TsUnionType":
    case "TsIntersectionType":
      for (const type of node.types) {
        identifiers.push(...extractIdentifiersFromType(type));
      }
      break;

    case "TsTypeLiteral":
      // Extract from property types in object literals
      for (const member of node.members) {
        if (member.type === "TsPropertySignature" && member.typeAnnotation) {
          identifiers.push(
            ...extractIdentifiersFromType(member.typeAnnotation.typeAnnotation),
          );
        }
      }
      break;

    case "TsTupleType":
      if ((node as any).elemTypes) {
        for (const elem of (node as any).elemTypes) {
          identifiers.push(...extractIdentifiersFromType(elem));
        }
      }
      break;
  }

  return identifiers;
}

// Extract identifiers from decorator arguments
export function extractIdentifiersFromDecorator(
  decorator: Decorator,
): string[] {
  const identifiers: string[] = [];
  const expr = decorator.expression;

  // Add the decorator name itself
  if (expr.type === "Identifier") {
    identifiers.push(expr.value);
  } else if (expr.type === "CallExpression") {
    if (expr.callee.type === "Identifier") {
      identifiers.push(expr.callee.value);
    }

    // Extract identifiers from arguments
    for (const arg of expr.arguments) {
      identifiers.push(...extractIdentifiersFromExpression(arg.expression));
    }
  }

  return identifiers;
}

// Extract identifiers from any expression
function extractIdentifiersFromExpression(expr: any): string[] {
  if (!expr) return [];

  const identifiers: string[] = [];

  switch (expr.type) {
    case "Identifier":
      identifiers.push(expr.value);
      break;

    case "MemberExpression":
      identifiers.push(...extractIdentifiersFromExpression(expr.object));
      if (expr.property.type === "Identifier") {
        identifiers.push(expr.property.value);
      }
      break;

    case "CallExpression":
      identifiers.push(...extractIdentifiersFromExpression(expr.callee));
      for (const arg of expr.arguments) {
        identifiers.push(...extractIdentifiersFromExpression(arg.expression));
      }
      break;
  }

  return identifiers;
}

// Resolve imports for a list of identifiers
export function resolveImports(
  identifiers: string[],
  importMap: Record<string, string>,
): ImportReference[] {
  const imports: ImportReference[] = [];
  const seen = new Set<string>();

  for (const identifier of identifiers) {
    if (seen.has(identifier)) continue;

    const source = importMap[identifier];
    if (source) {
      imports.push({ identifier, source });
      seen.add(identifier);
    }
  }

  return imports;
}

export function extractClassProperties(
  classDecl: ClassDeclaration,
  importMap: Record<string, string>,
): ClassPropertyInfo[] {
  const properties: ClassPropertyInfo[] = [];

  if (!classDecl.body || !Array.isArray(classDecl.body)) {
    return properties;
  }

  for (const member of classDecl.body) {
    if (!isClassProperty(member)) continue;

    const property = member as ClassProperty;

    if (property.key.type !== "Identifier") continue;

    const propertyName = property.key.value;
    const propertyType = property.typeAnnotation
      ? stringifyType(property.typeAnnotation.typeAnnotation)
      : "any";

    // Collect all identifiers used by this property
    const identifiers: string[] = [];

    // From type annotation
    if (property.typeAnnotation) {
      identifiers.push(
        ...extractIdentifiersFromType(property.typeAnnotation.typeAnnotation),
      );
    }

    // From decorators
    if (property.decorators) {
      for (const decorator of property.decorators) {
        identifiers.push(...extractIdentifiersFromDecorator(decorator));
      }
    }

    // Resolve to imports
    const imports = resolveImports(identifiers, importMap);

    properties.push({
      name: propertyName,
      type: propertyType,
      isReadonly: property.readonly || false,
      isStatic: property.isStatic || false,
      accessibility: property.accessibility,
      decorators: extractPropertyDecorators(property),
      hasInitializer: !!property.value,
      imports,
    });
  }

  return properties;
}

export function extractConstructorParams(
  classDecl: ClassDeclaration,
  importMap: Record<string, string>,
): ConstructorParam[] {
  const params: ConstructorParam[] = [];

  if (!classDecl.body || !Array.isArray(classDecl.body)) {
    return params;
  }

  for (const member of classDecl.body) {
    if (!isConstructor(member)) continue;

    const constructor = member as Constructor;

    for (const param of constructor.params) {
      if (param.type === "TsParameterProperty") {
        const tsParam = param as any;
        const pat = tsParam.param;

        if (pat.type !== "Identifier") continue;

        // Collect all identifiers used by this parameter
        const identifiers: string[] = [];

        // From type annotation
        if (pat.typeAnnotation) {
          identifiers.push(
            ...extractIdentifiersFromType(pat.typeAnnotation.typeAnnotation),
          );
        }

        // From decorators
        if (tsParam.decorators) {
          for (const decorator of tsParam.decorators) {
            identifiers.push(...extractIdentifiersFromDecorator(decorator));
          }
        }

        // Resolve to imports
        const imports = resolveImports(identifiers, importMap);

        params.push({
          name: pat.value,
          type: pat.typeAnnotation
            ? stringifyType(pat.typeAnnotation.typeAnnotation)
            : "any",
          accessibility: tsParam.accessibility,
          isReadonly: tsParam.readonly || false,
          decorators: extractParamDecorators(tsParam),
          imports,
        });
      } else if (param.type === "Parameter") {
        const regularParam = param as any;
        const pat = regularParam.pat;

        if (pat.type !== "Identifier") continue;

        // Collect all identifiers used by this parameter
        const identifiers: string[] = [];

        // From type annotation
        if (pat.typeAnnotation) {
          identifiers.push(
            ...extractIdentifiersFromType(pat.typeAnnotation.typeAnnotation),
          );
        }

        // From decorators
        if (regularParam.decorators) {
          for (const decorator of regularParam.decorators) {
            identifiers.push(...extractIdentifiersFromDecorator(decorator));
          }
        }

        // Resolve to imports
        const imports = resolveImports(identifiers, importMap);

        params.push({
          name: pat.value,
          type: pat.typeAnnotation
            ? stringifyType(pat.typeAnnotation.typeAnnotation)
            : "any",
          accessibility: undefined,
          isReadonly: false,
          decorators: extractParamDecorators(regularParam),
          imports,
        });
      }
    }
  }

  return params;
}

export function extractSignature(
  decorators: Decorator[] | undefined,
  paramCount: number,
  className: string,
  methodName: string,
  filePath: string,
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
        stringifyExpression(arg.expression),
      );

      if (paramCount === 0 && args.length === 1) {
        return { paramSchemas: [], returnSchema: schemaStrings[0] };
      }

      if (args.length !== paramCount + 1) {
        console.warn(
          `Warning: Method ${className}.${methodName} has ${paramCount} parameter(s) but @Signature has ${
            args.length
          } argument(s). Expected ${
            paramCount + 1
          } (${paramCount} param schema(s) + 1 return schema).`,
        );
      }

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
  includeSignatures: boolean = true,
  includeHeaders: boolean = false,
): ServiceMethod[] {
  const methods: ServiceMethod[] = [];
  const className = classDecl.identifier?.value || "UnknownClass";

  if (!classDecl.body || !Array.isArray(classDecl.body)) {
    return methods;
  }

  for (const member of classDecl.body) {
    if (!isClassMethod(member)) continue;

    const method = member;
    const methodName = getMethodName(method);
    if (!methodName) continue;

    const endsWithHeaders = methodName.endsWith("Headers");

    const returnTypeInfo = analyzeReturnType(method);

    if (isPrivateMethod(member) && includeHeaders && endsWithHeaders) {
      methods.push({
        name: methodName,
        params: extractMethodParams(method.function.params),
        returnType: returnTypeInfo.type,
        isAsync: method.function.async,
        isStreamable: returnTypeInfo.isStreamable,
        streamType: returnTypeInfo.streamType,
        paramSchemas: [],
        returnSchema: undefined,
        decorators: undefined,
        lift: true,
        ast: method,
      });

      continue;
    }

    if (!isPublicMethod(member)) continue;

    if (!returnTypeInfo.isStreamable && !method.function.async) {
      throw {
        type: "validation",
        message: `Method ${className}.${methodName} must be async or return a streamable type (${RETURN_TYPE_CONFIGS.filter(
          (c) => c.isStreamable,
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
          method.function.params.length,
          className,
          methodName,
          filePath,
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
      decorators: extractMethodDecorators(method),
      lift: false,
      ast: method,
    });
  }

  return methods;
}

export function removeLiftedDecoratorsFromAST(ast: any): any {
  const clonedAst = JSON.parse(JSON.stringify(ast));

  for (const item of clonedAst.body) {
    if (
      item.type === "ExportDeclaration" &&
      item.declaration?.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration;
      if (hasInjectableDecorator(classDecl.decorators)) {
        for (const member of classDecl.body) {
          if (
            member.type === "ClassMethod" &&
            (member.accessibility === "public" ||
              member.accessibility === undefined)
          ) {
            const method = member as ClassMethod;

            if (method.function.decorators) {
              method.function.decorators = method.function.decorators.filter(
                (decorator) => {
                  const decoratorStr = stringifyDecorator(decorator);
                  return !shouldLiftDecorator(decoratorStr);
                },
              );

              if (method.function.decorators.length === 0) {
                delete method.function.decorators;
              }
            }
          }
        }
      }
    }
  }

  return clonedAst;
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
  filePath: string,
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
      `Warning: Service ${serviceInfo.className} has no public methods`,
    );
  }

  serviceInfo.methods.forEach((method) => {
    if (
      method.params.length > 0 &&
      method.paramSchemas?.length === 0 &&
      !method.returnSchema
    ) {
      console.warn(
        `Warning: Method ${serviceInfo.className}.${method.name} has ${method.params.length} parameter(s) but no @Signature validation`,
      );
    }
  });
}

export function extractServiceInfo(
  ast: any,
  filePath: string,
  includeSignatures: boolean = true,
  includeHeaders: boolean = false,
  includeFields: boolean = false,
): ServiceInfo | null {
  try {
    const serviceClass = findInjectableClass(ast);
    const importMap = extractImportMap(ast);

    if (!serviceClass?.identifier) {
      return null;
    }

    if (!serviceClass.body) {
      console.warn(
        `Warning: Service class ${serviceClass.identifier.value} has no body`,
      );
      return {
        className: serviceClass.identifier.value,
        methods: [],
        properties: [],
        constructorParams: [],
        hasInjectable: true,
        importMap,
      };
    }

    return {
      className: serviceClass.identifier.value,
      methods: extractMethods(
        serviceClass,
        filePath,
        includeSignatures,
        includeHeaders,
      ),
      properties: includeFields
        ? extractClassProperties(serviceClass, importMap)
        : [],
      constructorParams: includeFields
        ? extractConstructorParams(serviceClass, importMap)
        : [],
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
