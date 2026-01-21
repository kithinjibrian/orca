import { MacroContext } from "@kithinji/pod";
import ts from "typescript";
import { MapNamespaces } from "./style_types";

const UNITLESS_PROPS = new Set([
  "z-index",
  "opacity",
  "flex-grow",
  "flex-shrink",
  "flex",
  "order",
  "font-weight",
  "line-height",
  "zoom",
  "column-count",
  "animation-iteration-count",
  "grid-column",
  "grid-row",
  "grid-column-start",
  "grid-column-end",
  "grid-row-start",
  "grid-row-end",
  "tab-size",
  "counter-increment",
  "counter-reset",
  "orphans",
  "widows",
]);

const DEV_MODE = process.env.NODE_ENV === "development";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36).padStart(8, "0").slice(0, 8);
}

function hashProperty(
  prop: string,
  value: string | number,
  cssRules: Map<string, string>,
): string {
  const input = `${prop}:${value}`;
  let hash = simpleHash(input);
  let className: string;

  if (DEV_MODE) {
    // Add readable hint in development
    const hint = prop
      .replace(/[^a-z]/gi, "")
      .slice(0, 3)
      .toLowerCase();
    className = `a-${hint}-${hash}`;
  } else {
    className = `a-${hash}`;
  }

  let attempt = 0;

  // Handle hash collisions
  while (cssRules.has(className)) {
    const existing = cssRules.get(className)!;
    const kebabProp = toKebabCase(prop);
    const normalizedValue = normalizeValue(prop, value);
    const expectedRule = `.${className} { ${kebabProp}: ${normalizedValue}; }`;

    // If the existing rule matches, it's the same style (deduplication)
    if (existing.includes(`${kebabProp}: ${normalizedValue}`)) {
      break;
    }

    // Collision detected, rehash
    hash = simpleHash(`${input}-${++attempt}`);
    className = DEV_MODE ? `a-${prop.slice(0, 3)}-${hash}` : `a-${hash}`;

    if (attempt > 100) {
      throw new Error(
        `Hash collision limit exceeded for property ${prop}:${value}`,
      );
    }
  }

  return className;
}

function toKebabCase(str: string): string {
  // Handle vendor prefixes (webkit, moz, ms)
  if (str.match(/^(webkit|moz|ms)[A-Z]/)) {
    return "-" + str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  // Handle CSS custom properties
  if (str.startsWith("--")) {
    return str;
  }

  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function normalizeValue(prop: string, value: string | number): string {
  if (typeof value === "number") {
    const kebabProp = toKebabCase(prop);

    if (UNITLESS_PROPS.has(kebabProp)) {
      return String(value);
    }

    return `${value}px`;
  }

  return String(value);
}

function isPseudoOrMediaKey(key: string): boolean {
  return key.startsWith(":") || key.startsWith("@") || key.startsWith("&");
}

function validateStyleValue(value: any, path: string): void {
  if (value === null) {
    throw new Error(
      `Invalid style value at ${path}: null is not allowed. Use undefined or omit the property.`,
    );
  }

  if (typeof value === "function") {
    throw new Error(
      `Invalid style value at ${path}: functions must be resolved at build time.`,
    );
  }
}

function processStyleValue(
  prop: string,
  value: any,
  cssRules: Map<string, string>,
  path: string = prop,
): string {
  validateStyleValue(value, path);

  if (prop.startsWith("--")) {
    const className = hashProperty(prop, value, cssRules);
    if (!cssRules.has(className)) {
      const cssRule = `.${className} { ${prop}: ${value}; }`;
      cssRules.set(className, cssRule);
    }
    return className;
  }

  const kebabProp = toKebabCase(prop);

  // Handle nested objects for pseudo-classes, media queries, etc.
  if (typeof value === "object" && !Array.isArray(value)) {
    const classes: string[] = [];

    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      validateStyleValue(nestedValue, `${path}.${nestedKey}`);

      if (nestedKey === "default") {
        const normalizedValue = normalizeValue(
          prop,
          nestedValue as string | number,
        );
        const className = hashProperty(prop, normalizedValue, cssRules);

        if (!cssRules.has(className)) {
          const cssRule = `.${className} { ${kebabProp}: ${normalizedValue}; }`;
          cssRules.set(className, cssRule);
        }

        classes.push(className);
      } else if (isPseudoOrMediaKey(nestedKey)) {
        const normalizedValue = normalizeValue(
          prop,
          nestedValue as string | number,
        );
        const className = hashProperty(
          `${prop}${nestedKey}`,
          normalizedValue,
          cssRules,
        );

        if (!cssRules.has(className)) {
          let cssRule: string;

          if (nestedKey.startsWith("@")) {
            // Media query
            cssRule = `${nestedKey} { .${className} { ${kebabProp}: ${normalizedValue}; } }`;
          } else if (nestedKey.startsWith("&")) {
            // Nesting selector (e.g., &:hover, & > div)
            const selector = nestedKey.slice(1);
            cssRule = `.${className}${selector} { ${kebabProp}: ${normalizedValue}; }`;
          } else {
            // Pseudo-class/element (e.g., :hover, ::before)
            cssRule = `.${className}${nestedKey} { ${kebabProp}: ${normalizedValue}; }`;
          }

          cssRules.set(className, cssRule);
        }

        classes.push(className);
      } else {
        throw new Error(
          `Invalid nested key "${nestedKey}" at ${path}. Expected "default", a pseudo-class (":hover"), media query ("@media"), or nesting selector ("&").`,
        );
      }
    }

    return classes.join(" ");
  }

  const normalizedValue = normalizeValue(prop, value);
  const className = hashProperty(prop, normalizedValue, cssRules);

  if (!cssRules.has(className)) {
    const cssRule = `.${className} { ${kebabProp}: ${normalizedValue}; }`;
    cssRules.set(className, cssRule);
  }

  return className;
}

function processStyleObject(
  styleObj: Record<string, any>,
  cssRules: Map<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [namespace, styles] of Object.entries(styleObj)) {
    if (typeof styles !== "object" || Array.isArray(styles)) {
      throw new Error(
        `Invalid style namespace "${namespace}": expected an object, got ${typeof styles}`,
      );
    }

    const classes: string[] = [];

    for (const [prop, value] of Object.entries(styles)) {
      if (value === undefined) continue;

      const className = processStyleValue(
        prop,
        value,
        cssRules,
        `${namespace}.${prop}`,
      );

      if (className) {
        classes.push(className);
      }
    }

    result[namespace] = classes.filter(Boolean).join(" ");
  }

  return result;
}

export function style$<const T extends Record<string, any>>(
  style: T,
  context?: MacroContext,
): MapNamespaces<T> {
  if (!context) {
    throw new Error(
      "style$ macro requires MacroContext. Ensure you're using this as a build-time macro.",
    );
  }

  const rStyle = style as unknown as ts.Node;
  const value = context.resolveNodeValue(rStyle);

  if (value == undefined) {
    throw new Error(
      `Could not resolve style object at build time. ` +
        `Ensure all values are statically analyzable (no runtime expressions, dynamic imports should be inlined).`,
    );
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `style$ expects an object with style namespaces, got ${typeof value}`,
    );
  }

  const cssRules = new Map<string, string>();
  const classNameMap = processStyleObject(value, cssRules);

  context.store.set("style_rules", Array.from(cssRules.values()));

  const properties = Object.entries(classNameMap).map(([key, className]) =>
    context.factory.createPropertyAssignment(
      context.factory.createStringLiteral(key),
      context.factory.createStringLiteral(className),
    ),
  );

  return context.factory.createObjectLiteralExpression(properties, true) as any;
}

type Fragment =
  | { kind: "static"; value: string }
  | { kind: "dynamic"; expr: ts.Expression; stringSafe: boolean };

export function apply$(...c: any[]) {
  if (c.length < 1) {
    throw new Error("apply$ requires at least one argument plus MacroContext");
  }

  const context = c.pop() as MacroContext;

  if (!context || !context.factory) {
    throw new Error(
      "apply$ macro requires MacroContext as the last argument. Ensure you're using this as a build-time macro.",
    );
  }

  const args = c as ts.Expression[];

  if (args.length === 0) {
    return context.factory.createObjectLiteralExpression(
      [
        context.factory.createPropertyAssignment(
          context.factory.createIdentifier("className"),
          context.factory.createStringLiteral(""),
        ),
      ],
      false,
    );
  }

  const f = context.factory;

  function isTrue(e: ts.Expression): boolean {
    return e.kind === ts.SyntaxKind.TrueKeyword;
  }

  function isFalse(e: ts.Expression): boolean {
    return e.kind === ts.SyntaxKind.FalseKeyword;
  }

  function isEmptyString(e: ts.Expression): boolean {
    return ts.isStringLiteral(e) && e.text === "";
  }

  function tryResolveStatic(expr: ts.Expression): string | null {
    // Try to resolve string literals directly
    if (ts.isStringLiteral(expr)) {
      return expr.text;
    }

    // Try to resolve property access chains (e.g., classes.button)
    if (!ts.isPropertyAccessExpression(expr)) return null;

    const chain: string[] = [];
    let cur: ts.Expression = expr;

    while (ts.isPropertyAccessExpression(cur)) {
      chain.unshift(cur.name.text);
      cur = cur.expression;
    }

    if (!ts.isIdentifier(cur)) return null;
    chain.unshift(cur.text);

    const root = context.resolveIdentifier(f.createIdentifier(chain[0]));
    let value = context.resolveNodeValue(root);

    if (value == null) return null;

    for (let i = 1; i < chain.length; i++) {
      if (typeof value !== "object" || !(chain[i] in value)) {
        return null;
      }
      value = value[chain[i]];
    }

    return typeof value === "string" ? value : null;
  }

  function build(expr: ts.Expression): Fragment {
    // Handle empty strings
    if (isEmptyString(expr)) {
      return { kind: "static", value: "" };
    }

    // Try static resolution first
    const s = tryResolveStatic(expr);
    if (s != null) {
      return { kind: "static", value: s };
    }

    // Handle: condition && "class"
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      if (isTrue(expr.left)) return build(expr.right);
      if (isFalse(expr.left)) return { kind: "static", value: "" };

      const rs = tryResolveStatic(expr.right);
      if (rs != null) {
        // Optimize to: ["", "class"][+condition]
        return {
          kind: "dynamic",
          stringSafe: true,
          expr: f.createElementAccessExpression(
            f.createArrayLiteralExpression([
              f.createStringLiteral(""),
              f.createStringLiteral(rs),
            ]),
            f.createPrefixUnaryExpression(ts.SyntaxKind.PlusToken, expr.left),
          ),
        };
      }

      return { kind: "dynamic", expr, stringSafe: false };
    }

    // Handle: condition ? "a" : "b"
    if (ts.isConditionalExpression(expr)) {
      if (isTrue(expr.condition)) return build(expr.whenTrue);
      if (isFalse(expr.condition)) return build(expr.whenFalse);

      const t = tryResolveStatic(expr.whenTrue);
      const fv = tryResolveStatic(expr.whenFalse);

      if (t != null && fv != null) {
        // Optimize to: ["b", "a"][+condition]
        return {
          kind: "dynamic",
          stringSafe: true,
          expr: f.createElementAccessExpression(
            f.createArrayLiteralExpression([
              f.createStringLiteral(fv),
              f.createStringLiteral(t),
            ]),
            f.createPrefixUnaryExpression(
              ts.SyntaxKind.PlusToken,
              expr.condition,
            ),
          ),
        };
      }

      return { kind: "dynamic", expr, stringSafe: false };
    }

    return { kind: "dynamic", expr, stringSafe: false };
  }

  // Build and merge fragments
  const frags: Fragment[] = [];

  for (const arg of args) {
    const frag = build(arg);

    // Skip empty static values
    if (frag.kind === "static" && frag.value === "") {
      continue;
    }

    const last = frags[frags.length - 1];

    // Merge consecutive static fragments
    if (frag.kind === "static" && last?.kind === "static") {
      last.value += " " + frag.value;
    } else {
      frags.push(frag);
    }
  }

  // Generate final className expression
  let classExpr: ts.Expression;

  if (frags.length === 0) {
    // All classes were empty
    classExpr = f.createStringLiteral("");
  } else if (frags.every((f) => f.kind === "static")) {
    // All static - compile to single string
    classExpr = f.createStringLiteral(
      frags
        .map((f) => f.value)
        .join(" ")
        .trim(),
    );
  } else {
    // Mixed static/dynamic - generate array.join(" ")
    classExpr = f.createCallExpression(
      f.createPropertyAccessExpression(
        f.createArrayLiteralExpression(
          frags.map((frag) => {
            if (frag.kind === "static") {
              return f.createStringLiteral(frag.value);
            }
            if (frag.stringSafe) {
              return frag.expr;
            }
            // Wrap unsafe expressions in conditional: expr ? expr : ""
            return f.createConditionalExpression(
              frag.expr,
              undefined,
              frag.expr,
              undefined,
              f.createStringLiteral(""),
            );
          }),
        ),
        "join",
      ),
      undefined,
      [f.createStringLiteral(" ")],
    );
  }

  return f.createObjectLiteralExpression(
    [f.createPropertyAssignment(f.createIdentifier("className"), classExpr)],
    false,
  );
}
