type JSXChild = JSX.Element | string | number | boolean | null | undefined;

interface DOMEvents {
  onClick?: (event: MouseEvent) => void;
  onDblClick?: (event: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onMouseMove?: (event: MouseEvent) => void;
  onMouseOver?: (event: MouseEvent) => void;
  onMouseOut?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyPress?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
  onSubmit?: (event: Event) => void;
  onScroll?: (event: UIEvent) => void;
  onLoad?: (event: Event) => void;
  onError?: (event: Event) => void;
}

interface HTMLAttributes extends DOMEvents {
  id?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  hidden?: boolean;
  title?: string;
  tabIndex?: number;
  role?: string;
  key?: string | number | null;
  ref?: any;
  children?: JSXChild | JSXChild[];
}

interface DivHTMLAttributes extends HTMLAttributes {
  dangerouslySetInnerHTML?: {
    __html: string;
  };
}

interface AnchorHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  download?: any;
  rel?: string;
}

interface ButtonHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  type?: "submit" | "reset" | "button";
  value?: string | ReadonlyArray<string> | number;
}

interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string;
  alt?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  checked?: boolean;
  disabled?: boolean;
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
  src?: string;
  step?: number | string;
  type?:
    | "text"
    | "password"
    | "number"
    | "email"
    | "submit"
    | "checkbox"
    | "radio"
    | "file"
    | "date"
    | "range";
  value?: string | ReadonlyArray<string | number>;
}

interface ImageHTMLAttributes extends HTMLAttributes {
  alt?: string;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  height?: number | string;
  loading?: "eager" | "lazy";
  src?: string;
  width?: number | string;
}

interface FormHTMLAttributes extends HTMLAttributes {
  action?: string;
  method?: string;
  target?: string;
  encType?: string;
}

interface TextareaHTMLAttributes extends HTMLAttributes {
  value?: string;
  placeholder?: string;
  rows?: number;
  cols?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
}

interface SelectHTMLAttributes extends HTMLAttributes {
  value?: string | number;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
}

interface OptionHTMLAttributes extends HTMLAttributes {
  value?: string | number;
  selected?: boolean;
  disabled?: boolean;
}

interface LabelHTMLAttributes extends HTMLAttributes {
  htmlFor?: string;
}

interface VideoHTMLAttributes extends HTMLAttributes {
  src?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string;
  width?: number | string;
  height?: number | string;
}

interface AudioHTMLAttributes extends HTMLAttributes {
  src?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

interface SVGAttributes extends HTMLAttributes {
  viewBox?: string;
  xmlns?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  strokeDasharray?: string | number;
  strokeDashoffset?: string | number;
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
}

export namespace JSX {
  export interface Element {
    $$typeof: symbol;
    type: any;
    id: string;
    props: any;
    action?: "insert" | "update" | "error";
    key: string | number | null;
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

    // Text
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    p: HTMLAttributes;
    b: HTMLAttributes;
    i: HTMLAttributes;
    strong: HTMLAttributes;
    em: HTMLAttributes;
    small: HTMLAttributes;
    pre: HTMLAttributes;
    code: HTMLAttributes;

    // Client / Form
    a: AnchorHTMLAttributes;
    button: ButtonHTMLAttributes;
    input: InputHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    select: SelectHTMLAttributes;
    option: OptionHTMLAttributes;
    form: FormHTMLAttributes;
    label: LabelHTMLAttributes;

    // Media
    img: ImageHTMLAttributes;
    video: VideoHTMLAttributes;
    audio: AudioHTMLAttributes;

    // SVG
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

    // Lists
    ul: HTMLAttributes;
    ol: HTMLAttributes;
    li: HTMLAttributes;

    // Tables
    table: HTMLAttributes;
    tr: HTMLAttributes;
    td: TableCellAttributes;
    th: TableCellAttributes;
    thead: HTMLAttributes;
    tbody: HTMLAttributes;
    tfoot: HTMLAttributes;

    // Fallback for custom tags or tags not listed above
    [elemName: string]: HTMLAttributes;
  }
}
