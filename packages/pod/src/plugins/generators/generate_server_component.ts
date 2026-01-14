import { parseSync, printSync } from "@swc/core";
import type {
  ClassDeclaration,
  Decorator,
  ImportDeclaration,
  ModuleItem,
} from "@swc/core";

interface MethodParam {
  name: string;
  type: string;
}

interface ComponentMethod {
  name: string;
  params: MethodParam[];
  returnType: string;
  isAsync: boolean;
}

interface ClassStub {
  name: string;
  propsType: string;
  decorators: string[];
  constructorParams: string[];
  methods: ComponentMethod[];
}

interface ImportMap {
  [localName: string]: string;
}

export function generateServerComponent(
  filePath: string,
  code: string
): string {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true,
  });

  const importMap: ImportMap = {};
  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      const decl = item as ImportDeclaration;
      for (const specifier of decl.specifiers ?? []) {
        let localName: string;
        if (specifier.type === "ImportSpecifier") {
          localName = specifier.local.value;
        } else if (specifier.type === "ImportDefaultSpecifier") {
          localName = specifier.local.value;
        } else {
          continue;
        }
        importMap[localName] = decl.source.value;
      }
    }
  }

  const preservedNodes: ModuleItem[] = [];
  const stubbedClasses: ClassStub[] = [];

  for (const item of ast.body) {
    let shouldStub = false;

    if (
      item.type === "ExportDeclaration" &&
      item.declaration?.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration as ClassDeclaration;

      if (hasComponentDecorator(classDecl.decorators)) {
        shouldStub = true;
        const stub = extractClassStub(classDecl);
        if (stub) {
          stubbedClasses.push(stub);
        }
      }
    }

    if (!shouldStub) {
      preservedNodes.push(item);
    }
  }

  const preservedCode =
    preservedNodes.length > 0
      ? printSync({
          type: "Module",
          span: ast.span,
          body: preservedNodes,
          interpreter: ast.interpreter,
        }).code
      : "";

  const stubCode = stubbedClasses
    .map((stub) => generateStubCode(stub))
    .join("\n\n");

  return `
${preservedCode}
${stubCode}
  `.trim();
}

function hasComponentDecorator(decorators?: Decorator[]): boolean {
  if (!decorators) return false;

  return decorators.some((decorator) => {
    const expr = decorator.expression;

    if (expr.type === "CallExpression") {
      if (
        expr.callee.type === "Identifier" &&
        expr.callee.value === "Component"
      ) {
        return true;
      }
    }

    if (expr.type === "Identifier" && expr.value === "Component") {
      return true;
    }

    return false;
  });
}

function extractClassStub(classDecl: ClassDeclaration): ClassStub | null {
  const className = classDecl.identifier?.value;
  if (!className) return null;

  let propsType = "{}";
  const decorators: string[] = [];
  const constructorParams: string[] = [];

  if (classDecl.decorators) {
    for (const dec of classDecl.decorators) {
      const str = stringifyDecorator(dec);
      if (str) decorators.push(str);
    }
  }

  for (const member of classDecl.body) {
    if (member.type === "ClassProperty") {
      if (member.key.type === "Identifier" && member.key.value === "props") {
        propsType = extractPropsType(member);
      }
    } else if (member.type === "Constructor") {
      for (const param of member.params) {
        const paramStr = stringifyParam(param);
        if (paramStr) constructorParams.push(paramStr);
      }
    }
  }

  const methods = extractMethods(classDecl);

  return {
    name: className,
    propsType,
    decorators,
    constructorParams,
    methods,
  };
}

export function stringifyDecorator(decorator: Decorator): string {
  const exprCode = printSync({
    type: "Module",
    span: { start: 0, end: 0, ctxt: 0 },
    body: [
      {
        type: "ExpressionStatement",
        expression: decorator.expression,
        span: { start: 0, end: 0, ctxt: 0 },
      },
    ],
    interpreter: "",
  }).code;

  const cleanCode = exprCode.replace(/^#!.*\n/, "").trim();

  return `@${cleanCode.replace(/;$/, "")}`;
}

function extractPropsType(member: any): string {
  const typeAnn = member.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return "{}";

  if (typeAnn.type === "TsTypeLiteral") {
    const props: string[] = [];
    for (const m of typeAnn.members) {
      if (m.type === "TsPropertySignature") {
        const key = m.key.type === "Identifier" ? m.key.value : "?";
        const t = m.typeAnnotation
          ? stringifyType(m.typeAnnotation.typeAnnotation)
          : "any";
        props.push(`${key}: ${t}`);
      }
    }
    return `{ ${props.join("; ")} }`;
  }

  return stringifyType(typeAnn);
}

function stringifyParam(param: any): string {
  let decorators: string[] = [];
  if (param.decorators) {
    for (const d of param.decorators) {
      const str = stringifyDecorator(d);
      if (str) decorators.push(str);
    }
  }
  const decoratorPrefix = decorators.length ? decorators.join(" ") + " " : "";

  let typeName = "any";
  let paramName = "";
  let accessibility = "";

  if (param.type === "TsParameterProperty") {
    accessibility = param.accessibility || "";
    const inner = param.param;
    if (inner.type !== "Identifier") return "";

    paramName = inner.value;
    if (inner.typeAnnotation?.typeAnnotation) {
      typeName = extractTypeName(inner.typeAnnotation.typeAnnotation);
    }
  } else if (param.type === "Parameter") {
    const pat = param.pat;
    if (pat.type !== "Identifier") return "";

    paramName = pat.value;
    if (pat.typeAnnotation?.typeAnnotation) {
      typeName = extractTypeName(pat.typeAnnotation.typeAnnotation);
    }
  } else {
    return "";
  }

  const accessPrefix = accessibility ? `${accessibility} ` : "";
  const result = `${decoratorPrefix}${accessPrefix}${paramName}: ${typeName}`;

  return result;
}

function extractTypeName(typeNode: any): string {
  if (
    typeNode.type === "TsTypeReference" &&
    typeNode.typeName.type === "Identifier"
  ) {
    return typeNode.typeName.value;
  }
  return stringifyType(typeNode);
}

function extractMethods(classDecl: ClassDeclaration): ComponentMethod[] {
  const methods: ComponentMethod[] = [];

  for (const member of classDecl.body) {
    if (member.type === "ClassMethod") {
      const method = member as any;

      const methodName =
        method.key.type === "Identifier" ? method.key.value : "";

      if (!methodName) {
        continue;
      }

      const params = extractMethodParams(method.function.params || []);
      const returnType = extractReturnType(method.function.returnType);
      const isAsync = method.function.async || false;

      methods.push({
        name: methodName,
        params,
        returnType,
        isAsync,
      });
    }
  }

  return methods;
}

function extractMethodParams(params: any[]): MethodParam[] {
  const result: MethodParam[] = [];

  for (const param of params) {
    if (param.type === "Parameter") {
      const pat = param.pat as any;

      if (pat.type === "Identifier") {
        const name = pat.value;
        const type = pat.typeAnnotation?.typeAnnotation
          ? stringifyType(pat.typeAnnotation.typeAnnotation)
          : "any";

        result.push({
          name,
          type,
        });
      }
    }
  }

  return result;
}

function extractReturnType(returnType?: any): string {
  if (!returnType || !returnType.typeAnnotation) {
    return "any";
  }

  const type = returnType.typeAnnotation;

  if (type.type === "TsTypeReference") {
    const typeName = type.typeName;
    if (typeName.type === "Identifier" && typeName.value === "Promise") {
      if (type.typeParams && type.typeParams.params.length > 0) {
        return stringifyType(type.typeParams.params[0]);
      }
    }
  }

  return stringifyType(type);
}

function stringifyType(typeNode: any): string {
  if (!typeNode) return "any";

  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;

    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier") {
        const baseName = typeNode.typeName.value;
        if (typeNode.typeParams && typeNode.typeParams.params.length > 0) {
          const params = typeNode.typeParams.params
            .map(stringifyType)
            .join(", ");
          return `${baseName}<${params}>`;
        }
        return baseName;
      }
      return "any";

    case "TsArrayType":
      return `${stringifyType(typeNode.elemType)}[]`;

    case "TsUnionType":
      return typeNode.types.map(stringifyType).join(" | ");

    case "TsIntersectionType":
      return typeNode.types.map(stringifyType).join(" & ");

    case "TsTypeLiteral":
      const props = typeNode.members
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

function generateStubCode(stub: ClassStub): string {
  const className = stub.name;

  const build = stub.methods.find((p) => p.name == "build");

  if (build == undefined) {
    throw new Error("Component has no build function");
  }

  const decoratorsStr =
    stub.decorators.length > 0 ? stub.decorators.join("\n") + "\n" : "";

  return `import { 
  Inject as _Inject, 
  getCurrentInjector as _getCurrentInjector, 
  OrcaComponent as _OrcaComponent,
  JSX as _JSX,
  OSC as _OSC,
  HttpClient as _HttpClient,
  symbolValueReviver as _symbolValueReviver
} from "@kithinji/orca";


${decoratorsStr}export class ${className} extends _OrcaComponent {
    props!: any;

    constructor(
      @_Inject("OSC_URL", { maybe: true }) private oscUrl?: string,
      private readonly http: _HttpClient,
      ${stub.constructorParams.join(", ")}
    ) {
      super();

      if(this.oscUrl === undefined) {
        throw new Error("Server component requires osc url be defined");
      }  
    }

    build() {
        const root = document.createElement("div");
        root.textContent = "loading...";

        const injector = _getCurrentInjector();

        if(injector == null) {
          throw new Error("Injector is null");
        }

        const osc = new _OSC(root);

        const subscription = this.http.post<_JSX.Element>(
          \`\${this.oscUrl}?c=${className}\`, {
            body: this.props,
            reviver: _symbolValueReviver,
          }
        ).subscribe((jsx: _JSX.Element) => {
          const action = jsx.action || "insert";

          if (action === "insert") {
            osc.handleInsert(jsx);
          } else if (action === "update") {
            osc.handleUpdate(jsx);
          } else {
            console.warn(\`Unknown action: \${action}\`);
          }
        });

        this.pushDrop(() => subscription.unsubscribe());

        return root;
    }
}`;
}
