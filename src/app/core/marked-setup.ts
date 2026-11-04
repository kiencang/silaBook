import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import markedKatex from 'marked-katex-extension';
import katex from 'katex';

declare global {
  interface Window {
    __SILA_IMAGES__?: Record<string, string>;
  }
}

const DANGEROUS_TAGS = [
  'script', 'iframe', 'object', 'embed', 'applet', 'form',
  'meta', 'base', 'link', 'style', 'frame', 'frameset',
  'marquee', 'foreignobject', 'set', 'animate', 'animatetransform', 'animatemotion'
];

export function sanitizeHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html || '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Remove dangerous executable elements
  const dangerousSelector = DANGEROUS_TAGS.join(',');
  doc.querySelectorAll(dangerousSelector).forEach(el => el.remove());

  // 2. Inspect all remaining elements and strip dangerous attributes
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      const normalizedVal = Array.from(val)
        .filter(ch => ch.charCodeAt(0) > 32)
        .join('')
        .toLowerCase();

      // Remove all event handlers (onerror, onload, onclick, etc.) and srcdoc
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        continue;
      }

      // Check URL attributes for executable schemes
      if (name === 'href' || name === 'xlink:href' || name === 'action' || name === 'formaction') {
        if (
          normalizedVal.startsWith('javascript:') ||
          normalizedVal.startsWith('vbscript:') ||
          normalizedVal.startsWith('data:')
        ) {
          el.removeAttribute(attr.name);
          continue;
        }
      }

      if (name === 'src' || name === 'data' || name === 'poster') {
        if (
          normalizedVal.startsWith('javascript:') ||
          normalizedVal.startsWith('vbscript:') ||
          (normalizedVal.startsWith('data:') && !normalizedVal.startsWith('data:image/'))
        ) {
          el.removeAttribute(attr.name);
          continue;
        }
      }

      // Sanitize inline style against legacy expression() or javascript: URLs
      if (name === 'style') {
        if (/expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding/i.test(val)) {
          el.removeAttribute(attr.name);
        }
      }
    }
  });

  return doc.body.innerHTML;
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
      walkTokens(token: { type?: string; text?: string }) {
        if (token.type === 'html' && typeof token.text === 'string') {
          // Process block equations $$...$$ inside HTML
          token.text = token.text.replace(/\$\$(.*?)\$\$/gs, (match: string, p1: string) => {
            try {
              return katex.renderToString(p1, { displayMode: true, output: 'mathml', throwOnError: false });
            } catch {
              return match;
            }
          });
          // Process inline equations $...$ inside HTML
          token.text = token.text.replace(/\$([^$\n]+?)\$/g, (match: string, p1: string) => {
            try {
              return katex.renderToString(p1, { displayMode: false, output: 'mathml', throwOnError: false });
            } catch {
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

    const originalParse = marked.parse.bind(marked);
    marked.parse = ((src: string, options?: Parameters<typeof marked.parse>[1]) => {
      const result = originalParse(src, options);
      if (typeof result === 'string') {
        return sanitizeHtml(result);
      }
      return result.then((html: string) => sanitizeHtml(html));
    }) as typeof marked.parse;

    isConfigured = true;
  }
  return marked;
}
