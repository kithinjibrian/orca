import type { PluginObj, NodePath } from "@babel/core";
import * as BabelTypes from "@babel/types";

interface PluginContext {
  types: typeof BabelTypes;
}

interface PluginState {
  helpersImported?: boolean;
}

interface TransformContext {
  signals: Map<string, BabelTypes.Identifier>;
}

interface TransformResult {
  id: BabelTypes.Identifier;
  statements: BabelTypes.Statement[];
}

class NodeTypeGuards {
  constructor(private t: typeof BabelTypes) {}

  isSignalMember(expr: BabelTypes.Node): expr is BabelTypes.MemberExpression {
    return (
      this.t.isMemberExpression(expr) &&
      this.t.isIdentifier(expr.property, { name: "value" })
    );
  }
}

class ASTUtilities {
  constructor(private t: typeof BabelTypes, private guards: NodeTypeGuards) {}

  getObject(expr: BabelTypes.Expression): BabelTypes.Expression {
    if (this.guards.isSignalMember(expr)) {
      return expr.object as BabelTypes.Expression;
    }
    return expr;
  }

  replaceThisWithSelf<T extends BabelTypes.Node>(node: T): T {
    const cloned = this.t.cloneNode(node, true) as T;
    this.walkAndTransform(cloned, (n: any) => {
      if (this.t.isThisExpression(n)) {
        Object.assign(n, this.t.identifier("self"));
      }
    });
    return cloned;
  }

  private walkAndTransform(node: any, transform: (node: any) => void): void {
    if (!node || typeof node !== "object") return;

    transform(node);

    for (const key in node) {
      if (this.shouldSkipKey(key)) continue;

      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach((item) => this.walkAndTransform(item, transform));
      } else if (value && typeof value === "object") {
        this.walkAndTransform(value, transform);
      }
    }
  }

  private shouldSkipKey(key: string): boolean {
    return ["loc", "start", "end", "extra"].includes(key);
  }

  buildMemberExpression(name: string): BabelTypes.Expression {
    const parts = name.split(".");
    let expr: BabelTypes.Expression = this.t.identifier(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      expr = this.t.memberExpression(expr, this.t.identifier(parts[i]));
    }
    return expr;
  }

  addEffectCleanup(
    scope: any,
    effectCall: BabelTypes.CallExpression,
  ): BabelTypes.Statement[] {
    const cleanupId = scope.generateUidIdentifier("cleanup");

    return [
      this.t.variableDeclaration("const", [
        this.t.variableDeclarator(cleanupId, effectCall),
      ]),
      this.t.expressionStatement(
        this.t.assignmentExpression(
          "=",
          this.t.memberExpression(
            this.t.identifier("self"),
            this.t.identifier("__cleanup"),
          ),
          this.t.arrayExpression([
            this.t.spreadElement(
              this.t.logicalExpression(
                "||",
                this.t.memberExpression(
                  this.t.identifier("self"),
                  this.t.identifier("__cleanup"),
                ),
                this.t.arrayExpression([]),
              ),
            ),
            cleanupId,
          ]),
        ),
      ),
    ];
  }
}

class JSXUtilities {
  constructor(private t: typeof BabelTypes) {}

  getComponentName(
    nameNode:
      | BabelTypes.JSXIdentifier
      | BabelTypes.JSXMemberExpression
      | BabelTypes.JSXNamespacedName,
  ): string | null {
    if (this.t.isJSXIdentifier(nameNode)) {
      return nameNode.name;
    }

    if (this.t.isJSXMemberExpression(nameNode)) {
      const parts: string[] = [];
      let current: BabelTypes.JSXMemberExpression | BabelTypes.JSXIdentifier =
        nameNode;

      while (this.t.isJSXMemberExpression(current)) {
        parts.unshift(current.property.name);
        current = current.object;
      }

      if (this.t.isJSXIdentifier(current)) {
        parts.unshift(current.name);
      }

      return parts.join(".");
    }

    return null;
  }

  isComponentTag(tag: string | null): boolean {
    return tag ? /^[A-Z]/.test(tag) : false;
  }

  isSVGTag(tag: string): boolean {
    const svgTags = new Set([
      "svg",
      "circle",
      "rect",
      "line",
      "path",
      "polygon",
      "polyline",
      "ellipse",
      "text",
      "tspan",
      "g",
      "defs",
      "use",
      "symbol",
      "marker",
      "clipPath",
      "mask",
      "pattern",
      "linearGradient",
      "radialGradient",
      "stop",
      "animate",
      "animateTransform",
      "foreignObject",
      "image",
      "textPath",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feDistantLight",
      "feFlood",
      "feFuncA",
      "feFuncB",
      "feFuncG",
      "feFuncR",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMergeNode",
      "feMorphology",
      "feOffset",
      "fePointLight",
      "feSpecularLighting",
      "feSpotLight",
      "feTile",
      "feTurbulence",
      "filter",
      "metadata",
      "title",
      "desc",
      "switch",
      "view",
    ]);
    return svgTags.has(tag);
  }
}

class ElementTransformer {
  constructor(
    private t: typeof BabelTypes,
    private guards: NodeTypeGuards,
    private astUtils: ASTUtilities,
    private jsxUtils: JSXUtilities,
  ) {}

  transformElement(
    path: { node: BabelTypes.JSXElement | BabelTypes.JSXFragment },
    scope: any,
    context: TransformContext,
  ): TransformResult {
    if (this.t.isJSXFragment(path.node)) {
      return this.transformFragment(
        path as { node: BabelTypes.JSXFragment },
        scope,
        context,
      );
    }
    return this.transformJSXElement(
      path as { node: BabelTypes.JSXElement },
      scope,
      context,
    );
  }

  private transformJSXElement(
    path: { node: BabelTypes.JSXElement },
    scope: any,
    context: TransformContext,
  ): TransformResult {
    const jsxElement = path.node;
    const tag = this.jsxUtils.getComponentName(jsxElement.openingElement.name);
    const isComponent = this.jsxUtils.isComponentTag(tag);

    if (isComponent && tag) {
      return this.transformComponentElement(jsxElement, tag, scope, context);
    } else if (tag) {
      return this.transformDOMElement(jsxElement, tag, scope, context);
    }

    return {
      id: scope.generateUidIdentifier("el"),
      statements: [],
    };
  }

  private transformComponentElement(
    jsxElement: BabelTypes.JSXElement,
    tag: string,
    scope: any,
    context: TransformContext,
  ): TransformResult {
    const elId = scope.generateUidIdentifier("el");
    const statements: BabelTypes.Statement[] = [];
    const props: Array<
      | BabelTypes.ObjectProperty
      | BabelTypes.ObjectMethod
      | BabelTypes.SpreadElement
    > = [];
    const children: Array<BabelTypes.Expression> = [];

    this.processComponentAttributes(
      jsxElement.openingElement.attributes,
      props,
      context,
    );

    this.processChildren(
      jsxElement.children,
      children,
      statements,
      scope,
      context,
    );

    if (children.length > 0) {
      props.push(
        this.t.objectProperty(
          this.t.identifier("children"),
          children.length === 1
            ? children[0]
            : this.t.arrayExpression(children),
        ),
      );
    }

    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          elId,
          this.t.callExpression(this.t.identifier("$createComponent"), [
            this.astUtils.buildMemberExpression(tag),
            this.t.objectExpression(props),
            this.t.identifier("self"),
          ]),
        ),
      ]),
    );

    return { id: elId, statements };
  }

  private transformDOMElement(
    jsxElement: BabelTypes.JSXElement,
    tag: string,
    scope: any,
    context: TransformContext,
  ): TransformResult {
    const elId = scope.generateUidIdentifier("el");
    const statements: BabelTypes.Statement[] = [];
    const isSVGTag = this.jsxUtils.isSVGTag(tag);

    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          elId,
          isSVGTag
            ? this.t.callExpression(
                this.t.memberExpression(
                  this.t.identifier("document"),
                  this.t.identifier("createElementNS"),
                ),
                [
                  this.t.stringLiteral("http://www.w3.org/2000/svg"),
                  this.t.stringLiteral(tag),
                ],
              )
            : this.t.callExpression(
                this.t.memberExpression(
                  this.t.identifier("document"),
                  this.t.identifier("createElement"),
                ),
                [this.t.stringLiteral(tag)],
              ),
        ),
      ]),
    );

    const { hasRef, refValue, hasDangerousHTML, dangerousHTMLValue } =
      this.processDOMAttributes(
        jsxElement.openingElement.attributes,
        elId,
        statements,
        scope,
        context,
        tag,
      );

    if (hasRef && refValue) {
      statements.push(
        this.t.expressionStatement(
          this.t.assignmentExpression("=", refValue as BabelTypes.LVal, elId),
        ),
      );
    }

    if (hasDangerousHTML && dangerousHTMLValue) {
      const effectCall = this.t.callExpression(this.t.identifier("$effect"), [
        this.t.arrowFunctionExpression(
          [],
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(elId, this.t.identifier("innerHTML")),
            this.t.memberExpression(
              dangerousHTMLValue,
              this.t.identifier("__html"),
            ),
          ),
        ),
      ]);

      const cleanupStatements = this.astUtils.addEffectCleanup(
        scope,
        effectCall,
      );

      statements.push(...cleanupStatements);
    }

    if (!hasDangerousHTML) {
      this.processDOMChildren(
        jsxElement.children,
        elId,
        statements,
        scope,
        context,
      );
    }

    return { id: elId, statements };
  }

  private transformFragment(
    path: { node: BabelTypes.JSXFragment },
    scope: any,
    context: TransformContext,
  ): TransformResult {
    const fragId = scope.generateUidIdentifier("frag");
    const statements: BabelTypes.Statement[] = [];

    statements.push(
      this.t.variableDeclaration("var", [
        this.t.variableDeclarator(
          fragId,
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier("document"),
              this.t.identifier("createDocumentFragment"),
            ),
            [],
          ),
        ),
      ]),
    );

    this.processDOMChildren(
      path.node.children,
      fragId,
      statements,
      scope,
      context,
    );

    return { id: fragId, statements };
  }

  private processComponentAttributes(
    attributes: Array<BabelTypes.JSXAttribute | BabelTypes.JSXSpreadAttribute>,
    props: Array<
      | BabelTypes.ObjectProperty
      | BabelTypes.ObjectMethod
      | BabelTypes.SpreadElement
    >,
    context: TransformContext,
  ): void {
    for (const attr of attributes) {
      if (this.t.isJSXSpreadAttribute(attr)) {
        props.push(
          this.t.spreadElement(
            this.astUtils.replaceThisWithSelf(attr.argument),
          ),
        );
        continue;
      }

      const key = (attr.name as BabelTypes.JSXIdentifier).name;

      if (this.t.isStringLiteral(attr.value)) {
        props.push(this.t.objectProperty(this.t.identifier(key), attr.value));
      } else if (this.t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression as BabelTypes.Expression;

        if (this.guards.isSignalMember(expr)) {
          props.push(
            this.t.objectMethod(
              "get",
              this.t.identifier(key),
              [],
              this.t.blockStatement([
                this.t.returnStatement(this.astUtils.replaceThisWithSelf(expr)),
              ]),
            ),
          );
        } else {
          props.push(
            this.t.objectProperty(
              this.t.identifier(key),
              this.astUtils.replaceThisWithSelf(expr),
            ),
          );
        }
      } else {
        props.push(
          this.t.objectProperty(
            this.t.identifier(key),
            this.t.booleanLiteral(true),
          ),
        );
      }
    }
  }

  private processDOMAttributes(
    attributes: Array<BabelTypes.JSXAttribute | BabelTypes.JSXSpreadAttribute>,
    elId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
    tag?: string,
  ): {
    hasRef: boolean;
    refValue: BabelTypes.Expression | null;
    hasDangerousHTML: boolean;
    dangerousHTMLValue: BabelTypes.Expression | null;
  } {
    let hasRef = false;
    let refValue: BabelTypes.Expression | null = null;
    let hasDangerousHTML = false;
    let dangerousHTMLValue: BabelTypes.Expression | null = null;
    let hasClickHandler = false;
    let hrefValue: string | null = null;

    for (const attr of attributes) {
      if (this.t.isJSXSpreadAttribute(attr)) {
        const effectCall = this.t.callExpression(this.t.identifier("$effect"), [
          this.t.arrowFunctionExpression(
            [],
            this.t.callExpression(this.t.identifier("$spread"), [
              elId,
              this.astUtils.replaceThisWithSelf(attr.argument),
            ]),
          ),
        ]);

        const cleanupStatements = this.astUtils.addEffectCleanup(
          scope,
          effectCall,
        );

        statements.push(...cleanupStatements);

        continue;
      }

      const key = (attr.name as BabelTypes.JSXIdentifier).name;

      if (key === "ref") {
        hasRef = true;
        if (this.t.isJSXExpressionContainer(attr.value)) {
          refValue = this.astUtils.replaceThisWithSelf(
            attr.value.expression as BabelTypes.Expression,
          );
        }
        continue;
      }

      if (key === "dangerouslySetInnerHTML") {
        hasDangerousHTML = true;
        if (this.t.isJSXExpressionContainer(attr.value)) {
          dangerousHTMLValue = this.astUtils.replaceThisWithSelf(
            attr.value.expression as BabelTypes.Expression,
          );
        }
        continue;
      }

      if (/^on[A-Z]/.test(key)) {
        if (key === "onClick") {
          hasClickHandler = true;
        }
        this.processEventListener(key, attr, elId, statements, context);
        continue;
      }

      if (key === "href" && this.t.isStringLiteral(attr.value)) {
        hrefValue = attr.value.value;
      }

      if (key === "style" && this.t.isJSXExpressionContainer(attr.value)) {
        this.processStyleAttribute(attr, elId, statements, scope, context);
        continue;
      }

      this.processRegularAttribute(key, attr, elId, statements, scope, context);
    }

    if (tag === "a" && !hasClickHandler) {
      statements.push(
        this.t.expressionStatement(
          this.t.callExpression(
            this.t.memberExpression(
              elId,
              this.t.identifier("addEventListener"),
            ),
            [
              this.t.stringLiteral("click"),
              this.t.arrowFunctionExpression(
                [this.t.identifier("e")],
                this.t.callExpression(
                  this.t.memberExpression(
                    this.t.identifier("Orca"),
                    this.t.identifier("navigate"),
                  ),
                  [
                    this.t.identifier("e"),
                    this.t.callExpression(
                      this.t.memberExpression(
                        this.t.memberExpression(
                          this.t.identifier("e"),
                          this.t.identifier("currentTarget"),
                        ),
                        this.t.identifier("getAttribute"),
                      ),
                      [this.t.stringLiteral("href")],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return { hasRef, refValue, hasDangerousHTML, dangerousHTMLValue };
  }

  private isRelativeUrl(url: string): boolean {
    try {
      new URL(url);
      return false;
    } catch {
      if (
        url.startsWith("#") ||
        url.startsWith("mailto:") ||
        url.startsWith("tel:")
      ) {
        return false;
      }

      return true;
    }
  }

  private processEventListener(
    key: string,
    attr: BabelTypes.JSXAttribute,
    elId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    context: TransformContext,
  ): void {
    const eventName = key.slice(2).toLowerCase();
    let handler: BabelTypes.Expression = this.t.nullLiteral();

    if (this.t.isJSXExpressionContainer(attr.value)) {
      handler = this.astUtils.replaceThisWithSelf(
        attr.value.expression as BabelTypes.Expression,
      );
    }

    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(
          this.t.memberExpression(elId, this.t.identifier("addEventListener")),
          [this.t.stringLiteral(eventName), handler],
        ),
      ),
    );
  }

  private processStyleAttribute(
    attr: BabelTypes.JSXAttribute,
    elId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    if (!this.t.isJSXExpressionContainer(attr.value)) return;

    const effectCall = this.t.callExpression(this.t.identifier("$effect"), [
      this.t.arrowFunctionExpression(
        [],
        this.t.callExpression(this.t.identifier("$style"), [
          elId,
          this.astUtils.replaceThisWithSelf(
            attr.value.expression as BabelTypes.Expression,
          ),
        ]),
      ),
    ]);
    const cleanupStatements = this.astUtils.addEffectCleanup(scope, effectCall);

    statements.push(...cleanupStatements);
  }

  private processRegularAttribute(
    key: string,
    attr: BabelTypes.JSXAttribute,
    elId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    const attrName = key === "className" ? "class" : key;
    let value: BabelTypes.Expression;
    let isReactive = false;

    if (this.t.isStringLiteral(attr.value)) {
      value = attr.value;
    } else if (this.t.isJSXExpressionContainer(attr.value)) {
      const expr = this.astUtils.replaceThisWithSelf(
        attr.value.expression as BabelTypes.Expression,
      );

      isReactive = this.guards.isSignalMember(
        attr.value.expression as BabelTypes.Expression,
      );

      value = expr;
    } else {
      value = this.t.booleanLiteral(true);
    }

    if (isReactive) {
      const effectCall = this.t.callExpression(this.t.identifier("$effect"), [
        this.t.arrowFunctionExpression(
          [],
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(elId, this.t.identifier(attrName)),
            value,
          ),
        ),
      ]);

      const cleanupStatements = this.astUtils.addEffectCleanup(
        scope,
        effectCall,
      );

      statements.push(...cleanupStatements);
    } else {
      statements.push(
        this.t.expressionStatement(
          this.t.callExpression(
            this.t.memberExpression(elId, this.t.identifier("setAttribute")),
            [this.t.stringLiteral(attrName), value],
          ),
        ),
      );
    }
  }

  private processChildren(
    children: Array<
      | BabelTypes.JSXText
      | BabelTypes.JSXExpressionContainer
      | BabelTypes.JSXElement
      | BabelTypes.JSXFragment
      | BabelTypes.JSXSpreadChild
    >,
    childExpressions: Array<BabelTypes.Expression>,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    for (const child of children) {
      if (this.t.isJSXText(child)) {
        const text = child.value.trim();
        if (text) childExpressions.push(this.t.stringLiteral(text));
      } else if (this.t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (!this.t.isJSXEmptyExpression(expr)) {
          childExpressions.push(
            this.astUtils.replaceThisWithSelf(expr as BabelTypes.Expression),
          );
        }
      } else if (this.t.isJSXElement(child) || this.t.isJSXFragment(child)) {
        const childEl = this.transformElement({ node: child }, scope, context);
        statements.push(...childEl.statements);
        childExpressions.push(childEl.id);
      }
    }
  }

  private processDOMChildren(
    children: Array<
      | BabelTypes.JSXText
      | BabelTypes.JSXExpressionContainer
      | BabelTypes.JSXElement
      | BabelTypes.JSXFragment
      | BabelTypes.JSXSpreadChild
    >,
    parentId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    for (const child of children) {
      if (this.t.isJSXText(child)) {
        const text = child.value.trim();
        if (!text) continue;
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$insert"), [
              parentId,
              this.t.stringLiteral(text),
            ]),
          ),
        );
      } else if (this.t.isJSXExpressionContainer(child)) {
        const expr = child.expression;
        if (this.t.isJSXEmptyExpression(expr)) continue;

        if (this.t.isLogicalExpression(expr, { operator: "&&" })) {
          this.processConditionalAnd(
            expr,
            parentId,
            statements,
            scope,
            context,
          );
        } else if (this.t.isConditionalExpression(expr)) {
          this.processConditionalTernary(
            expr,
            parentId,
            statements,
            scope,
            context,
          );
        } else {
          let insertedValue: BabelTypes.Expression;
          if (this.guards.isSignalMember(expr)) {
            insertedValue = this.astUtils.getObject(
              expr as BabelTypes.Expression,
            );
          } else {
            insertedValue = this.t.arrowFunctionExpression(
              [],
              this.astUtils.replaceThisWithSelf(expr as BabelTypes.Expression),
            );
          }

          statements.push(
            this.t.expressionStatement(
              this.t.callExpression(this.t.identifier("$insert"), [
                parentId,
                insertedValue,
              ]),
            ),
          );
        }
      } else if (this.t.isJSXElement(child) || this.t.isJSXFragment(child)) {
        const childEl = this.transformElement({ node: child }, scope, context);
        statements.push(...childEl.statements);
        statements.push(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("$insert"), [
              parentId,
              childEl.id,
            ]),
          ),
        );
      }
    }
  }

  private processConditionalAnd(
    expr: BabelTypes.LogicalExpression,
    parentId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    const condition = expr.left;
    const consequent = expr.right;

    const computedId = scope.generateUidIdentifier("c");
    const branchExpr = this.transformExpressionToBranch(
      consequent,
      scope,
      context,
    );

    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(this.t.identifier("$insert"), [
          parentId,
          this.t.callExpression(
            this.t.arrowFunctionExpression(
              [],
              this.t.blockStatement([
                this.t.variableDeclaration("var", [
                  this.t.variableDeclarator(
                    computedId,
                    this.t.callExpression(this.t.identifier("$computed"), [
                      this.t.arrowFunctionExpression(
                        [],
                        this.astUtils.replaceThisWithSelf(condition),
                      ),
                    ]),
                  ),
                ]),
                this.t.returnStatement(
                  this.t.arrowFunctionExpression(
                    [],
                    this.t.logicalExpression(
                      "&&",
                      this.t.memberExpression(
                        computedId,
                        this.t.identifier("value"),
                      ),
                      this.t.callExpression(branchExpr, []),
                    ),
                  ),
                ),
              ]),
            ),
            [],
          ),
        ]),
      ),
    );
  }

  private processConditionalTernary(
    expr: BabelTypes.ConditionalExpression,
    parentId: BabelTypes.Identifier,
    statements: BabelTypes.Statement[],
    scope: any,
    context: TransformContext,
  ): void {
    const condition = expr.test;
    const consequent = expr.consequent;
    const alternate = expr.alternate;

    const computedId = scope.generateUidIdentifier("c");
    const trueBranchExpr = this.transformExpressionToBranch(
      consequent,
      scope,
      context,
    );
    const falseBranchExpr = this.transformExpressionToBranch(
      alternate,
      scope,
      context,
    );

    statements.push(
      this.t.expressionStatement(
        this.t.callExpression(this.t.identifier("$insert"), [
          parentId,
          this.t.callExpression(
            this.t.arrowFunctionExpression(
              [],
              this.t.blockStatement([
                this.t.variableDeclaration("var", [
                  this.t.variableDeclarator(
                    computedId,
                    this.t.callExpression(this.t.identifier("$computed"), [
                      this.t.arrowFunctionExpression(
                        [],
                        this.astUtils.replaceThisWithSelf(condition),
                      ),
                    ]),
                  ),
                ]),
                this.t.returnStatement(
                  this.t.arrowFunctionExpression(
                    [],
                    this.t.conditionalExpression(
                      this.t.memberExpression(
                        computedId,
                        this.t.identifier("value"),
                      ),
                      this.t.callExpression(trueBranchExpr, []),
                      this.t.callExpression(falseBranchExpr, []),
                    ),
                  ),
                ),
              ]),
            ),
            [],
          ),
        ]),
      ),
    );
  }

  private transformExpressionToBranch(
    node: BabelTypes.Expression,
    scope: any,
    context: TransformContext,
  ): BabelTypes.ArrowFunctionExpression {
    if (this.t.isJSXElement(node) || this.t.isJSXFragment(node)) {
      const { id, statements } = this.transformElement(
        { node: node as any },
        scope,
        context,
      );

      return this.t.arrowFunctionExpression(
        [],
        this.t.blockStatement([...statements, this.t.returnStatement(id)]),
      );
    }

    return this.t.arrowFunctionExpression(
      [],
      this.astUtils.replaceThisWithSelf(node),
    );
  }
}

export function j2d({ types: t }: PluginContext): PluginObj<PluginState> {
  const guards = new NodeTypeGuards(t);
  const astUtils = new ASTUtilities(t, guards);
  const jsxUtils = new JSXUtilities(t);
  const elementTransformer = new ElementTransformer(
    t,
    guards,
    astUtils,
    jsxUtils,
  );

  return {
    name: "jsx-to-dom",
    visitor: {
      Program: {
        exit(path: NodePath<BabelTypes.Program>, state: PluginState) {
          if (state.helpersImported) return;

          const helpers = [
            { local: "$insert", imported: "insert" },
            { local: "$createComponent", imported: "createComponent" },
            { local: "$style", imported: "style" },
            { local: "$spread", imported: "spread" },
            { local: "$effect", imported: "effect" },
            { local: "$computed", imported: "computed" },
          ];

          for (const helper of helpers) {
            path.unshiftContainer(
              "body",
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier(helper.local),
                    t.identifier(helper.imported),
                  ),
                ],
                t.stringLiteral("@kithinji/orca"),
              ),
            );
          }

          state.helpersImported = true;
        },
      },

      ClassMethod(path: NodePath<BabelTypes.ClassMethod>) {
        if (path.getData("processed")) return;

        let hasJSX = false;
        path.traverse({
          JSXElement() {
            hasJSX = true;
          },
          JSXFragment() {
            hasJSX = true;
          },
        });

        if (!hasJSX) return;
        path.setData("processed", true);

        const body = path.node.body;
        if (!t.isBlockStatement(body)) return;

        body.body.unshift(
          t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier("self"), t.thisExpression()),
          ]),
        );

        const context: TransformContext = { signals: new Map() };

        path.traverse({
          JSXElement(jsxPath: NodePath<BabelTypes.JSXElement>) {
            if (jsxPath.getData("processed")) return;
            jsxPath.setData("processed", true);

            const { id, statements } = elementTransformer.transformElement(
              jsxPath as any,
              jsxPath.scope,
              context,
            );

            jsxPath.replaceWith(
              t.callExpression(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([...statements, t.returnStatement(id)]),
                ),
                [],
              ),
            );
          },
          JSXFragment(jsxPath: NodePath<BabelTypes.JSXFragment>) {
            if (jsxPath.getData("processed")) return;
            jsxPath.setData("processed", true);

            const { id, statements } = elementTransformer.transformElement(
              jsxPath as any,
              jsxPath.scope,
              context,
            );

            jsxPath.replaceWith(
              t.callExpression(
                t.arrowFunctionExpression(
                  [],
                  t.blockStatement([...statements, t.returnStatement(id)]),
                ),
                [],
              ),
            );
          },
        });
      },
    },
  };
}
