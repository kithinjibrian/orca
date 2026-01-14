import * as fs from "fs/promises";

export interface HtmlPreprocessorOptions {
  injectScripts?: string[];
  injectStyles?: string[];
  replaceVariables?: Record<string, string>;
  transformers?: HtmlTransformer[];
  minify?: boolean;
}

export type HtmlTransformer = (html: string) => string | Promise<string>;

export class HtmlPreprocessor {
  private options: HtmlPreprocessorOptions;

  constructor(options: HtmlPreprocessorOptions = {}) {
    this.options = options;
  }

  async processFile(inputPath: string, outputPath: string): Promise<void> {
    const html = await fs.readFile(inputPath, "utf-8");
    const processed = await this.process(html);
    await fs.writeFile(outputPath, processed, "utf-8");
  }

  async process(html: string): Promise<string> {
    let result = html;

    if (this.options.transformers) {
      for (const transformer of this.options.transformers) {
        result = await transformer(result);
      }
    }

    if (this.options.injectScripts && this.options.injectScripts.length > 0) {
      result = this.injectScripts(result, this.options.injectScripts);
    }

    if (this.options.injectStyles && this.options.injectStyles.length > 0) {
      result = this.injectStyles(result, this.options.injectStyles);
    }

    if (this.options.replaceVariables) {
      result = this.replaceVariables(result, this.options.replaceVariables);
    }

    if (this.options.minify) {
      result = this.minify(result);
    }

    return result;
  }

  private injectScripts(html: string, scripts: string[]): string {
    const scriptTags = scripts
      .map((src) => `  <script src="${src}"></script>`)
      .join("\n");

    if (html.includes("</body>")) {
      return html.replace("</body>", `${scriptTags}\n</body>`);
    } else if (html.includes("</head>")) {
      return html.replace("</head>", `${scriptTags}\n</head>`);
    } else {
      return html + `\n${scriptTags}`;
    }
  }

  private injectStyles(html: string, styles: string[]): string {
    const styleTags = styles
      .map((href) => `  <link rel="stylesheet" href="${href}">`)
      .join("\n");

    if (html.includes("</head>")) {
      return html.replace("</head>", `${styleTags}\n</head>`);
    } else if (html.includes("<head>")) {
      return html.replace("<head>", `<head>\n${styleTags}`);
    } else {
      return styleTags + "\n" + html;
    }
  }

  private replaceVariables(
    html: string,
    variables: Record<string, string>
  ): string {
    let result = html;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
    }
    return result;
  }

  private minify(html: string): string {
    return html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }
}

export function createHotReloadTransformer(
  port: number
): (html: string) => string {
  return (html: string) => {
    const hotReloadScript = `
<script>
(function() {
  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connect() {
    ws = new WebSocket('ws://localhost:${port}');
    
    ws.onopen = () => {
      reconnectAttempts = 0;
    };
    
    ws.onmessage = (event) => {
      if (event.data === 'reload') {
        window.location.reload();
      }
    };
    
    ws.onclose = () => {      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(\`🔄 Reconnecting... (attempt \${reconnectAttempts}/\${maxReconnectAttempts})\`);
        setTimeout(connect, 1000 * reconnectAttempts);
      } else {
        console.log('❌ Max reconnection attempts reached');
      }
    };
    
    ws.onerror = (error) => {
      console.error('🔥 Hot reload error:', error);
    };
  }
  
  connect();
})();
</script>`;

    if (html.includes("</body>")) {
      return html.replace("</body>", `${hotReloadScript}\n</body>`);
    }
    return html + hotReloadScript;
  };
}

export const createMetaTagsTransformer = (
  meta: Record<string, string>
): HtmlTransformer => {
  return (html: string) => {
    const metaTags = Object.entries(meta)
      .map(([name, content]) => `  <meta name="${name}" content="${content}">`)
      .join("\n");

    if (html.includes("</head>")) {
      return html.replace("</head>", `${metaTags}\n</head>`);
    } else if (html.includes("<head>")) {
      return html.replace("<head>", `<head>\n${metaTags}`);
    }
    return metaTags + "\n" + html;
  };
};

export async function preprocessHtml(
  inputPath: string,
  outputPath: string,
  options?: HtmlPreprocessorOptions
): Promise<void> {
  const preprocessor = new HtmlPreprocessor(options);
  await preprocessor.processFile(inputPath, outputPath);
}
