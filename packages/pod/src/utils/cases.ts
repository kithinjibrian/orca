export function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^./, (char) => char.toLowerCase());
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^./, (char) => char.toUpperCase());
}

export function toSnakeCase(str: string): string {
  return str.replace(/[-\s]/g, "_").toLowerCase();
}
