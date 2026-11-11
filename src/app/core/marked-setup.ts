import { marked, Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
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

export const BLOCK_MATH_DOLLAR = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/;
export const BLOCK_MATH_BRACKET = /^\s*\\\[([\s\S]+?)\\\]\s*(?:\n|$)/;

export const INLINE_BLOCK_DOLLAR = /^\$\$(?!\$)([\s\S]+?)\$\$(?!\$)/;
export const INLINE_BLOCK_BRACKET = /^\\\[([\s\S]+?)\\\]/;
export const INLINE_PAREN = /^\\\(([\s\S]+?)\\\)/;
export const INLINE_DOLLAR = /^\$(?!\s|\$)((?:\\.|[^\s\\\n\r$])(?:(?:\\.|[^\\\n\r$])*?(?:\\.|[^\s\\\n\r$(“‘]))?)\$(?![0-9$])/;

export interface InlineMathMatch {
  raw: string;
  text: string;
  displayMode: boolean;
}

export function isValidInlineDollarStart(prevChar: string): boolean {
  return !prevChar || !/[a-zA-Z0-9\\$]/.test(prevChar);
}

export function matchInlineMathAt(str: string, prevChar: string): InlineMathMatch | null {
  if (prevChar !== '\\') {
    if (str.startsWith('$$') && prevChar !== '$') {
      const m = str.match(INLINE_BLOCK_DOLLAR);
      if (m && m[1].trim()) {
        return { raw: m[0], text: m[1].trim(), displayMode: true };
      }
    }
    if (str.startsWith('\\[')) {
      const m = str.match(INLINE_BLOCK_BRACKET);
      if (m && m[1].trim()) {
        return { raw: m[0], text: m[1].trim(), displayMode: true };
      }
    }
    if (str.startsWith('\\(')) {
      const m = str.match(INLINE_PAREN);
      if (m && m[1].trim()) {
        return { raw: m[0], text: m[1].trim(), displayMode: false };
      }
    }
  }

  if (str.startsWith('$') && !str.startsWith('$$') && isValidInlineDollarStart(prevChar)) {
    const m = str.match(INLINE_DOLLAR);
    if (m && m[1].trim()) {
      return { raw: m[0], text: m[1].trim(), displayMode: false };
    }
  }

  return null;
}

function renderMathInHtmlSegment(htmlText: string): string {
  // 1. Process block equations $$...$$ and \[...\]
  let result = htmlText.replace(/\$\$([\s\S]+?)\$\$/g, (match: string, p1: string) => {
    if (!p1.trim()) return match;
    try {
      return katex.renderToString(p1.trim(), { displayMode: true, output: 'mathml', throwOnError: false });
    } catch {
      return match;
    }
  });

  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match: string, p1: string) => {
    if (!p1.trim()) return match;
    try {
      return katex.renderToString(p1.trim(), { displayMode: true, output: 'mathml', throwOnError: false });
    } catch {
      return match;
    }
  });

  // 2. Process standard LaTeX inline equations \(...\)
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (match: string, p1: string) => {
    if (!p1.trim()) return match;
    try {
      return katex.renderToString(p1.trim(), { displayMode: false, output: 'mathml', throwOnError: false });
    } catch {
      return match;
    }
  });

  // 3. Process single-dollar inline equations $...$ with strict boundary checks
  let out = '';
  let i = 0;
  while (i < result.length) {
    if (result[i] === '$') {
      const prevChar = i === 0 ? '' : result[i - 1];
      const matched = matchInlineMathAt(result.slice(i), prevChar);
      if (matched) {
        try {
          out += katex.renderToString(matched.text, {
            displayMode: matched.displayMode,
            output: 'mathml',
            throwOnError: false
          });
          i += matched.raw.length;
          continue;
        } catch {
          // fallback to literal
        }
      }
    }
    out += result[i];
    i++;
  }

  return out;
}

function getNormalizedSchemePrefix(val: string): string {
  let out = '';
  for (let i = 0; i < val.length && out.length < 32; i++) {
    const code = val.charCodeAt(i);
    if (code > 32) {
      out += val[i];
    }
  }
  return out.toLowerCase();
}

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

      // Remove all event handlers (onerror, onload, onclick, etc.) and srcdoc
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        continue;
      }

      // Check URL attributes for executable schemes using prefix inspection
      if (name === 'href' || name === 'xlink:href' || name === 'action' || name === 'formaction') {
        const normalizedPrefix = getNormalizedSchemePrefix(val);
        if (
          normalizedPrefix.startsWith('javascript:') ||
          normalizedPrefix.startsWith('vbscript:') ||
          normalizedPrefix.startsWith('data:')
        ) {
          el.removeAttribute(attr.name);
          continue;
        }
      }

      if (name === 'src' || name === 'data' || name === 'poster') {
        const normalizedPrefix = getNormalizedSchemePrefix(val);
        if (
          normalizedPrefix.startsWith('javascript:') ||
          normalizedPrefix.startsWith('vbscript:') ||
          (normalizedPrefix.startsWith('data:') && !normalizedPrefix.startsWith('data:image/'))
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

    if (el.tagName.toLowerCase() === 'img') {
      const srcVal = el.getAttribute('src');
      const activeImages = getActiveImages();
      if (srcVal && activeImages && activeImages[srcVal]) {
        el.setAttribute('src', activeImages[srcVal]);
      }
    }
  });

  return doc.body.innerHTML;
}

interface KatexToken extends Tokens.Generic {
  type: 'inlineKatex' | 'blockKatex';
  raw: string;
  text: string;
  displayMode: boolean;
}

let isConfigured = false;
let hasScopedImages = false;
let scopedImages: Record<string, string> | undefined = undefined;

function getActiveImages(): Record<string, string> | undefined {
  if (hasScopedImages) {
    return scopedImages;
  }
  return typeof window !== 'undefined' ? window.__SILA_IMAGES__ : undefined;
}

export function getConfiguredMarked() {
  if (!isConfigured) {
    marked.use(markedFootnote());

    marked.use({
      extensions: [
        {
          name: 'blockKatex',
          level: 'block',
          start(src: string) {
            const re = /(?:^|\n)(\s*(?:\$\$|\\\[))/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(src)) !== null) {
              const idx = m[0].startsWith('\n') ? m.index + 1 : m.index;
              const sub = src.slice(idx);
              if (BLOCK_MATH_DOLLAR.test(sub) || BLOCK_MATH_BRACKET.test(sub)) {
                return idx;
              }
            }
            return undefined;
          },
          tokenizer(src: string) {
            let m = src.match(BLOCK_MATH_DOLLAR);
            if (!m) m = src.match(BLOCK_MATH_BRACKET);
            if (m && m[1].trim()) {
              return {
                type: 'blockKatex',
                raw: m[0],
                text: m[1].trim(),
                displayMode: true
              };
            }
            return undefined;
          },
          renderer(token: Tokens.Generic) {
            const kToken = token as KatexToken;
            return katex.renderToString(kToken.text, {
              displayMode: true,
              output: 'mathml',
              throwOnError: false
            }) + '\n';
          }
        },
        {
          name: 'inlineKatex',
          level: 'inline',
          start(src: string) {
            for (let i = 0; i < src.length; i++) {
              const ch = src[i];
              if (ch === '$' || (ch === '\\' && (src[i + 1] === '(' || src[i + 1] === '['))) {
                const prevChar = i === 0 ? '' : src[i - 1];
                if (matchInlineMathAt(src.slice(i), prevChar)) {
                  return i;
                }
              }
            }
            return undefined;
          },
          tokenizer(src: string, tokens: Tokens.Generic[]) {
            const prevRaw = tokens && tokens.length > 0 ? (tokens[tokens.length - 1].raw || '') : '';
            const prevChar = prevRaw.length > 0 ? prevRaw[prevRaw.length - 1] : '';
            const matched = matchInlineMathAt(src, prevChar);
            if (matched) {
              return {
                type: 'inlineKatex',
                raw: matched.raw,
                text: matched.text,
                displayMode: matched.displayMode
              };
            }
            return undefined;
          },
          renderer(token: Tokens.Generic) {
            const kToken = token as KatexToken;
            return katex.renderToString(kToken.text, {
              displayMode: kToken.displayMode,
              output: 'mathml',
              throwOnError: false
            });
          }
        }
      ],
      walkTokens(token: { type?: string; text?: string }) {
        if (token.type === 'html' && typeof token.text === 'string') {
          token.text = renderMathInHtmlSegment(token.text);
        }
      },
      renderer: {
        heading(token) {
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
            id = parsedText.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w-]+/g, '-');
          }
          return `<h${token.depth} id="${id}">${parsedText}</h${token.depth}>\n`;
        },
        image(token) {
          let out = `<img src="${token.href}" alt="${token.text}"`;
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

export function parseMarkdownWithImages(src: string, customImages?: Record<string, string>): string {
  const m = getConfiguredMarked();
  hasScopedImages = true;
  scopedImages = customImages;
  try {
    return m.parse(src) as string;
  } finally {
    hasScopedImages = false;
    scopedImages = undefined;
  }
}
