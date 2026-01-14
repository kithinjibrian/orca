export type ValueWithDefault<T> =
  | T
  | Readonly<{
      [key: string]: ValueWithDefault<T>;
      default: ValueWithDefault<T>;
    }>;

type InnerValue = null | string | number;

export interface ICSSType<T extends InnerValue = InnerValue> {
  readonly value: ValueWithDefault<string>;
  readonly syntax: string;
}

export declare class CSSProperty<T extends InnerValue> implements ICSSType<T> {
  readonly value: ValueWithDefault<string>;
  readonly syntax: string;
}

export declare class Angle<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Color<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Url<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Image<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Integer<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class LengthPercentage<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Length<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Percentage<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Num<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Resolution<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class Time<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class TransformFunction<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}
export declare class TransformList<
  T extends InnerValue = InnerValue
> extends CSSProperty<T> {}

export type CSSType<T extends InnerValue = InnerValue> =
  | Angle<T>
  | Color<T>
  | Url<T>
  | Image<T>
  | Integer<T>
  | LengthPercentage<T>
  | Length<T>
  | Percentage<T>
  | Num<T>
  | Resolution<T>
  | Time<T>
  | TransformFunction<T>
  | TransformList<T>;
