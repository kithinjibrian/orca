import { CSSProperties } from "./types";
import { CSSType } from "./var_types";

declare const StyleClassNameTag: unique symbol;
export type StyleClassNameFor<K, V> = string & {
  _opaque: typeof StyleClassNameTag;
  _key: K;
  _value: V;
};

declare const StyleVarTag: unique symbol;
declare class _StyleVar<out Val> {
  private _opaque: typeof StyleVarTag;
  private _value: Val;
}
export type StyleVar<Val> = _StyleVar<Val> & string;

type PseudoClassStr = `:${string}`;
type AtRuleStr = `@${string}`;

type CondStr = PseudoClassStr | AtRuleStr;

type CSSPropertiesWithExtras = Partial<
  Readonly<
    CSSProperties & {
      "::after": CSSProperties;
      "::backdrop": CSSProperties;
      "::before": CSSProperties;
      "::cue": CSSProperties;
      "::cue-region": CSSProperties;
      "::first-letter": CSSProperties;
      "::first-line": CSSProperties;
      "::file-selector-button": CSSProperties;
      "::grammar-error": CSSProperties;
      "::marker": CSSProperties;
      // This is a pattern and not a static key so it cannot be typed correctly.
      // [key: `::part(${string})` | `::slotted(${string})`]: CSSProperties;
      "::placeholder": CSSProperties;
      "::selection": CSSProperties;
      // This is a pattern and not a static key so it cannot be typed correctly.
      // '::slotted()': CSSProperties;
      "::spelling-error": CSSProperties;
      "::target-text": CSSProperties;
      "::-webkit-scrollbar"?: CSSProperties;
      "::-webkit-scrollbar-button"?: CSSProperties;
      "::-webkit-scrollbar-thumb"?: CSSProperties;
      "::-webkit-scrollbar-track"?: CSSProperties;
      "::-webkit-scrollbar-track-piece"?: CSSProperties;
      "::-webkit-scrollbar-corner"?: CSSProperties;
      "::-webkit-resizer"?: CSSProperties;
      // webkit styles used for Search in Safari
      "::-webkit-search-decoration"?: CSSProperties;
      "::-webkit-search-cancel-button"?: CSSProperties;
      "::-webkit-search-results-button"?: CSSProperties;
      "::-webkit-search-results-decoration"?: CSSProperties;
      // For input ranges in Chromium
      "::-webkit-slider-thumb"?: CSSProperties;
      "::-webkit-slider-runnable-track"?: CSSProperties;
      // For input ranges in Firefox
      "::-moz-range-thumb"?: CSSProperties;
      "::-moz-range-track"?: CSSProperties;
      "::-moz-range-progress"?: CSSProperties;
    }
  >
>;

type NotUndefined = {} | null;
type UserAuthoredStyles =
  | CSSPropertiesWithExtras
  | { [key: string]: NotUndefined };

type ComplexStyleValueType<T> = T extends StyleVar<infer U>
  ? U extends CSSType<infer V>
    ? V
    : U
  : T extends string | number | null | symbol
  ? T
  : T extends ReadonlyArray<infer U>
  ? ComplexStyleValueType<U>
  : T extends Readonly<{ default: infer A; [cond: CondStr]: infer B }>
  ? ComplexStyleValueType<A> | ComplexStyleValueType<B>
  : T;

declare const StyleInlineStylesTag: unique symbol;

export type InlineStyles = {
  _opaque: typeof StyleInlineStylesTag;
};

export type MapNamespace<CSS> = Readonly<{
  [Key in keyof CSS]: StyleClassNameFor<Key, ComplexStyleValueType<CSS[Key]>>;
}>;

export type MapNamespaces<
  S extends {
    [key: string]: UserAuthoredStyles | ((...args: any) => UserAuthoredStyles);
  }
> = Readonly<{
  [Key in keyof S]: S[Key] extends (...args: infer Args) => infer Obj
    ? (...args: Args) => Readonly<[MapNamespace<Obj>, InlineStyles]>
    : MapNamespace<S[Key]>;
}>;
