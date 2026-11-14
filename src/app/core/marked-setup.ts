import { marked, Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
import katex from 'katex';

declare global {
  interface Window {
    __SILA_IMAGES__?: Record<string, string>;
  }
}

const DROP_SUBTREE_TAGS = [
  'script', 'style', 'template', 'noscript', 'textarea', 'title', 'xmp',
  'noembed', 'noframes', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'svg', 'annotation-xml', 'form', 'input', 'button', 'select',
  'option', 'optgroup', 'datalist', 'keygen', 'output', 'canvas', 'audio',
  'video', 'source', 'track', 'map', 'area', 'base', 'link', 'meta', 'head',
  'marquee', 'foreignobject', 'set', 'animate', 'animatetransform',
  'animatemotion', 'portal', 'slot', 'shadow'
];

const DROP_SUBTREE_SELECTOR = DROP_SUBTREE_TAGS.join(',');

const ALLOWED_HTML_TAGS = new Set([
  // Document & Structural Block Tags
  'div', 'span', 'p', 'br', 'hr', 'section', 'article', 'aside',
  'header', 'footer', 'main', 'nav', 'blockquote', 'pre', 'code',
  'figure', 'figcaption', 'details', 'summary', 'address', 'center', 'hgroup',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists & Definition Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'dir', 'menu',
  // Tables
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  // Inline Typography & CJK Ruby Annotations
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'cite', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'q', 'rp', 'rt', 'rtc',
  'ruby', 's', 'samp', 'small', 'strike', 'strong', 'sub', 'sup', 'time',
  'tt', 'u', 'var', 'wbr',
  // Media
  'img', 'picture'
]);

const ALLOWED_MATHML_TAGS = new Set([
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mn', 'mo', 'mtext',
  'mspace', 'ms', 'mglyph', 'mfrac', 'msqrt', 'mroot', 'mstyle', 'merror',
  'mpadded', 'mphantom', 'mfenced', 'menclose', 'msub', 'msup', 'msubsup',
  'munder', 'mover', 'munderover', 'mmultiscripts', 'mprescripts', 'none',
  'mtable', 'mlabeledtr', 'mtr', 'mtd', 'maligngroup', 'malignmark', 'maction'
]);

export function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

const ALLOWED_DATA_IMAGE_PREFIXES = [
  'data:image/png;',
  'data:image/png,',
  'data:image/jpeg;',
  'data:image/jpeg,',
  'data:image/jpg;',
  'data:image/jpg,',
  'data:image/gif;',
  'data:image/gif,',
  'data:image/webp;',
  'data:image/webp,',
  'data:image/svg+xml;',
  'data:image/svg+xml,'
];

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

function isAllowedDataImagePrefix(normalizedPrefix: string): boolean {
  return ALLOWED_DATA_IMAGE_PREFIXES.some(prefix => normalizedPrefix.startsWith(prefix));
}

function isSafeImgSrcPrefix(normalizedPrefix: string): boolean {
  if (normalizedPrefix.startsWith('javascript:') || normalizedPrefix.startsWith('vbscript:')) {
    return false;
  }
  if (normalizedPrefix.startsWith('data:')) {
    return isAllowedDataImagePrefix(normalizedPrefix);
  }
  return true;
}

export function sanitizeHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Remove dangerous executable, raw-text, and mXSS-vector elements along with their subtrees
  doc.querySelectorAll(DROP_SUBTREE_SELECTOR).forEach(el => el.remove());

  // 2. Enforce strict HTML & MathML tag allowlist and sanitize attributes
  const allElements = Array.from(doc.body.querySelectorAll('*'));
  for (const el of allElements) {
    if (!el.isConnected) continue;

    const tagName = el.tagName.toLowerCase();
    const inMath = el.closest('math') !== null;

    if (inMath) {
      if (!ALLOWED_MATHML_TAGS.has(tagName)) {
        el.remove();
        continue;
      }
    } else {
      if (tagName !== 'math' && !ALLOWED_HTML_TAGS.has(tagName)) {
        el.remove();
        continue;
      }
    }

    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const val = attr.value;

      // Remove all event handlers (onerror, onload, onclick, etc.) and dangerous attributes
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        name === 'xlink:href' ||
        name === 'action' ||
        name === 'formaction'
      ) {
        el.removeAttribute(attr.name);
        continue;
      }

      // Only <img> is allowed to carry a src attribute; strictly allow safe URLs or whitelisted data:image/*
      if (name === 'src') {
        if (tagName !== 'img') {
          el.removeAttribute(attr.name);
          continue;
        }
        const normalizedPrefix = getNormalizedSchemePrefix(val);
        if (!isSafeImgSrcPrefix(normalizedPrefix)) {
          el.removeAttribute(attr.name);
        }
        continue;
      }

      // Block javascript:, vbscript:, and ALL data: schemes on every other URL-bearing attribute
      if (
        name === 'href' ||
        name === 'data' ||
        name === 'poster' ||
        name === 'cite' ||
        name === 'background'
      ) {
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

      // Sanitize inline style against legacy expression(), URL schemes, or @import
      if (name === 'style') {
        if (/expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:|-moz-binding|@import|behavior\s*:/i.test(val)) {
          el.removeAttribute(attr.name);
        }
      }
    }

    if (tagName === 'img') {
      const srcVal = el.getAttribute('src');
      const activeImages = getActiveImages();
      if (srcVal && activeImages && activeImages[srcVal]) {
        const resolvedSrc = activeImages[srcVal];
        const resolvedPrefix = getNormalizedSchemePrefix(resolvedSrc);
        if (isSafeImgSrcPrefix(resolvedPrefix)) {
          el.setAttribute('src', resolvedSrc);
        } else {
          el.removeAttribute('src');
        }
      }
    }
  }

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
          return `<h${token.depth} id="${escapeHtmlAttr(id)}">${parsedText}</h${token.depth}>\n`;
        },
        image(token) {
          let out = `<img src="${escapeHtmlAttr(token.href || '')}" alt="${escapeHtmlAttr(token.text || '')}"`;
          if (token.title) {
            out += ` title="${escapeHtmlAttr(token.title)}"`;
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
