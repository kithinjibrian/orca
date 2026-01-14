"use client";
import { apply$, style$ } from "@kithinji/arcane";
import { Component, computed } from "@kithinji/orca";
import { ContentService } from "../content.service";
import { marked } from "marked";
import hljs from "highlight.js";

const cls = style$({
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "0 1rem",
  },
  content_block: {
    padding: "20px",
    marginBottom: "20px",
    borderRadius: "8px",
    borderLeft: "4px solid #333",
  },
  // Code block wrapper
  code_wrapper: {
    position: "relative",
    marginTop: "1.5rem",
    marginBottom: "2rem",
  },
  // Copy button
  copy_button: {
    position: "absolute",
    top: "0.75rem",
    right: "0.75rem",
    backgroundColor: "#3a3a3a",
    color: "#e8e8e8",
    border: "1px solid #4a4a4a",
    borderRadius: "4px",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.2s",
    zIndex: 10,
  },
  copy_button_hover: {
    backgroundColor: "#4a4a4a",
  },
  copy_button_copied: {
    backgroundColor: "#ff5722",
    borderColor: "#ff5722",
  },
  // Heading styles
  h1: {
    fontSize: "2.25rem",
    fontWeight: "bold",
    marginTop: "1rem",
    marginBottom: "1.5rem",
    color: "#ffffff",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
  },
  h2: {
    fontSize: "1.75rem",
    fontWeight: "bold",
    marginTop: "2.5rem",
    marginBottom: "1.25rem",
    color: "#e8e8e8",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
  },
  h3: {
    fontSize: "1.375rem",
    fontWeight: "600",
    marginTop: "2rem",
    marginBottom: "1rem",
    color: "#d0d0d0",
    lineHeight: "1.4",
  },
  // Paragraph
  paragraph: {
    fontSize: "1rem",
    marginBottom: "1.5rem",
    lineHeight: "1.8",
    color: "#c0c0c0",
    letterSpacing: "0.01em",
  },
  // Code blocks
  pre: {
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    padding: "1.5rem",
    overflowX: "auto",
    border: "1px solid #3a3a3a",
    fontSize: "0.9rem",
    lineHeight: "1.6",
    margin: 0,
  },
  code: {
    backgroundColor: "#1a1a1a",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "0.9em",
    fontFamily: "monospace",
    color: "#ff5722",
    border: "1px solid #3a3a3a",
  },
  // Blockquote
  blockquote: {
    borderLeft: "4px solid #ff5722",
    paddingLeft: "1.5rem",
    marginLeft: "0",
    marginTop: "1.5rem",
    marginBottom: "2rem",
    fontStyle: "italic",
    color: "#a0a0a0",
    fontSize: "1rem",
    lineHeight: "1.8",
  },
  // Lists
  ul: {
    listStyle: "disc",
    paddingLeft: "2rem",
    marginTop: "1rem",
    marginBottom: "2rem",
    color: "#c0c0c0",
    fontSize: "1rem",
  },
  ol: {
    listStyle: "decimal",
    paddingLeft: "2rem",
    marginTop: "1rem",
    marginBottom: "2rem",
    color: "#c0c0c0",
    fontSize: "1rem",
  },
  li: {
    marginBottom: "0.75rem",
    lineHeight: "1.8",
  },
  // Links
  link: {
    color: "#58a6ff",
    textDecoration: "none",
    borderBottom: "1px solid transparent",
    transition: "border-color 0.2s",
  },
  // Strong/Bold
  strong: {
    fontWeight: "600",
    color: "#e8e8e8",
  },
  // Horizontal rule
  hr: {
    border: "none",
    borderTop: "1px solid #3a3a3a",
    marginTop: "3rem",
    marginBottom: "3rem",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1.5rem 0",
  },

  navButton: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "1rem 1.25rem",
    minWidth: "160px",

    background: "#242424",
    border: "1px solid #161616",
    borderRadius: "12px",

    cursor: "pointer",
    textAlign: "left",

    transition: "background 0.2s ease, border-color 0.2s ease",
  },

  label: {
    fontSize: "0.8rem",
    color: "#777",
  },

  title: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "white",
  },

  next: {
    textAlign: "right",
    alignItems: "flex-end",
  },
});

let codeBlockId = 0;

// Helper function to properly escape HTML for attribute values
function escapeHtmlAttribute(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

marked.use({
  renderer: {
    code(token) {
      const code = token.text;
      const language = token.lang || "";
      const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
      const highlighted = hljs.highlight(code, {
        language: validLanguage,
      }).value;

      const blockId = `code-block-${codeBlockId++}`;
      const escapedCode = escapeHtmlAttribute(code);

      return `
        <div class="${cls.code_wrapper}">
          <button 
            class="${cls.copy_button}" 
            onclick="copyCode('${blockId}', this)"
            onmouseenter="this.style.backgroundColor='#4a4a4a'"
            onmouseleave="if(!this.classList.contains('copied')) this.style.backgroundColor='#3a3a3a'"
          >
            Copy
          </button>
          <pre class="${cls.pre}" id="${blockId}" data-code="${escapedCode}"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
        </div>
      `;
    },
    codespan(token) {
      const code = token.text;
      return `<code class="${cls.code}">${code}</code>`;
    },
  },
  hooks: {
    postprocess(html) {
      return html
        .replace(/<h1>/g, `<h1 class="${cls.h1}">`)
        .replace(/<h2>/g, `<h2 class="${cls.h2}">`)
        .replace(/<h3>/g, `<h3 class="${cls.h3}">`)
        .replace(/<p>/g, `<p class="${cls.paragraph}">`)
        .replace(/<blockquote>/g, `<blockquote class="${cls.blockquote}">`)
        .replace(/<ul>/g, `<ul class="${cls.ul}">`)
        .replace(/<ol>/g, `<ol class="${cls.ol}">`)
        .replace(/<li>/g, `<li class="${cls.li}">`)
        .replace(/<a href=/g, `<a class="${cls.link}" href=`)
        .replace(/<strong>/g, `<strong class="${cls.strong}">`)
        .replace(/<hr>/g, `<hr class="${cls.hr}">`);
    },
  },
});

@Component()
export class MainArea {
  constructor(private readonly contentService: ContentService) {
    this.contentService.get(1);

    // Add copy function to window
    if (typeof window !== "undefined") {
      (window as any).copyCode = this.copyCode.bind(this);
    }
  }

  copyCode(blockId: string, button: HTMLButtonElement) {
    const codeBlock = document.getElementById(blockId);
    if (!codeBlock) return;

    // Decode HTML entities from the data-code attribute
    const encodedCode = codeBlock.getAttribute("data-code");
    if (!encodedCode) return;

    const textarea = document.createElement("textarea");
    textarea.innerHTML = encodedCode;
    const code = textarea.value;

    navigator.clipboard.writeText(code).then(() => {
      const originalText = button.innerText;
      button.innerText = "Copied!";
      button.style.backgroundColor = "#ff5722";
      button.style.borderColor = "#ff5722";
      button.classList.add("copied");

      setTimeout(() => {
        button.innerText = originalText;
        button.style.backgroundColor = "#3a3a3a";
        button.style.borderColor = "#4a4a4a";
        button.classList.remove("copied");
      }, 2000);
    });
  }

  build() {
    const h = computed(() => {
      const markdown = this.contentService.current.value.content;
      const html = marked.parse(markdown, {
        async: false,
      });
      return html;
    });

    return (
      <main {...apply$(cls.main)}>
        <div dangerouslySetInnerHTML={{ __html: h.value }} />

        <div {...apply$(cls.footer)}>
          {this.contentService.current.value.prev ? (
            <button
              {...apply$(cls.navButton)}
              onClick={() => {
                this.contentService.get(
                  this.contentService.current.value.prev?.id!
                );
              }}
            >
              <span {...apply$(cls.label)}>Previous</span>
              <span {...apply$(cls.title)}>
                {this.contentService.current.value.prev?.label}
              </span>
            </button>
          ) : (
            <div></div>
          )}

          {this.contentService.current.value.next && (
            <button
              {...apply$(cls.navButton, cls.next)}
              onClick={() => {
                this.contentService.get(
                  this.contentService.current.value.next?.id!
                );
              }}
            >
              <span {...apply$(cls.label)}>Next</span>
              <span {...apply$(cls.title)}>
                {this.contentService.current.value.next?.label}
              </span>
            </button>
          )}
        </div>
      </main>
    );
  }
}
