import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import markedKatex from 'marked-katex-extension';
import katex from 'katex';

declare global {
  interface Window {
    __SILA_IMAGES__?: Record<string, string>;
  }
}

let isConfigured = false;

export function getConfiguredMarked() {
  if (!isConfigured) {
    marked.use(markedFootnote());
    marked.use(markedKatex({
      throwOnError: false,
      output: 'mathml',
      nonStandard: true
    }));
    
    marked.use({
      walkTokens(token: any) {
        if (token.type === 'html') {
          // Process block equations $$...$$ inside HTML
          token.text = token.text.replace(/\$\$(.*?)\$\$/gs, (match: string, p1: string) => {
            try {
              return katex.renderToString(p1, { displayMode: true, output: 'mathml', throwOnError: false });
            } catch (e) {
              return match;
            }
          });
          // Process inline equations $...$ inside HTML
          token.text = token.text.replace(/\$([^\$\n]+?)\$/g, (match: string, p1: string) => {
            try {
              return katex.renderToString(p1, { displayMode: false, output: 'mathml', throwOnError: false });
            } catch (e) {
              return match;
            }
          });
        }
      },
      renderer: {
        heading(token) {
          // Token is just a single object in marked v12+
          // we use text and tokens to parse inner html
          let parsedText = '';
          if (typeof this.parser?.parseInline === 'function') {
            parsedText = this.parser.parseInline(token.tokens || []);
          } else {
            parsedText = token.text;
          }

          let id = '';
          const idMatch = parsedText.match(/(.*?)\s*\{#([^}]+)\}\s*$/);
          if (idMatch) {
            parsedText = idMatch[1];
            id = idMatch[2];
          } else {
            // Generate basic slug if no ID exists (default markdown behavior)
            id = parsedText.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w-]+/g, '-');
          }
          return `<h${token.depth} id="${id}">${parsedText}</h${token.depth}>\n`;
        },
        image(token) {
          let href = token.href;
          if (typeof window !== 'undefined' && window.__SILA_IMAGES__ && window.__SILA_IMAGES__[href]) {
             href = window.__SILA_IMAGES__[href];
          }
           // Use marked original logic or simple img tag
           let out = `<img src="${href}" alt="${token.text}"`;
           if (token.title) {
             out += ` title="${token.title}"`;
           }
           out += ' class="max-w-full h-auto rounded-lg" />';
           return out;
        }
      }
    });
    isConfigured = true;
  }
  return marked;
}
