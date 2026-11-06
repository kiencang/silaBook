import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  BorderStyle,
  WidthType,
  VerticalAlign,
  FootnoteReferenceRun,
  XmlComponent
} from 'docx';
import katex from 'katex';
import { mml2omml } from 'mathml2omml';
import { matchInlineMathAt } from './marked-setup';

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

function createMElement(doc: XMLDocument, tagName: string): Element {
  return doc.createElementNS(M_NS, tagName);
}

function createOmmlTextRun(doc: XMLDocument, text: string, isNor: boolean): Element {
  const r = createMElement(doc, 'm:r');
  if (isNor) {
    const rPr = createMElement(doc, 'm:rPr');
    rPr.appendChild(createMElement(doc, 'm:nor'));
    r.appendChild(rPr);
  }
  const t = createMElement(doc, 'm:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

function ensureNorOnRun(doc: XMLDocument, rEl: Element): void {
  let rPr = Array.from(rEl.childNodes).find(
    (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:rPr'
  );
  if (!rPr) {
    rPr = createMElement(doc, 'm:rPr');
    rEl.insertBefore(rPr, rEl.firstChild);
  } else if (rEl.firstChild !== rPr) {
    rEl.insertBefore(rPr, rEl.firstChild);
  }
  const hasNor = Array.from(rPr.childNodes).some(
    n => n.nodeType === 1 && n.nodeName === 'm:nor'
  );
  if (!hasNor) {
    rPr.insertBefore(createMElement(doc, 'm:nor'), rPr.firstChild);
  }
  Array.from(rPr.childNodes).forEach(n => {
    if (n.nodeType === 1 && n.nodeName === 'm:sty') {
      rPr?.removeChild(n);
    }
  });
}

function normalizeOmmlDom(doc: XMLDocument): void {
  const root = doc.documentElement;
  if (!root) return;

  // 1. Remove empty <w:rPr/> and ensure <m:rPr> is always the first child of <m:r>
  const allRuns = Array.from(root.getElementsByTagName('*')).filter(el => el.nodeName === 'm:r');
  for (const rEl of allRuns) {
    const children = Array.from(rEl.childNodes).filter((n): n is Element => n.nodeType === 1);
    for (const ch of children) {
      if (ch.nodeName === 'w:rPr' && ch.childNodes.length === 0) {
        rEl.removeChild(ch);
      }
    }
    const mrPr = Array.from(rEl.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:rPr'
    );
    if (mrPr && rEl.firstChild !== mrPr) {
      rEl.insertBefore(mrPr, rEl.firstChild);
    }
    if (mrPr) {
      const hasNor = Array.from(mrPr.childNodes).some(n => n.nodeType === 1 && n.nodeName === 'm:nor');
      if (hasNor) {
        Array.from(mrPr.childNodes).forEach(n => {
          if (n.nodeType === 1 && n.nodeName === 'm:sty') {
            mrPr.removeChild(n);
          }
        });
      }
    }
  }

  // 2. Merge split chemical element symbols before <m:sSup>, <m:sSub>, <m:sSubSup> (e.g. "C" + "a^{2+}" -> "Ca^{2+}")
  const scriptTags = new Set(['m:sSup', 'm:sSub', 'm:sSubSup']);
  const allScriptEls = Array.from(root.getElementsByTagName('*')).filter(el => scriptTags.has(el.nodeName));
  for (const scriptEl of allScriptEls) {
    const prev = scriptEl.previousElementSibling;
    if (!prev || prev.nodeName !== 'm:r') continue;
    const eEl = Array.from(scriptEl.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:e'
    );
    if (!eEl) continue;
    const firstEChild = Array.from(eEl.childNodes).find((n): n is Element => n.nodeType === 1);
    if (!firstEChild || firstEChild.nodeName !== 'm:r') continue;

    const prevT = Array.from(prev.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:t'
    );
    const eT = Array.from(firstEChild.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:t'
    );
    if (!prevT || !eT) continue;

    const prevText = prevT.textContent || '';
    const eText = eT.textContent || '';

    const matchCap = prevText.match(/^(.*?)([A-Z])$/);
    if (matchCap && /^[a-z]$/.test(eText)) {
      const prefix = matchCap[1];
      const capLetter = matchCap[2];
      eT.textContent = capLetter + eText;
      if (prefix) {
        prevT.textContent = prefix;
      } else if (prev.parentNode) {
        prev.parentNode.removeChild(prev);
      }
    }
  }

  // 3. Fix empty <m:e/> in <m:nary> (move next sibling into <m:e>) and empty <m:e/> in scripts
  const naryEls = Array.from(root.getElementsByTagName('*')).filter(el => el.nodeName === 'm:nary');
  for (const nary of naryEls) {
    const eEl = Array.from(nary.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:e'
    );
    if (eEl && eEl.childNodes.length === 0 && nary.nextElementSibling) {
      eEl.appendChild(nary.nextElementSibling);
    }
  }

  for (const scriptEl of allScriptEls) {
    const eEl = Array.from(scriptEl.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:e'
    );
    if (eEl && eEl.childNodes.length === 0) {
      eEl.appendChild(createOmmlTextRun(doc, ' ', true));
    }
  }

  // 4. Protect operators inside <m:sup> and <m:sub> so StarMath/Word never treat trailing +, -, *, ′ as incomplete binary operators
  const supSubEls = Array.from(root.getElementsByTagName('*')).filter(
    el => el.nodeName === 'm:sup' || el.nodeName === 'm:sub'
  );
  const OP_REGEX = /([+\-−*∗=′/()<>]+)/g;
  for (const supSub of supSubEls) {
    const directRuns = Array.from(supSub.childNodes).filter(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:r'
    );
    for (const rEl of directRuns) {
      const tEl = Array.from(rEl.childNodes).find(
        (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:t'
      );
      if (!tEl) continue;
      const txt = tEl.textContent || '';
      if (!OP_REGEX.test(txt)) continue;
      OP_REGEX.lastIndex = 0;

      if (!/[a-zA-Z\u0370-\u03FF]/.test(txt)) {
        ensureNorOnRun(doc, rEl);
      } else {
        const parts = txt.split(OP_REGEX).filter(Boolean);
        if (parts.length > 1 && rEl.parentNode) {
          for (const part of parts) {
            const isOp = /^[+\-−*∗=′/()<>]+$/.test(part);
            rEl.parentNode.insertBefore(createOmmlTextRun(doc, part, isOp), rEl);
          }
          rEl.parentNode.removeChild(rEl);
        } else {
          ensureNorOnRun(doc, rEl);
        }
      }
    }
  }

  // 5. Protect unbalanced parentheses across the formula (e.g., OCR "$2),$") from causing StarMath syntax errors
  const remainingRuns = Array.from(root.getElementsByTagName('*')).filter(el => el.nodeName === 'm:r');
  let openParens = 0;
  let closeParens = 0;
  for (const rEl of remainingRuns) {
    const tEl = Array.from(rEl.childNodes).find(
      (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:t'
    );
    const txt = tEl?.textContent || '';
    for (const ch of txt) {
      if (ch === '(') openParens++;
      else if (ch === ')') closeParens++;
    }
  }
  if (openParens !== closeParens) {
    for (const rEl of remainingRuns) {
      const tEl = Array.from(rEl.childNodes).find(
        (n): n is Element => n.nodeType === 1 && n.nodeName === 'm:t'
      );
      const txt = tEl?.textContent || '';
      if (txt.includes('(') || txt.includes(')')) {
        ensureNorOnRun(doc, rEl);
      }
    }
  }
}

type XmlOutput = ReturnType<XmlComponent['prepForXml']>;

class OmmlMathComponent extends XmlComponent {
  private xmlObj: XmlOutput | null;

  constructor(latex: string, display = false) {
    super("");
    let mathml = "";
    try {
      const rendered = katex.renderToString(latex, { output: 'mathml', throwOnError: false, displayMode: display });
      const match = rendered.match(/<math[^>]*>[\s\S]*<\/math>/);
      mathml = match ? match[0].replace(/<annotation(?:-xml)?[^>]*>[\s\S]*?<\/annotation(?:-xml)?>/gi, '') : "";
    } catch (e) {
      console.error("KaTeX error", e);
    }
    
    let ommlStr = "";
    if (mathml) {
      try {
        ommlStr = mml2omml(mathml);
        // Fix for mathml2omml bug where \mathrm produces m:val="undefined"
        ommlStr = ommlStr.replace(/m:val="undefined"/g, 'm:val="p"');
      } catch (e) {
        console.error("mml2omml error", e);
      }
    }
    
    if (ommlStr) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(ommlStr, "application/xml");
      normalizeOmmlDom(doc);
      const built = this.buildXml(doc.documentElement);
      this.xmlObj = typeof built === 'object' ? built : null;
    } else {
      this.xmlObj = null;
    }
  }

  private buildXml(node: Node): XmlOutput | string | null {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType === 1) {
      const el = node as Element;
      const obj: Record<string, unknown> = {};
      const children: unknown[] = [];
      if (el.attributes && el.attributes.length > 0) {
        const attr: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) {
          attr[a.name] = a.value;
        }
        children.push({ _attr: attr });
      }
      for (const childNode of Array.from(el.childNodes)) {
        const childObj = this.buildXml(childNode);
        if (childObj !== null && childObj !== undefined && childObj !== "") {
          children.push(childObj);
        }
      }
      obj[el.nodeName] = children;
      return obj as XmlOutput;
    }
    return null;
  }

  override prepForXml(): XmlOutput {
    return this.xmlObj || ({ "m:oMath": [] } as XmlOutput);
  }
}

function convertDataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(';base64,');
  const base64 = parts[parts.length - 1].replace(/\s+/g, '');
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface InlineToken {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  superScript?: boolean;
  subScript?: boolean;
  footnoteId?: number;
  math?: boolean;
  display?: boolean;
}

export function tokenizeInline(text: string, getFootnoteId?: (k: string) => number): InlineToken[] {
  const parts: InlineToken[] = [];
  let index = 0;

  while (index < text.length) {
    if (
      text[index] === '$' ||
      (text[index] === '\\' && (text[index + 1] === '(' || text[index + 1] === '['))
    ) {
      const prevChar = index === 0 ? '' : text[index - 1];
      const matchedMath = matchInlineMathAt(text.slice(index), prevChar);
      if (matchedMath) {
        parts.push({
          text: matchedMath.text,
          bold: false,
          italic: false,
          code: false,
          math: true,
          display: matchedMath.displayMode
        });
        index += matchedMath.raw.length;
        continue;
      }
    }

    if (text[index] === '<') {
      const supSubMatch = text.slice(index).match(/^<(sup|sub)>([\s\S]*?)<\/\1>/i);
      if (supSubMatch) {
        const tag = supSubMatch[1].toLowerCase();
        parts.push({
          text: supSubMatch[2],
          bold: false,
          italic: false,
          code: false,
          superScript: tag === 'sup',
          subScript: tag === 'sub'
        });
        index += supSubMatch[0].length;
        continue;
      }
    }

    if (text.startsWith('\\', index)) {
      if (index + 1 < text.length) {
        parts.push({
          text: text[index + 1],
          bold: false,
          italic: false,
          code: false
        });
        index += 2;
        continue;
      }
    }

    if (getFootnoteId && text.startsWith('[^', index)) {
      const end = text.indexOf(']', index + 2);
      if (end !== -1) {
        const fnKey = text.substring(index + 2, end);
        parts.push({
          text: '',
          bold: false,
          italic: false,
          code: false,
          footnoteId: getFootnoteId(fnKey)
        });
        index = end + 1;
        continue;
      }
    }
    if (text.startsWith('`', index)) {
      const end = text.indexOf('`', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: false,
          code: true
        });
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith('***', index)) {
      const end = text.indexOf('***', index + 3);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 3, end),
          bold: true,
          italic: true,
          code: false
        });
        index = end + 3;
        continue;
      }
    }

    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 2, end),
          bold: true,
          italic: false,
          code: false
        });
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith('__', index)) {
      const end = text.indexOf('__', index + 2);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 2, end),
          bold: true,
          italic: false,
          code: false
        });
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith('*', index)) {
      const end = text.indexOf('*', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: true,
          code: false
        });
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith('_', index)) {
      const end = text.indexOf('_', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: true,
          code: false
        });
        index = end + 1;
        continue;
      }
    }

    let nextIndex = index;
    while (nextIndex < text.length) {
      const char = text[nextIndex];
      if (
        char === '$' ||
        char === '`' ||
        char === '*' ||
        char === '_' ||
        char === '\\' ||
        (char === '<' && /^<(sup|sub)>/i.test(text.slice(nextIndex))) ||
        (getFootnoteId && char === '[' && text.startsWith('[^', nextIndex))
      ) {
        break;
      }
      nextIndex++;
    }

    if (nextIndex > index) {
      parts.push({
        text: text.substring(index, nextIndex),
        bold: false,
        italic: false,
        code: false
      });
      index = nextIndex;
    } else {
      parts.push({
        text: text[index],
        bold: false,
        italic: false,
        code: false
      });
      index++;
    }
  }

  return parts;
}

interface RunOptions {
  color?: string;
  size?: number;
  italics?: boolean;
}

function createRunsFromText(text: string, getFootnoteId?: (k: string) => number, opts?: RunOptions): (TextRun | FootnoteReferenceRun | OmmlMathComponent)[] {
  const tokens = tokenizeInline(text, getFootnoteId);
  return tokens.map(token => {
    if (token.math) {
      return new OmmlMathComponent(token.text, token.display);
    }
    if (token.footnoteId) {
      return new FootnoteReferenceRun(token.footnoteId);
    }
    return new TextRun({
      text: token.text,
      bold: token.bold || undefined,
      italics: opts?.italics ?? (token.italic || undefined),
      superScript: token.superScript || undefined,
      subScript: token.subScript || undefined,
      font: token.code ? "Consolas" : "Calibri",
      size: token.code ? 19 : (opts?.size ?? 22),
      color: token.code ? "A855F7" : (opts?.color ?? undefined),
    });
  });
}

function parseMarkdownTable(tableLines: string[], getFootnoteId?: (k: string) => number): Table {
  const rowsData = tableLines.filter(line => {
    const clean = line.trim();
    if (/^[|:\-\s]+$/.test(clean)) return false;
    return true;
  });

  const parsedRows: TableRow[] = [];

  for (let rIndex = 0; rIndex < rowsData.length; rIndex++) {
    const line = rowsData[rIndex];
    const cols = line.split('|').map(s => s.trim());
    if (line.startsWith('|')) cols.shift();
    if (line.endsWith('|')) cols.pop();

    const cells = cols.map(colText => {
      return new TableCell({
        children: [
          new Paragraph({
            children: createRunsFromText(colText, getFootnoteId),
            spacing: { before: 80, after: 80 },
          }),
        ],
        shading: rIndex === 0 ? { fill: "F2F5F9" } : undefined,
        verticalAlign: VerticalAlign.CENTER,
      });
    });

    parsedRows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
    },
    rows: parsedRows,
  });
}

function parseHtmlTable(html: string, getFootnoteId?: (k: string) => number): Table {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tableEl = doc.querySelector('table');
  if (!tableEl) throw new Error("No table found");

  const parsedRows: TableRow[] = [];
  const rows = Array.from(tableEl.querySelectorAll('tr'));

  for (let rIndex = 0; rIndex < rows.length; rIndex++) {
    const rowEl = rows[rIndex];
    const cellsEl = Array.from(rowEl.querySelectorAll('td, th'));

    const cells = cellsEl.map(cellEl => {
      const text = cellEl.textContent || '';
      
      return new TableCell({
        children: [
          new Paragraph({
            children: createRunsFromText(text.trim(), getFootnoteId),
            spacing: { before: 80, after: 80 },
          }),
        ],
        shading: cellEl.tagName.toLowerCase() === 'th' || rIndex === 0 ? { fill: "F2F5F9" } : undefined,
        verticalAlign: VerticalAlign.CENTER,
      });
    });

    parsedRows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
    },
    rows: parsedRows,
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({ width: 400, height: 300 });
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 300 });
    };
    img.src = dataUrl;
  });
}

export class DocxExporter {
  static async generateDocx(title: string, markdownContent: string, images?: Record<string, string>): Promise<Blob> {
    // Strip ONLY internal Markdown links (but not images) and internal HTML links before processing
    let cleanedContent = markdownContent.replace(/(^|[^!])\[([^\]]+)\]\(#[^)]*\)/g, '$1$2');
    cleanedContent = cleanedContent.replace(/<a\b[^>]*href=["']#[^"']*["'][^>]*>(.*?)<\/a>/gi, '$1');

    const htmlTables: string[] = [];
    cleanedContent = cleanedContent.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
      htmlTables.push(match);
      return `\n\n___HTML_TABLE_${htmlTables.length - 1}___\n\n`;
    });

    const activeImages: Record<string, { dataUrl: string; width: number; height: number }> = {};
    if (images) {
      const promises = Object.entries(images).map(async ([key, dataUrl]) => {
        try {
          const dims = await getImageDimensions(dataUrl);
          activeImages[key] = { dataUrl, ...dims };
        } catch {
          activeImages[key] = { dataUrl, width: 400, height: 300 };
        }
      });
      await Promise.all(promises);
    }

    const findImage = (key: string) => {
      let imgData = activeImages[key];
      if (!imgData) {
         const lowerKey = key.toLowerCase();
         for (const [k, v] of Object.entries(activeImages)) {
             if (k.toLowerCase() === lowerKey || k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) {
                 imgData = v;
                 break;
             }
         }
      }
      return imgData || null;
    };

    const children: (Paragraph | Table)[] = [];
    
    const linesRaw = cleanedContent.split('\n');
    const lines: string[] = [];
    const footnoteDefs: Record<string, string> = {};
    for (const line of linesRaw) {
      const match = line.trim().match(/^\[\^([^\]]+)\]:\s*(.*)$/);
      if (match) {
        footnoteDefs[match[1]] = match[2];
      } else {
        lines.push(line);
      }
    }

    let nextFootnoteId = 1;
    const footnoteKeyToId: Record<string, number> = {};
    const getFootnoteId = (key: string) => {
      if (!footnoteKeyToId[key]) {
        footnoteKeyToId[key] = nextFootnoteId++;
      }
      return footnoteKeyToId[key];
    };

    let idx = 0;

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    while (idx < lines.length) {
      const line = lines[idx];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          const codeText = codeBlockContent.join('\n');
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: codeText,
                              font: "Consolas",
                              size: 19,
                              color: "374151",
                            }),
                          ],
                          spacing: { before: 120, after: 120 },
                        }),
                      ],
                      shading: { fill: "F3F4F6" },
                    }),
                  ],
                }),
              ],
            })
          );
          inCodeBlock = false;
          codeBlockContent = [];
        } else {
          inCodeBlock = true;
        }
        idx++;
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        idx++;
        continue;
      }

      if (trimmedLine === '') {
        idx++;
        continue;
      }

      // Multi-line block math $$ ... $$ or \[ ... \]
      if (
        (trimmedLine.startsWith('$$') && !trimmedLine.slice(2).includes('$$')) ||
        (trimmedLine.startsWith('\\[') && !trimmedLine.slice(2).includes('\\]'))
      ) {
        const closeDelim = trimmedLine.startsWith('$$') ? '$$' : '\\]';
        const mathLines: string[] = [];
        const firstLineRest = trimmedLine.slice(2).trim();
        if (firstLineRest) mathLines.push(firstLineRest);
        let searchIdx = idx + 1;
        let foundClose = false;
        while (searchIdx < lines.length) {
          const cur = lines[searchIdx].trim();
          const closePos = cur.indexOf(closeDelim);
          if (closePos !== -1) {
            const beforeClose = cur.slice(0, closePos).trim();
            if (beforeClose) mathLines.push(beforeClose);
            foundClose = true;
            break;
          }
          mathLines.push(lines[searchIdx]);
          searchIdx++;
        }
        if (foundClose && mathLines.join('\n').trim()) {
          children.push(
            new Paragraph({
              children: [new OmmlMathComponent(mathLines.join('\n').trim(), true)],
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 160 },
            })
          );
          idx = searchIdx + 1;
          continue;
        }
      }

      const htmlTableMatch = trimmedLine.match(/^___HTML_TABLE_(\d+)___$/);
      if (htmlTableMatch) {
        const tableIdx = parseInt(htmlTableMatch[1], 10);
        try {
          children.push(parseHtmlTable(htmlTables[tableIdx], getFootnoteId));
        } catch (e) {
          console.error("Error parsing HTML table", e);
        }
        idx++;
        continue;
      }

      if (trimmedLine.startsWith('|')) {
        const tableLines: string[] = [];
        while (idx < lines.length && lines[idx].trim().startsWith('|')) {
          tableLines.push(lines[idx]);
          idx++;
        }
        try {
          children.push(parseMarkdownTable(tableLines, getFootnoteId));
        } catch {
          tableLines.forEach(l => {
            children.push(
              new Paragraph({
                children: createRunsFromText(l, getFootnoteId),
            spacing: { after: 120 },
              })
            );
          });
        }
        continue;
      }

      if (trimmedLine.startsWith('#')) {
        const levelMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
        if (levelMatch) {
          const depth = levelMatch[1].length;
          let text = levelMatch[2];
          
          text = text.replace(/\s*\{#[^}]+\}\s*$/, '');
          
          let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
          let fontSize = 36;
          let color = "1F497D";

          if (depth === 1) {
            headingLevel = HeadingLevel.HEADING_1;
            fontSize = 40;
            color = "1F497D";
          } else if (depth === 2) {
            headingLevel = HeadingLevel.HEADING_2;
            fontSize = 32;
            color = "2E74B5";
          } else if (depth === 3) {
            headingLevel = HeadingLevel.HEADING_3;
            fontSize = 26;
            color = "1F4E79";
          } else {
            headingLevel = HeadingLevel.HEADING_4;
            fontSize = 24;
            color = "333333";
          }

          children.push(
            new Paragraph({
              heading: headingLevel,
              children: [
                new TextRun({
                  text: text,
                  bold: true,
                  size: fontSize,
                  color: color,
                  font: "Segoe UI",
                }),
              ],
              spacing: { before: 240, after: 120 },
            })
          );
          idx++;
          continue;
        }
      }

      if (trimmedLine.startsWith('>')) {
        const quoteText = trimmedLine.replace(/^>\s*/, '');
        children.push(
          new Paragraph({
            children: createRunsFromText(quoteText, getFootnoteId, {
              italics: true,
              size: 21,
              color: "4B5563"
            }),
            indent: { left: 720 },
            spacing: { before: 120, after: 120 },
          })
        );
        idx++;
        continue;
      }

      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) {
        const bulletText = trimmedLine.substring(2);
        children.push(
          new Paragraph({
            children: createRunsFromText(bulletText, getFootnoteId),
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
        idx++;
        continue;
      }

      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        const numStr = numberedMatch[1];
        const ordText = numberedMatch[2];
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${numStr}. `,
                bold: true,
                font: "Calibri",
                size: 22,
              }),
              ...createRunsFromText(ordText, getFootnoteId),
            ],
            indent: { left: 720 },
            spacing: { after: 100 },
          })
        );
        idx++;
        continue;
      }

      const robustImgRegex = /!\[([^\]]*)\]\(([^)]+)\)|!\[([^\]]*)\]\s*\[([^\]]+)\]|!\[([^\]]+)\]|<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
        
      const hasImage = robustImgRegex.test(trimmedLine);
      if (hasImage) {
        robustImgRegex.lastIndex = 0;
        let lastStop = 0;
        let match;
        
        while ((match = robustImgRegex.exec(trimmedLine)) !== null) {
          const matchIndex = match.index;
          const key = match[2] || match[4] || match[5] || match[6];


          if (matchIndex > lastStop) {
            const preText = trimmedLine.substring(lastStop, matchIndex).trim();
            if (preText) {
              children.push(
                new Paragraph({
                  children: createRunsFromText(preText, getFootnoteId),
                  spacing: { after: 120 },
                })
              );
            }
          }

          const imgObj = findImage(key);
          if (imgObj) {
            try {
              const maxW = 560;
              let displayWidth = imgObj.width || 400;
              let displayHeight = imgObj.height || 300;

              if (displayWidth > maxW) {
                const ratio = maxW / displayWidth;
                displayWidth = maxW;
                displayHeight = Math.floor(displayHeight * ratio);
              }

              const uint8Arr = convertDataUrlToUint8Array(imgObj.dataUrl);

              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: uint8Arr,
                      transformation: {
                        width: displayWidth,
                        height: displayHeight,
                      },
                      type: imgObj.dataUrl.includes('image/jpeg') ? "jpg" : "png",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 240, after: 240 },
                })
              );
            } catch (e) {
              console.error(e);
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[Lỗi hiển thị ảnh: ${key}]`,
                      color: "EF4444",
                      italics: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 120 },
                })
              );
            }
          } else {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Đang tải ảnh: ${key}]`,
                    color: "6B7280",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
              })
            );
          }

          lastStop = robustImgRegex.lastIndex;
        }

        if (lastStop < trimmedLine.length) {
          const postText = trimmedLine.substring(lastStop).trim();
          if (postText) {
            children.push(
              new Paragraph({
                children: createRunsFromText(postText, getFootnoteId),
                spacing: { after: 120 },
              })
            );
          }
        }

        idx++;
        continue;
      }

      children.push(
        new Paragraph({
          children: createRunsFromText(trimmedLine, getFootnoteId),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120 },
        })
      );

      idx++;
    }

    const docxFootnotes: Record<number, { children: Paragraph[] }> = {};
    for (const [key, id] of Object.entries(footnoteKeyToId)) {
      const defText = footnoteDefs[key] || "Chú thích không xác định";
      docxFootnotes[id] = {
        children: [
          new Paragraph({
            children: createRunsFromText(defText, undefined, { size: 18 }),
            spacing: { before: 60, after: 60 },
          })
        ]
      };
    }

    const doc = new Document({
      footnotes: Object.keys(docxFootnotes).length > 0 ? docxFootnotes : undefined,
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  }
}
