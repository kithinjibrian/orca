import * as path from "path";
import { createHash } from "crypto";
import { parseSync, printSync } from "@swc/core";
import type {
  ModuleItem,
  ClassDeclaration,
  Decorator,
  ImportDeclaration,
} from "@swc/core";

interface ClassStub {
  name: string;
  propsType: string;
  decorators: string[];
  constructorParams: string[];
}

interface ImportMap {
  [localName: string]: string;
}

export function generateServerStub(filePath: string, code: string): string {
  const hash = createHash("md5").update(filePath).digest("hex").slice(0, 8);
  const relativeFromSrc = filePath.split("/src/")[1];
  const parsed = path.parse(relativeFromSrc);

  const fileName = path.join("src", parsed.dir, parsed.name);

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
    .map((stub) => generateClassCode(stub, hash, fileName))
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
    if (expr.type === "Identifier" && expr.value === "Component") {
      return true;
    }
    if (
      expr.type === "CallExpression" &&
      expr.callee.type === "Identifier" &&
      expr.callee.value === "Component"
    ) {
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

  return {
    name: className,
    propsType,
    decorators,
    constructorParams,
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

function stringifyType(typeNode: any): string {
  if (!typeNode) return "any";

  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;
    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier")
        return typeNode.typeName.value;
      if (typeNode.typeName.type === "TsQualifiedName") {
        return `${stringifyQualifiedName(typeNode.typeName.left)}.${
          typeNode.typeName.right.value
        }`;
      }
      return "any";
    case "TsArrayType":
      return `${stringifyType(typeNode.elemType)}[]`;
    case "TsUnionType":
      return typeNode.types.map(stringifyType).join(" | ");
    case "TsIntersectionType":
      return typeNode.types.map(stringifyType).join(" & ");
    default:
      return "any";
  }
}

function stringifyQualifiedName(node: any): string {
  if (node.type === "Identifier") return node.value;
  if (node.type === "TsQualifiedName") {
    return `${stringifyQualifiedName(node.left)}.${node.right.value}`;
  }
  return "any";
}

function generateClassCode(
  stub: ClassStub,
  hash: string,
  fileName: string
): string {
  const clientId = `${stub.name}_${hash}`;
  const clientPath = `/${fileName}.js`;
  const decoratorsStr =
    stub.decorators.length > 0 ? stub.decorators.join("\n") + "\n" : "";

  const constructorStr = stub.constructorParams.length
    ? `constructor(${stub.constructorParams.join(", ")}) {}`
    : "constructor() {}";

  return `
${decoratorsStr}export class ${stub.name} {
  props!: ${stub.propsType};
  ${constructorStr}
  build() {
    const inputProps = { ...this.props };
    return {
      $$typeof: Symbol.for("orca.client.component"),
      id: "${clientId}_" + Math.random().toString(36).slice(2, 9),
      type: "${stub.name}",
      props: {
        ...inputProps,
        __clientComponent: {
          id: "${clientId}",
          path: "${clientPath}",
          name: "${stub.name}",
        }
      },
      key: null
    };
  }
}
`.trim();
}
