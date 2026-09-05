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

export function preprocessHtmlStr(htmlContent: string, imagesStore?: Record<string, string>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Extract base64 images
  if (imagesStore) {
    let imgCounter = 0;
    const imgs = doc.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('data:image/')) {
        const placeholderId = `SILA_IMG_HTML_${imgCounter++}`;
        imagesStore[placeholderId] = src;
        img.setAttribute('src', placeholderId);
      }
    });
  }
  
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

export async function processHtmlContent(file: File): Promise<{ markdown: string, images?: Record<string, string> }> {
  const text = await file.text();
  const imagesStore: Record<string, string> = {};
  const processedHtml = preprocessHtmlStr(text, imagesStore);
  const markdown = turndownService.turndown(processedHtml);
  return { 
    markdown, 
    images: Object.keys(imagesStore).length > 0 ? imagesStore : undefined 
  };
}

export function getTurndownService(): TurndownService {
  return turndownService;
}
