import TurndownService from 'turndown';

const turndownService = new TurndownService({ headingStyle: 'atx' }).remove(['style', 'script', 'head', 'meta', 'title', 'noscript']);

turndownService.addRule('stripInternalLinks', {
  filter: 'a',
  replacement: function (content, node) {
    const href = (node as HTMLElement).getAttribute('href');
    // Nếu không có href, hoặc là liên kết nội bộ/tương đối -> loại bỏ liên kết, chỉ giữ content
    if (!href || (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:'))) {
      return content;
    }
    const title = (node as HTMLElement).title ? ` "${(node as HTMLElement).title}"` : '';
    return href ? `[${content}](${href}${title})` : content;
  }
});

export function preprocessHtmlStr(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  const elements = doc.querySelectorAll('[style]');
  elements.forEach(node => {
    const el = node as HTMLElement;
    const styleAttr = el.getAttribute('style') || '';
    
    const isBold = /font-weight\s*:\s*(bold|bolder|[7-9]00)/i.test(styleAttr);
    const isItalic = /font-style\s*:\s*(italic|oblique)/i.test(styleAttr);
    
    if (isBold && el.tagName !== 'B' && el.tagName !== 'STRONG') {
      const b = doc.createElement('b');
      while (el.firstChild) {
        b.appendChild(el.firstChild);
      }
      el.appendChild(b);
    }
    
    if (isItalic && el.tagName !== 'I' && el.tagName !== 'EM') {
      const i = doc.createElement('i');
      while (el.firstChild) {
        i.appendChild(el.firstChild);
      }
      el.appendChild(i);
    }
  });

  return doc.body.innerHTML;
}

export async function processHtmlContent(file: File): Promise<string> {
  const text = await file.text();
  const processedHtml = preprocessHtmlStr(text);
  return turndownService.turndown(processedHtml);
}

export function getTurndownService(): TurndownService {
  return turndownService;
}
