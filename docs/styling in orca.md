# Styling in Orca

Orca implements a compile-time CSS-in-JS solution using macros that transform TypeScript objects into atomic CSS classes. This approach eliminates runtime overhead while maintaining developer ergonomics and type safety.

## Architecture Overview

The styling system consists of two primary macros:

1. **`style$`** - Transforms style definitions into atomic class mappings at build time
2. **`apply$`** - Spreads generated classNames onto JSX elements

Both macros execute during the build process, meaning zero styling logic runs in the browser.

## The `style$` Macro

### Input Format

```ts
import { style$ } from "@kithinji/arcane";

const cls = style$({
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "2rem",
    maxWidth: "800px",
    margin: "0 auto",
  },
  content_block: {
    padding: "20px",
    borderRadius: "8px",
    borderLeft: "4px solid #333",
  },
});
```

The macro accepts an object where keys are semantic identifiers for your style groups, and values are objects containing CSS properties in camelCase notation.

### Transformation Process

At build time, the macro performs several operations:

1. **Property Normalization** - Converts camelCase properties to kebab-case CSS
2. **Atomic Class Generation** - Creates a unique class for each property-value pair
3. **Hash-Based Naming** - Generates deterministic class names (e.g., `a-00l19tlc`)
4. **CSS Extraction** - Writes the actual CSS rules to `index.css`
5. **Reference Replacement** - Replaces the `style$` call with a plain object mapping

### Build Output

The source code:

```ts
const cls = style$({
  main: {
    padding: "2rem",
    maxWidth: "800px",
  },
});
```

Becomes:

```ts
var cls = {
  main: "a-00beuay9 a-00l19tlc",
};
```

While `index.css` contains:

```css
.a-00beuay9 {
  padding: 2rem;
}
.a-00l19tlc {
  max-width: 800px;
}
```

### Atomic CSS Strategy

Each unique CSS property-value combination generates exactly one class. If multiple components define `padding: "2rem"`, they all reference the same `a-00beuay9` class. This keeps the CSS file size proportional to unique styles, not component count.

The class name hashing uses the property-value pair as input, ensuring:

- **Deterministic builds** - Same input always produces the same output
- **Collision resistance** - Different properties generate different hashes
- **Minimal class name length** - Short, optimized identifiers

The macro maintains a global registry during the build. When the same combination appears across components:

```ts
// Component A
const clsA = style$({ box: { padding: "1rem" } });

// Component B
const clsB = style$({ container: { padding: "1rem" } });
```

Both generate references to the same class for `padding: 1rem`. The CSS file contains this rule exactly once.

## The `apply$` Macro

### Basic Usage

```tsx
<div {...apply$(cls.main)}>
  <h1 {...apply$(cls.content_block)}>Welcome</h1>
</div>
```

The `apply$` macro transforms at build time into a className spread:

```tsx
<div className="a-00beuay9 a-00l19tlc">
  <h1 className="a-00besya7 a-005fhq93 a-006fvrrw">Welcome</h1>
</div>
```

The transformation process:

1. Resolves the reference to the style object
2. Extracts the space-separated class string
3. Generates `{ className: "..." }`
4. Spreads it onto the element

### Conditional Application

```tsx
<button
  {...apply$(
    cls.button,
    this.props.primary && cls.primary,
    this.props.disabled && cls.disabled,
  )}
>
  {this.props.children}
</button>
```

The macro accepts multiple arguments and filters out falsy values at runtime.

### Style Composition

Multiple style objects can be combined:

```tsx
{...apply$(cls.base, cls.variant, condition && cls.modifier)}
```

The macro merges all truthy class strings into a single className. Since classes are atomic, there's no specificity conflict - later classes override earlier ones through standard CSS cascade order.

## Responsive Design

### Nested Media Query Syntax

```ts
const cls = style$({
  grid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(4, 1fr)",
      "@media (max-width: 1200px)": "repeat(3, 1fr)",
      "@media (max-width: 768px)": "repeat(2, 1fr)",
    },
  },
});
```

When a property value is an object instead of a primitive, the macro treats it as a responsive declaration. The `default` key sets the base value, and media query strings define breakpoints.

### Generated CSS

The above produces:

```css
.a-grid-base {
  display: grid;
}
.a-cols-default {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 1200px) {
  .a-cols-1200 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .a-cols-768 {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

The compiled reference becomes:

```ts
var cls = {
  grid: "a-grid-base a-cols-default a-cols-1200 a-cols-768",
};
```

All media query classes are included in the className. CSS cascade rules handle which style applies at each viewport width - no JavaScript media query listeners needed at runtime.

## Performance Deep Dive

### Build Time

**Atomic Class Deduplication**: The macro maintains a global registry of property-value pairs. When the same combination appears multiple times, both components reference the same class. The CSS file contains each rule exactly once.

**CSS File Generation**: All atomic classes are collected and written to a single `index.css` file, which can be:

- Minified
- Gzipped
- Cached indefinitely (content-based hashing)
- Loaded once per application

### Runtime Performance

**Zero Style Injection**: Unlike runtime CSS-in-JS libraries (styled-components, emotion), there's no:

- Style tag manipulation
- CSSOM updates
- Style recalculation on component mount
- JavaScript execution for styling logic

**Static className Application**: The transformed code uses plain string classNames:

```tsx
// No function calls, just static strings
<div className="a-001 a-002 a-003">
```

This is as fast as hand-written HTML with CSS classes.

**Memory Efficiency**: No JavaScript objects holding style definitions in memory. The `cls` objects are just string mappings, not style objects.

### Bundle Size Implications

**CSS Scaling**: The CSS file size grows with the number of unique property-value combinations, not the number of components or elements. A codebase with:

- 100 components
- Each using `padding: "1rem"`

Results in **one** CSS rule for padding, not 100.

**JavaScript Size**: The transformed `cls` objects are minimal:

```ts
// Before transformation: ~200 bytes of style definitions
const cls = style$({
  main: { padding: "2rem", maxWidth: "800px" },
});

// After transformation: ~50 bytes of class references
var cls = { main: "a-00beuay9 a-00l19tlc" };
```

The macro eliminates all CSS property names and values from the JavaScript bundle.

## Advanced Patterns

### Style Variants

```ts
const buttonStyles = style$({
  base: {
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
  },
  primary: {
    backgroundColor: "#007bff",
    color: "white",
  },
  secondary: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

// Usage
<button {...apply$(
  buttonStyles.base,
  variant === 'primary' && buttonStyles.primary,
  variant === 'secondary' && buttonStyles.secondary,
  disabled && buttonStyles.disabled
)}>
```

## Comparison to Other Approaches

### vs. Inline Styles

- **Orca**: Static CSS file, full CSS features (media queries, pseudo-classes)
- **Inline**: JavaScript objects, limited features, higher specificity

### vs. CSS Modules

- **Orca**: Atomic classes, automatic deduplication, TypeScript types
- **CSS Modules**: Per-component CSS, manual optimization, separate files

### vs. Runtime CSS-in-JS

- **Orca**: Zero runtime, build-time processing, static output
- **Runtime**: Style injection on mount, dynamic theming, runtime overhead

### vs. Utility-first CSS

- **Orca**: Semantic names in markup, styles in objects, atomic output
- **Utility**: Classes in markup, verbose HTML, atomic output

Both Orca and utility-first frameworks generate atomic CSS, but Orca keeps the markup cleaner by abstracting the atomic classes behind semantic identifiers.
