# typeorm

TypeScript project configured for **node** environment(s).

## Features

- Fast builds with esbuild
- Proper bundling for node
- Source maps for debugging
- TypeScript declarations
- Watch mode for development

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Watch mode will automatically rebuild when you change files.

## Build

```bash
npm run build
```

This will:
1. Bundle your code with esbuild
2. Generate TypeScript declarations
3. Create source maps

## Clean

```bash
npm run clean
```


## Usage

```javascript
import { platform } from 'typeorm';
console.log(platform); 
```


## Build Output

- `dist/*.mjs` - Bundled JavaScript (ESM)
- `dist/types/*.d.ts` - TypeScript declarations
- `dist/*.map` - Source maps
