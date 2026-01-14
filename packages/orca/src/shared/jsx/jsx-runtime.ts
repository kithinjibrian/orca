import { v4 as uuidv4 } from "uuid";

import { ORCA_ELEMENT_TYPE, ORCA_FRAGMENT_TYPE } from "../symbols";
import { JSX } from "./types";

export { JSX };

export function jsx(type: any, config: any, maybeKey?: any): JSX.Element {
  const key = maybeKey !== undefined ? maybeKey : config?.key ?? null;

  const props: any = {};

  if (config) {
    for (const propName in config) {
      if (propName === "key") continue;

      if (propName === "ref") continue;

      props[propName] = config[propName];
    }
  }

  if (props.children !== undefined) {
    props.children = normalizeChildren(props.children);
  }

  if (typeof type === "function" && type.defaultProps) {
    for (const propName in type.defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = type.defaultProps[propName];
      }
    }
  }

  return createVNode(type, props, key);
}

export const jsxs = jsx;

export function Fragment(props: any): JSX.Element {
  return {
    $$typeof: ORCA_ELEMENT_TYPE,
    type: ORCA_FRAGMENT_TYPE,
    id: "00000000-0000-0000-0000-000000000000",
    props,
    key: null,
  };
}

function createVNode(
  type: any,
  props: any,
  key: string | number | null
): JSX.Element {
  return {
    $$typeof: ORCA_ELEMENT_TYPE,
    id: uuidv4(),
    type,
    props,
    key,
  };
}

function normalizeChildren(children: any): any {
  if (children === null || children === undefined) {
    return null;
  }

  if (!Array.isArray(children)) {
    return normalizeChild(children);
  }

  const normalized: any[] = [];

  for (let i = 0; i < children.length; i++) {
    const child = normalizeChild(children[i]);

    if (child === null) continue;

    if (Array.isArray(child)) {
      normalized.push(...child);
    } else {
      normalized.push(child);
    }
  }

  if (normalized.length === 0) return null;
  if (normalized.length === 1) return normalized[0];
  return normalized;
}

function normalizeChild(child: any): any {
  if (child === null || child === undefined || typeof child === "boolean") {
    return null;
  }

  if (typeof child === "number") {
    return String(child);
  }

  if (typeof child === "string" || child.$$typeof === ORCA_ELEMENT_TYPE) {
    return child;
  }

  if (Array.isArray(child)) {
    return child.map(normalizeChild).filter((c) => c !== null);
  }

  return String(child);
}

export function isClassComponent(jsx: JSX.Element): boolean {
  return (
    typeof jsx.type === "function" &&
    jsx.type.prototype &&
    typeof jsx.type.prototype.build === "function"
  );
}

export function isIntrinsicElement(jsx: JSX.Element): boolean {
  return typeof jsx.type === "string";
}

export function isFragment(jsx: JSX.Element): boolean {
  return (
    typeof jsx.type === "function" && jsx.type()?.type == ORCA_FRAGMENT_TYPE
  );
}
