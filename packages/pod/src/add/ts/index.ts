import { createStructure, DirEntry } from "@/utils";
import path from "path";
import prompts from "prompts";

export interface ProjectOptions {
  name: string;
  target: "browser" | "node" | "both";
}

export async function addTs(name: string) {
  const baseDir = path.join(process.cwd(), name);

  const response = await prompts({
    type: "select",
    name: "target",
    message: "Where will this project run?",
    choices: [
      { title: "Browser", value: "browser" },
      { title: "Node.js", value: "node" },
      { title: "Both (Browser & Node.js)", value: "both" },
    ],
    initial: 2,
  });

  if (!response.target) {
    console.log("Project creation cancelled");
    process.exit(0);
  }

  const target = response.target as "browser" | "node" | "both";

  const structure: DirEntry = {
    files: [
      { name: "package.json", content: genPackageJson(name, target) },
      { name: "tsconfig.json", content: genTsConfig(target) },
      { name: "build.js", content: genBuildConfig(name, target) },
      { name: "README.md", content: genReadMe(name, target) },
      { name: ".gitignore", content: genGitIgnore() },
      { name: ".env", content: genEnv() },
    ],
    dirs: [
      {
        name: "src",
        files: getSrcFiles(target),
      },
    ],
  };

  createStructure(baseDir, structure);

  process.chdir(baseDir);

  console.log(`TypeScript project created for ${target} environment`);
}

function getSrcFiles(target: "browser" | "node" | "both") {
  switch (target) {
    case "both":
      return [
        { name: "index.ts", content: genIndexTs() },
        { name: "index.browser.ts", content: genBrowserIndexTs() },
        { name: "index.node.ts", content: genNodeIndexTs() },
      ];
    case "browser":
      return [{ name: "index.ts", content: genBrowserIndexTs() }];
    case "node":
      return [{ name: "index.ts", content: genNodeIndexTs() }];
  }
}

function genPackageJson(name: string, target: "browser" | "node" | "both") {
  const pkg: any = {
    name,
    version: "1.0.0",
    type: "module",
    scripts: {
      build: "node build.js",
      dev: "node build.js --watch",
      clean: "rm -rf dist",
    },
    devDependencies: {
      typescript: "^5.9.3",
      esbuild: "^0.27.2",
      "@types/node": "^25.0.3",
    },
  };

  if (target === "node") {
    pkg.main = "dist/index.mjs";
    pkg.types = "./dist/types/index.d.ts";
  } else if (target === "browser") {
    pkg.main = "dist/index.mjs";
    pkg.types = "./dist/types/index.d.ts";
  } else if (target === "both") {
    pkg.exports = {
      ".": {
        browser: {
          import: "./dist/browser/index.mjs",
        },
        node: {
          import: "./dist/node/index.mjs",
        },
        types: "./dist/types/index.d.ts",
      },
    };
  }

  return JSON.stringify(pkg, null, 2);
}

function genTsConfig(target: "browser" | "node" | "both") {
  const config: any = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: true,
      declarationMap: true,
      emitDeclarationOnly: true,
      outDir: "./dist/types",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"],
      },
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  };

  if (target === "browser" || target === "both") {
    config.compilerOptions.lib = ["ES2020", "DOM"];
  } else {
    config.compilerOptions.lib = ["ES2020"];
  }

  return JSON.stringify(config, null, 2);
}

function genBuildConfig(name: string, target: "browser" | "node" | "both") {
  return `import * as esbuild from "esbuild";
import { execSync } from "child_process";
import path from "path";

const isWatch = process.argv.includes('--watch');


const aliasPlugin = {
  name: 'alias',
  setup(build) {
    build.onResolve({ filter: /^@\/ }, args => {
      return {
        path: path.resolve(__dirname, 'src', args.path.slice(2))
      };
    });
  }
};

const buildConfigs = ${JSON.stringify(getBuildConfigs(target), null, 2).replace(
    /"plugins": null/g,
    '"plugins": [aliasPlugin]'
  )};

async function build() {
  try {
    execSync('rm -rf dist', { stdio: 'inherit' });
    
    
    for (const config of buildConfigs) {
      console.log(\`Building \${config.outfile}...\`);
      
      if (isWatch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
        console.log(\`Watching \${config.outfile}...\`);
      } else {
        await esbuild.build(config);
      }
    }

    console.log('Generating TypeScript declarations...');
    execSync("npx tsc", {
        stdio: "inherit",
    });

    if (!isWatch) {
      console.log('Build successful!');
    } else {
      console.log('Initial build complete. Watching for changes...');
    }
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

build();
`;
}

function getBuildConfigs(target: "browser" | "node" | "both") {
  const baseConfig = {
    bundle: true,
    sourcemap: true,
    minify: false,
    plugins: null,
  };

  switch (target) {
    case "browser":
      return [
        {
          ...baseConfig,
          entryPoints: ["src/index.ts"],
          outfile: "dist/index.mjs",
          platform: "browser",
          format: "esm",
          target: ["es2020"],
          external: [],
        },
      ];

    case "node":
      return [
        {
          ...baseConfig,
          entryPoints: ["src/index.ts"],
          outfile: "dist/index.mjs",
          platform: "node",
          format: "esm",
          target: ["node18"],
          packages: "external",
        },
      ];

    case "both":
      return [
        {
          ...baseConfig,
          entryPoints: ["src/index.browser.ts"],
          outfile: "dist/browser/index.mjs",
          platform: "browser",
          format: "esm",
          target: ["es2020"],
          external: [],
        },
        {
          ...baseConfig,
          entryPoints: ["src/index.node.ts"],
          outfile: "dist/node/index.mjs",
          platform: "node",
          format: "esm",
          target: ["node18"],
          packages: "external",
        },
      ];
  }
}

function genReadMe(name: string, target: "browser" | "node" | "both") {
  return `# ${name}

TypeScript project configured for **${target}** environment(s).

## Features

- Fast builds with esbuild
- Proper bundling for ${target}
- Source maps for debugging
- TypeScript declarations
- Watch mode for development

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

Watch mode will automatically rebuild when you change files.

## Build

\`\`\`bash
npm run build
\`\`\`

This will:
1. Bundle your code with esbuild
2. Generate TypeScript declarations
3. Create source maps

## Clean

\`\`\`bash
npm run clean
\`\`\`

${
  target === "both"
    ? `
## Usage

This package builds separate bundles for browser and Node.js:

### In Browser
\`\`\`javascript
import { platform } from '${name}';

console.log(platform); 
\`\`\`

### In Node.js
\`\`\`javascript
import { platform } from '${name}';

console.log(platform); 
\`\`\`
`
    : target === "browser"
    ? `
## Usage

\`\`\`javascript
import { platform } from '${name}';
console.log(platform); 
\`\`\`

Include \`dist/index.mjs\` in your HTML or bundle with your favorite bundler.
`
    : `
## Usage

\`\`\`javascript
import { platform } from '${name}';
console.log(platform); 
\`\`\`
`
}

## Build Output

- \`dist/*.mjs\` - Bundled JavaScript (ESM)
- \`dist/types/*.d.ts\` - TypeScript declarations
- \`dist/*.map\` - Source maps
`;
}

function genGitIgnore() {
  return `node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.vscode/
.idea/
*.tsbuildinfo
`;
}

function genEnv() {
  return `# Environment variables
`;
}

function genIndexTs() {
  return `
export * from './index.browser.js';
export * from './index.node.js';
`;
}

function genBrowserIndexTs() {
  return `
export const platform = 'browser' as const;

export function getBrowserInfo() {
  if (typeof window !== 'undefined') {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
    };
  }
  return null;
}

console.log('Running in browser environment');
`;
}

function genNodeIndexTs() {
  return `
import { platform as osPlatform, arch } from 'os';

export const platform = 'node' as const;

export function getNodeInfo() {
  return {
    platform: osPlatform(),
    arch: arch(),
    nodeVersion: process.version,
  };
}

console.log('Running in Node.js environment');
`;
}
