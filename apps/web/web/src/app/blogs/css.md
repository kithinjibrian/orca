# Styling in Orca: CSS Through Macros

Oh, the humble Cascading Style Sheets!

One of the biggest headaches with web technologies has always been **co-location**. You have HTML files, CSS files, and JavaScript files. Switching between all three is a real mental hustle.

Naturally, we tried to shove everything into one file. Now we have JSX for HTML and Tailwind for CSS.

---

## The Tailwind Problem

I love Tailwind. Really, I do.

I'm Gen Z. When I started, Tailwind was just the default. I've never even written Sass. Having a separate CSS file? That feels so millennial.

But here is the catch with Tailwind: **you end up with ugly markup that is hard to read because it scrolls horizontally into the next time zone.**

```tsx
<div className="flex flex-col items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700 max-w-md mx-auto">
  {/* Good luck reading this without a 49-inch ultrawide monitor */}
</div>
```

Modifying those classes? Finding that one specific utility in a sea of twenty others is a nightmare. Tailwind solves co-location beautifully, but it trades readability and maintainability for convenience.

---

## What I Wanted

When I started building Orca, I wanted a styling solution that offered:

- **Great co-location:** CSS lives with your components.
- **Easy readability:** No horizontal scrolling of utility classes.
- **Easy maintenance:** Finding and modifying styles should be straightforward.
- **Type safety:** TypeScript should catch your fat-fingered style errors.
- **Performance:** Optimized output with minimal runtime overhead.

Basically, I wanted to **write CSS somewhat like how God intended**, but without the pain of leaving my component file. That is why styling in Orca is handled through macros.

---

## The `style$` Macro

The `style$` macro runs at **build time** and generates atomic CSS classes. It feels like Tailwind under the hood, but you write actual CSS properties as TypeScript objects.

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

### Build-Time Magic

The macro generates atomic classes for each unique property value. For example:

```ts
// What your JS looks like after the build
var cls = {
  main: "a-00l19tlc a-00nq98s2 a-00beuay9",
  content_block: "a-00besya7 a-005fhq93 a-006fvrrw",
};
```

All the CSS is collected into a single `index.css` file. You write readable properties, you get atomic classes, and TypeScript gives you autocomplete so you don't have to guess if it's `borderRadius` or `border-radius`. You don't get punished for using objects; you get the best of both worlds.

---

## Using Styles with `apply$`

To apply styles to elements, use the `apply$` macro. It spreads the `className` onto the element so your JSX stays clean.

```tsx
@Component()
export class Page {
  build() {
    return (
      <div {...apply$(cls.main)}>
        <h1 {...apply$(cls.content_block)}>Welcome</h1>
      </div>
    );
  }
}
```

### Conditional Styles

You can apply styles using JavaScript expressions. Falsy values are ignored, so only the truthy classes make it to the party.

```tsx
<button
  {...apply$(
    cls.button,
    this.props.primary && cls.primary,
    this.props.disabled && cls.disabled
  )}
>
  {this.props.children}
</button>
```

---

## Media Queries

Orca supports responsive styles using a nested object pattern. This is **responsive CSS with type safety**.

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

The `default` key sets the base value, and the media query strings become responsive overrides. At build time, this generates proper CSS media queries with zero runtime logic.

---

## Performance: Fast and Lean

- **Build Time:** Styles are processed and extracted to a separate file. Atomic classes are deduped automatically.
- **Runtime:** Zero runtime CSS-in-JS overhead. There is no style injection or CSSOM manipulation. It is as fast as a static CSS file because it _is_ a static CSS file.
- **Bundle Size:** Atomic classes mean CSS scales with unique styles rather than the number of components. If ten components use `padding: "1rem"`, they all share one tiny class.

---

## Summary: Tailwind vs. Orca

**Tailwind** gives you utility classes in your markup, horizontal scrolling, and a headache when you need to modify things. **Orca** gives you semantic names in your markup, styles in TypeScript objects, and a clean workspace.

Both generate atomic CSS. Orca just keeps your markup from looking like a bowl of alphabet soup.

**It is CSS like how God intended, but without leaving your component file.**