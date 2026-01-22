type JSXChild =
  | JSX.Element
  | JSX.Element[]
  | string
  | number
  | boolean
  | null
  | undefined
  | JSXChild[];

interface DOMEvents {
  onClick?: (event: MouseEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onMouseMove?: (event: MouseEvent) => void;
  onMouseOver?: (event: MouseEvent) => void;
  onMouseOut?: (event: MouseEvent) => void;
  onWheel?: (event: WheelEvent) => void;

  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyPress?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;

  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onFocusIn?: (event: FocusEvent) => void;
  onFocusOut?: (event: FocusEvent) => void;

  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
  onSubmit?: (event: Event) => void;
  onInvalid?: (event: Event) => void;

  onScroll?: (event: UIEvent) => void;
  onLoad?: (event: Event) => void;
  onError?: (event: Event) => void;

  onDrag?: (event: DragEvent) => void;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
}

interface HTMLAttributes extends DOMEvents {
  id?: string;
  class?: string;
  className?: string;
  style?: string | Partial<CSSStyleDeclaration>;
  title?: string;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  tabIndex?: number;
  accessKey?: string;
  contentEditable?: boolean | "true" | "false" | "inherit" | "plaintext-only";
  spellCheck?: boolean | "true" | "false";
  draggable?: boolean | "true" | "false";
  hidden?: boolean;
  inert?: boolean;
  role?: string;
  slot?: string;

  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-disabled"?: boolean | "true" | "false";
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  "aria-expanded"?: boolean | "true" | "false";
  "aria-controls"?: string;
  "aria-current"?: boolean | "page" | "step" | "location" | "date" | "time";
  "aria-selected"?: boolean | "true" | "false";
  "aria-checked"?: boolean | "true" | "false" | "mixed";
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;

  [data: `data-${string}`]: string | undefined;

  key?: string | number | null;
  ref?: any;
  children?: JSXChild | JSXChild[];

  dangerouslySetInnerHTML?: { __html: string };
}

interface DivHTMLAttributes extends HTMLAttributes {}

interface AnchorHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top" | string;
  download?: any;
  rel?: string;
  referrerPolicy?: string;
}

interface ButtonHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  name?: string;
  value?: string | number | ReadonlyArray<string | number>;
  form?: string;
  formAction?: string;
  formMethod?: string;
}

interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string;
  alt?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  defaultValue?: string | number | ReadonlyArray<string | number>;
  disabled?: boolean;
  form?: string;
  max?: number | string;
  maxLength?: number;
  min?: number | string;
  minLength?: number;
  multiple?: boolean;
  name?: string;
  pattern?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  size?: number;
  src?: string;
  step?: number | string;
  type?:
    | "text"
    | "password"
    | "number"
    | "email"
    | "tel"
    | "url"
    | "search"
    | "submit"
    | "checkbox"
    | "radio"
    | "file"
    | "date"
    | "datetime-local"
    | "month"
    | "week"
    | "time"
    | "range"
    | "color"
    | "hidden";
  value?: string | number | ReadonlyArray<string | number>;
}

interface TextareaHTMLAttributes extends HTMLAttributes {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  cols?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
}

interface SelectHTMLAttributes extends HTMLAttributes {
  value?: string | number | ReadonlyArray<string | number>;
  defaultValue?: string | number | ReadonlyArray<string | number>;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  size?: number;
  autoComplete?: string;
}

interface OptionHTMLAttributes extends HTMLAttributes {
  value?: string | number;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}

interface LabelHTMLAttributes extends HTMLAttributes {
  htmlFor?: string;
  form?: string;
}

interface FormHTMLAttributes extends HTMLAttributes {
  action?: string;
  method?: "get" | "post" | "dialog";
  target?: string;
  encType?:
    | "application/x-www-form-urlencoded"
    | "multipart/form-data"
    | "text/plain";
  noValidate?: boolean;
  autoComplete?: string;
}

interface ImageHTMLAttributes extends HTMLAttributes {
  alt: string;
  src?: string;
  srcSet?: string;
  sizes?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async" | "auto";
  width?: number | string;
  height?: number | string;
  referrerPolicy?: string;
  useMap?: string;
}

type CommonMediaAttributes = {
  src?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "auto" | "metadata" | "none";
  width?: number | string;
  height?: number | string;
};

interface VideoHTMLAttributes extends HTMLAttributes, CommonMediaAttributes {
  poster?: string;
  playsInline?: boolean;
}

interface AudioHTMLAttributes extends HTMLAttributes, CommonMediaAttributes {}

interface SVGAttributes extends HTMLAttributes {
  viewBox?: string;
  xmlns?: string;
  fill?: string;
  stroke?: string;
  "stroke-width"?: number | string;
  "stroke-linecap"?: "butt" | "round" | "square" | "inherit";
  "stroke-linejoin"?: "miter" | "round" | "bevel" | "inherit";
  "stroke-dasharray"?: string | number;
  "stroke-dashoffset"?: string | number;
  opacity?: number | string;
  transform?: string;
  d?: string;
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
  rx?: number | string;
  ry?: number | string;
  x?: number | string;
  y?: number | string;
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  width?: number | string;
  height?: number | string;
  points?: string;
  preserveAspectRatio?: string;
  fillOpacity?: number | string;
  strokeOpacity?: number | string;
}

interface TableCellAttributes extends HTMLAttributes {
  colSpan?: number;
  rowSpan?: number;
  headers?: string;
  scope?: "row" | "col" | "rowgroup" | "colgroup" | "auto";
}

export namespace JSX {
  export interface Element {
    $$typeof: symbol;
    type: string | JSX.ElementClass;
    props: any;
    key: string | number | null;
    action?: "insert" | "update" | "error";
  }

  export interface ElementClass {
    build: () => Node | JSX.Element | Promise<JSX.Element>;
  }

  export interface ElementAttributesProperty {
    props: {};
  }

  export interface IntrinsicElements {
    div: DivHTMLAttributes;
    span: HTMLAttributes;
    header: HTMLAttributes;
    footer: HTMLAttributes;
    main: HTMLAttributes;
    section: HTMLAttributes;
    article: HTMLAttributes;
    nav: HTMLAttributes;
    aside: HTMLAttributes;

    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    p: HTMLAttributes;
    strong: HTMLAttributes;
    em: HTMLAttributes;
    b: HTMLAttributes;
    i: HTMLAttributes;
    small: HTMLAttributes;
    code: HTMLAttributes;
    pre: HTMLAttributes;
    blockquote: HTMLAttributes;

    a: AnchorHTMLAttributes;
    button: ButtonHTMLAttributes;
    input: InputHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    select: SelectHTMLAttributes;
    option: OptionHTMLAttributes;
    optgroup: HTMLAttributes;
    label: LabelHTMLAttributes;
    form: FormHTMLAttributes;

    img: ImageHTMLAttributes;
    video: VideoHTMLAttributes;
    audio: AudioHTMLAttributes;
    picture: HTMLAttributes;
    source: HTMLAttributes;
    track: HTMLAttributes & {
      kind?: string;
      src?: string;
      srclang?: string;
      label?: string;
      default?: boolean;
    };
    iframe: HTMLAttributes & {
      sandbox?: string;
      allow?: string;
      loading?: "eager" | "lazy";
    };

    svg: SVGAttributes;
    path: SVGAttributes;
    circle: SVGAttributes;
    rect: SVGAttributes;
    ellipse: SVGAttributes;
    line: SVGAttributes;
    polyline: SVGAttributes;
    polygon: SVGAttributes;
    g: SVGAttributes;
    defs: SVGAttributes;
    use: SVGAttributes;
    text: SVGAttributes;
    tspan: SVGAttributes;

    ul: HTMLAttributes;
    ol: HTMLAttributes;
    li: HTMLAttributes;
    dl: HTMLAttributes;
    dt: HTMLAttributes;
    dd: HTMLAttributes;

    table: HTMLAttributes;
    caption: HTMLAttributes;
    thead: HTMLAttributes;
    tbody: HTMLAttributes;
    tfoot: HTMLAttributes;
    tr: HTMLAttributes;
    th: TableCellAttributes;
    td: TableCellAttributes;

    br: HTMLAttributes;
    hr: HTMLAttributes;
    canvas: HTMLAttributes & {
      width?: number | string;
      height?: number | string;
    };
    script: HTMLAttributes & {
      async?: boolean;
      defer?: boolean;
      src?: string;
      type?: string;
      nonce?: string;
    };

    [elemName: string]: HTMLAttributes;
  }
}
