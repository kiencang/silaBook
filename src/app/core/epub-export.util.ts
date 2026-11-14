import { parseMarkdownWithImages } from './marked-setup';

interface EpubSection {
  id: string;
  fileName: string;
  nodes: Node[];
  xhtmlContent?: string;
  hasMath?: boolean;
}

interface TocEntry {
  title: string;
  level: number;
  href: string;
}

interface TocNode {
  title: string;
  level: number;
  href: string;
  children: TocNode[];
}

export class EpubExporter {
  /**
   * Zip compilation of valid, standard EPUB structure package
   */
  static async generateEpub(
    title: string,
    markdownContent: string,
    images?: Record<string, string>,
    author?: string
  ): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const allImages: { id: string; key: string; dataUrl: string; fileName: string; mediaType: string }[] = [];

    if (images) {
      Object.keys(images).forEach((key) => {
        const dataUrl = images[key];
        const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '');
        let mediaType = 'image/png';
        let ext = 'png';
        if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
          mediaType = 'image/jpeg';
          ext = 'jpg';
        } else if (dataUrl.startsWith('data:image/gif')) {
          mediaType = 'image/gif';
          ext = 'gif';
        } else if (dataUrl.startsWith('data:image/webp')) {
          mediaType = 'image/webp';
          ext = 'webp';
        } else if (dataUrl.startsWith('data:image/svg+xml')) {
          mediaType = 'image/svg+xml';
          ext = 'svg';
        }
        allImages.push({
          id: `img-${safeKey.toLowerCase()}`,
          key: key,
          dataUrl: dataUrl,
          fileName: `images/${safeKey}.${ext}`,
          mediaType: mediaType
        });
      });
    }

    allImages.forEach((img) => {
      const base64Clean = img.dataUrl.includes('base64,') ? img.dataUrl.split('base64,')[1] : img.dataUrl.split(',')[1];
      zip.file(`OEBPS/${img.fileName}`, base64Clean || '', { base64: true });
    });

    const mappedImages: Record<string, string> = {};
    allImages.forEach((img) => {
      mappedImages[img.key] = img.fileName;
    });

    const rawHtml = parseMarkdownWithImages(markdownContent, mappedImages);
    const escapedTitle = this.escapeXml(title || 'Untitled');
    const escapedAuthor = this.escapeXml(author && author.trim() ? author.trim() : 'Không rõ');

    const { sections, tocEntries } = this.buildSectionsAndToc(rawHtml);

    sections.forEach((sec) => {
      zip.file(`OEBPS/${sec.fileName}`, `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapedTitle}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  ${sec.xhtmlContent || ''}
</body>
</html>`);
    });

    zip.file('OEBPS/stylesheet.css', `body {
  font-family: "Liberation Serif", "Times New Roman", serif;
  line-height: 1.6;
  margin: 1em;
  color: #111111;
}
h1, h2, h3 {
  font-family: sans-serif;
  color: #000000;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
p {
  margin-bottom: 0.8em;
  text-align: justify;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5em auto;
}
blockquote {
  margin: 1em 2em;
  font-style: italic;
  border-left: 3px solid #ccc;
  padding-left: 1em;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
  text-align: left;
}
code {
  font-family: monospace;
  background-color: #f4f4f4;
  padding: 2px 4px;
  border-radius: 3px;
}`);

    const tocTree = this.buildTocTree(tocEntries, sections[0]?.fileName || 'section1.xhtml');
    const navOlHtml = this.renderNavOl(tocTree, '    ');

    zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Mục lục</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h2>Mục lục</h2>
${navOlHtml}
  </nav>
</body>
</html>`);

    const uuid = this.generateUuid();
    let sectionManifestItems = '';
    let spineItems = '    <itemref idref="nav"/>\n';
    sections.forEach((sec) => {
      const mathProp = sec.hasMath ? ' properties="mathml"' : '';
      sectionManifestItems += `    <item id="${sec.id}" href="${sec.fileName}" media-type="application/xhtml+xml"${mathProp}/>\n`;
      spineItems += `    <itemref idref="${sec.id}"/>\n`;
    });

    let imageManifestItems = '';
    allImages.forEach((img) => {
      imageManifestItems += `    <item id="${img.id}" href="${img.fileName}" media-type="${img.mediaType}"/>\n`;
    });

    const currentDate = new Date().toISOString().split('.')[0] + 'Z';
    zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="vi">
  <metadata>
    <dc:identifier id="id">urn:uuid:${uuid}</dc:identifier>
    <dc:creator id="author_0">${escapedAuthor}</dc:creator>
    <meta property="file-as" refines="#author_0">${escapedAuthor}</meta>
    <meta property="role" refines="#author_0" scheme="marc:relators">aut</meta>
    <dc:title>${escapedTitle}</dc:title>
    <dc:language>vi</dc:language>
    <meta property="dcterms:modified">${currentDate}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="stylesheet.css" media-type="text/css"/>
${sectionManifestItems}${imageManifestItems}  </manifest>
  <spine toc="ncx">
${spineItems.trimEnd()}
  </spine>
</package>`);

    const maxDepth = this.getTocMaxDepth(tocTree);
    const ncxNavPoints = this.renderNcxNavPoints(tocTree);

    zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="${maxDepth}"/>
  </head>
  <docTitle><text>${escapedTitle}</text></docTitle>
  <navMap>
${ncxNavPoints}
  </navMap>
</ncx>`);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
    return blob;
  }

  private static buildSectionsAndToc(rawHtml: string): { sections: EpubSection[]; tocEntries: TocEntry[] } {
    const cleaned = this.stripInvalidXmlChars(rawHtml);

    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
      const xhtml = this.toStrictXhtmlFallback(cleaned);
      return {
        sections: [
          {
            id: 'section1',
            fileName: 'section1.xhtml',
            nodes: [],
            xhtmlContent: xhtml,
            hasMath: xhtml.includes('<math')
          }
        ],
        tocEntries: []
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${cleaned}</body></html>`, 'text/html');

    // Localize default marked-footnote heading if present
    const footnoteHeading = doc.body.querySelector('section.footnotes h2#footnote-label');
    if (footnoteHeading && footnoteHeading.textContent?.trim().toLowerCase() === 'footnotes') {
      footnoteHeading.textContent = 'Chú thích';
    }

    // Ensure all existing IDs are tracked and all headings (h1, h2, h3) have valid, unique XML IDs
    const usedIds = new Set<string>();
    doc.body.querySelectorAll('[id]').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag !== 'h1' && tag !== 'h2' && tag !== 'h3') {
        const id = el.getAttribute('id')?.trim();
        if (id) usedIds.add(id);
      }
    });

    let headingCounter = 1;
    doc.body.querySelectorAll('h1, h2, h3').forEach((heading) => {
      let id = (heading.getAttribute('id') || '').trim();
      // XML ID must start with a letter or underscore and contain only valid XML Name characters
      const isValidXmlId = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id);
      if (!id || !isValidXmlId || usedIds.has(id)) {
        const base = isValidXmlId && id ? id : `heading-${headingCounter}`;
        let candidate = base;
        let suffix = 1;
        while (usedIds.has(candidate)) {
          candidate = `${base}-${suffix++}`;
        }
        id = candidate;
        heading.setAttribute('id', id);
      }
      usedIds.add(id);
      headingCounter++;
    });

    // Split top-level body childNodes into logical sections at H1/H2 boundaries, footnotes, or size limit
    const MAX_SECTION_CHARS = 45000;
    const rawSections: Node[][] = [];
    let currentNodes: Node[] = [];
    let currentHasBodyContent = false;
    let currentHasH1 = false;
    let currentHasH2 = false;
    let currentCharLen = 0;

    const flushSection = () => {
      if (currentNodes.length > 0) {
        rawSections.push(currentNodes);
        currentNodes = [];
        currentHasBodyContent = false;
        currentHasH1 = false;
        currentHasH2 = false;
        currentCharLen = 0;
      }
    };

    for (const node of Array.from(doc.body.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        const isFootnotesSection = tag === 'section' && el.classList.contains('footnotes');

        if (isFootnotesSection) {
          flushSection();
          currentNodes.push(node);
          flushSection();
          continue;
        }

        if (tag === 'h1') {
          if (currentHasBodyContent || currentHasH1 || currentHasH2) {
            flushSection();
          }
          currentHasH1 = true;
        } else if (tag === 'h2') {
          if (currentHasBodyContent || currentHasH2) {
            flushSection();
          }
          currentHasH2 = true;
        } else {
          if (currentCharLen >= MAX_SECTION_CHARS && (tag === 'p' || tag === 'h3' || tag === 'blockquote' || tag === 'div' || tag === 'hr')) {
            flushSection();
          }
          if ((el.textContent || '').trim().length > 0 || tag === 'img' || tag === 'table' || tag === 'figure') {
            currentHasBodyContent = true;
          }
        }

        currentNodes.push(node);
        currentCharLen += (el.textContent || '').length;
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim().length > 0) {
          currentHasBodyContent = true;
          currentCharLen += text.length;
        }
        currentNodes.push(node);
      }
    }
    flushSection();

    if (rawSections.length === 0) {
      rawSections.push([]);
    }

    const sections: EpubSection[] = rawSections.map((nodes, idx) => ({
      id: `section${idx + 1}`,
      fileName: `section${idx + 1}.xhtml`,
      nodes
    }));

    // Map every [id] across all sections to its owning section fileName
    const idToFileMap = new Map<string, string>();
    for (const sec of sections) {
      for (const node of sec.nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const ownId = el.getAttribute('id');
          if (ownId) {
            idToFileMap.set(ownId, sec.fileName);
          }
          el.querySelectorAll('[id]').forEach((child) => {
            const cid = child.getAttribute('id');
            if (cid) {
              idToFileMap.set(cid, sec.fileName);
            }
          });
        }
      }
    }

    // Rewrite internal #anchor links so cross-section links (such as footnotes and backrefs) point to sectionN.xhtml#id
    const tocEntries: TocEntry[] = [];
    const serializer = new XMLSerializer();

    for (const sec of sections) {
      const container = doc.createElement('div');
      for (const node of sec.nodes) {
        container.appendChild(node);
      }

      container.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (href.length > 1) {
          const rawId = href.substring(1);
          let decodedId = rawId;
          try {
            decodedId = decodeURIComponent(rawId);
          } catch {
            // keep rawId
          }
          const targetFile = idToFileMap.get(decodedId) || idToFileMap.get(rawId);
          if (targetFile && targetFile !== sec.fileName) {
            anchor.setAttribute('href', `${targetFile}#${rawId}`);
          }
        }
      });

      container.querySelectorAll('h1, h2, h3').forEach((heading) => {
        const titleText = (heading.textContent || '').replace(/\s+/g, ' ').trim();
        const hid = heading.getAttribute('id');
        if (titleText && hid) {
          const level = parseInt(heading.tagName.substring(1), 10);
          tocEntries.push({
            title: titleText,
            level,
            href: `${sec.fileName}#${hid}`
          });
        }
      });

      let serialized = serializer.serializeToString(container);
      serialized = serialized
        .replace(/^<div[^>]*>/i, '')
        .replace(/<\/div>$/i, '')
        .replace(/\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');

      sec.xhtmlContent = serialized;
      sec.hasMath = serialized.includes('<math');
    }

    return { sections, tocEntries };
  }

  private static buildTocTree(entries: TocEntry[], fallbackFileName: string): TocNode[] {
    if (entries.length === 0) {
      return [
        {
          title: 'Nội dung chính',
          level: 1,
          href: fallbackFileName,
          children: []
        }
      ];
    }

    const roots: TocNode[] = [];
    const stack: TocNode[] = [];

    for (const entry of entries) {
      const node: TocNode = {
        title: entry.title,
        level: entry.level,
        href: entry.href,
        children: []
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return roots;
  }

  private static renderNavOl(nodes: TocNode[], indent: string): string {
    let out = `${indent}<ol>\n`;
    for (const node of nodes) {
      const safeTitle = this.escapeXml(node.title);
      const safeHref = this.escapeXml(node.href);
      if (node.children.length > 0) {
        out += `${indent}  <li>\n`;
        out += `${indent}    <a href="${safeHref}">${safeTitle}</a>\n`;
        out += this.renderNavOl(node.children, `${indent}    `) + '\n';
        out += `${indent}  </li>\n`;
      } else {
        out += `${indent}  <li><a href="${safeHref}">${safeTitle}</a></li>\n`;
      }
    }
    out += `${indent}</ol>`;
    return out;
  }

  private static getTocMaxDepth(nodes: TocNode[]): number {
    let max = 1;
    for (const node of nodes) {
      if (node.children.length > 0) {
        const childDepth = 1 + this.getTocMaxDepth(node.children);
        if (childDepth > max) max = childDepth;
      }
    }
    return max;
  }

  private static renderNcxNavPoints(nodes: TocNode[]): string {
    let playOrder = 1;

    const renderList = (list: TocNode[], indent: string): string => {
      let out = '';
      for (const node of list) {
        const currentOrder = playOrder++;
        const safeTitle = this.escapeXml(node.title);
        const safeHref = this.escapeXml(node.href);
        out += `${indent}<navPoint id="navpoint-${currentOrder}" playOrder="${currentOrder}">\n`;
        out += `${indent}  <navLabel><text>${safeTitle}</text></navLabel>\n`;
        out += `${indent}  <content src="${safeHref}"/>\n`;
        if (node.children.length > 0) {
          out += renderList(node.children, `${indent}  `);
        }
        out += `${indent}</navPoint>\n`;
      }
      return out;
    };

    return renderList(nodes, '    ').trimEnd();
  }

  private static escapeXml(str: string): string {
    return this.stripInvalidXmlChars(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private static stripInvalidXmlChars(str: string): string {
    return Array.from(str)
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20;
      })
      .join('');
  }

  private static toStrictXhtmlFallback(cleaned: string): string {
    return cleaned
      .replace(/<(img|br|hr|col|wbr|input|source|area|base|embed|link|meta|param|track)\b([^>]*?)>/gi, (match) => {
        if (match.endsWith('/>')) return match;
        return match.replace(/>$/, ' />');
      })
      .replace(/&nbsp;/gi, '&#160;');
  }

  private static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
