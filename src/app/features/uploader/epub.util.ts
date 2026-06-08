import TurndownService from 'turndown';
import { preprocessHtmlStr } from './html.util';

export async function processEpubContent(file: File, turndownService: TurndownService): Promise<{ markdown: string, images?: Record<string, string> }> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  const buffer = await file.arrayBuffer();
  try {
    await zip.loadAsync(buffer);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Đã xảy ra lỗi khi đọc file EPUB. File có thể bị lỗi, chưa tải xuống hoàn tất hoặc không đúng định dạng zip: ${errorMsg}`);
  }
  
  // 1. Read META-INF/container.xml
  let opfPath = '';
  const containerFile = zip.file('META-INF/container.xml');
  const parser = new DOMParser();
  
  if (containerFile) {
    try {
      const containerXml = await containerFile.async('text');
      const containerDoc = parser.parseFromString(containerXml, 'application/xml');
      // Sử dụng localName để bỏ qua namespace an toàn nhất
      const rootfileNode = Array.from(containerDoc.getElementsByTagName('*')).find(el => el.localName === 'rootfile');
      if (rootfileNode) {
        opfPath = rootfileNode.getAttribute('full-path') || '';
      }
    } catch (e) {
      console.warn('Lỗi đọc container.xml', e);
    }
  }
  
  // Fallback 1: Tìm thủ công file .opf nếu container.xml bị thiếu/hỏng
  if (!opfPath) {
    const allFiles = Object.keys(zip.files);
    opfPath = allFiles.find(name => name.toLowerCase().endsWith('.opf')) || '';
  }

  if (!opfPath) throw new Error('File không đúng chuẩn EPUB (không tìm thấy tệp OPF)');
  
  // Get base path of OPF to resolve relative paths
  const lastSlashIndex = opfPath.lastIndexOf('/');
  const opfBasePath = lastSlashIndex !== -1 ? opfPath.substring(0, lastSlashIndex + 1) : '';
  
  // 2. Read OPF file
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('File không đúng chuẩn EPUB (không tìm thấy tệp OPF)');
  const opfXml = await opfFile.async('text');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  const allOpfElements = Array.from(opfDoc.getElementsByTagName('*'));
  
  // 3. Get manifest items
  const manifestItems = allOpfElements.filter(el => el.localName === 'item');
  const itemsMap = new Map<string, string>(); // id -> href
  
  const imagesStore: Record<string, string> = {};
  const hrefToImgId = new Map<string, string>();
  let imgCounter = 0;
  
  for (const item of manifestItems) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type');
    
    if (id && href) itemsMap.set(id, href);
    
    // Check if it's an image
    if (href && mediaType && mediaType.startsWith('image/')) {
       const imgFilePath = opfBasePath + decodeURIComponent(href);
       let imgFile = zip.file(imgFilePath);
       
       // Fallback 2: Trích xuất ảnh theo đường dẫn mờ (fuzzy)
       if (!imgFile) {
          const imgFileName = imgFilePath.split('/').pop();
          if (imgFileName) {
              const fallbackPath = Object.keys(zip.files).find(name => name.endsWith(`/${imgFileName}`) || name === imgFileName);
              if (fallbackPath) imgFile = zip.file(fallbackPath);
          }
       }

       if (imgFile) {
          try {
            const base64Data = await imgFile.async('base64');
            const dataUrl = `data:${mediaType};base64,${base64Data}`;
            const placeholderId = `SILA_IMG_${imgCounter++}`;
            imagesStore[placeholderId] = dataUrl;
            hrefToImgId.set(href, placeholderId);
            // Lưu key phụ để tra cứu dễ hơn
            const rawFilename = href.split('/').pop();
            if (rawFilename) hrefToImgId.set(rawFilename, placeholderId);
          } catch (e) {
            console.warn(`Lỗi load ảnh: ${href}`, e);
          }
       }
    }
  }
  
  // 4. Get spine items
  const spineItems = allOpfElements.filter(el => el.localName === 'itemref');
  
  let fullMarkdown = '';
  
  for (const spineItem of spineItems) {
      const idref = spineItem.getAttribute('idref');
      if (!idref) continue;
      
      const href = itemsMap.get(idref);
      if (!href) continue;
      
      const decodedHref = decodeURIComponent(href);
      const filePath = opfBasePath + decodedHref;
      
      let htmlFile = zip.file(filePath);
      
      // Fallback 3: Tìm fuzzy match file HTML nếu URL có lỗi
      if (!htmlFile) {
         const fallbackHtml = Object.keys(zip.files).find(name => name.endsWith(decodedHref) || name.endsWith(href));
         if (fallbackHtml) {
             htmlFile = zip.file(fallbackHtml);
         }
      }
      
      if (!htmlFile) continue;
      
      try {
        const htmlContent = await htmlFile.async('text');
        let processedHtml = preprocessHtmlStr(htmlContent);
        
        // Replace image src and rewrite internal links in HTML
        const pDoc = parser.parseFromString(processedHtml, 'text/html');

        // Remove manual internal link generation, Turndown will strip them and keep text only.

        const imgs = Array.from(pDoc.getElementsByTagName('img'));
        for (const img of imgs) {
           const src = img.getAttribute('src');
           if (src) {
               const htmlDirPath = decodedHref.substring(0, decodedHref.lastIndexOf('/') + 1);
               const parts = (htmlDirPath + src).split('/');
               const finalParts: string[] = [];
               for (const p of parts) {
                   if (p === '..') finalParts.pop();
                   else if (p !== '.' && p !== '') finalParts.push(p);
               }
               const finalHref = finalParts.join('/');
               
               let placeholderId = hrefToImgId.get(finalHref);
               
               // Fallback 4: Lấy trực tiếp từ tên file nếu sai path
               if (!placeholderId) {
                   const bareFilename = src.split('/').pop();
                   if (bareFilename) placeholderId = hrefToImgId.get(bareFilename);
               }
               
               if (placeholderId) {
                  img.setAttribute('src', placeholderId);
               }
           }
        }
        processedHtml = pDoc.body.innerHTML || pDoc.documentElement.innerHTML;
        
        const markdown = turndownService.turndown(processedHtml);
        if (markdown.trim()) {
            fullMarkdown += (fullMarkdown ? '\n\n---\n\n' : '') + markdown;
        }
      } catch (err) {
        // Fallback 5: Bắt lỗi từng tệp HTML, không chết nguyên EPUB
        console.warn(`Lỗi khi trích xuất trang ${filePath}`, err);
      }
  }
  
  if (!fullMarkdown) {
     throw new Error('Không trích xuất được nội dung từ file EPUB. Có thể file rỗng hoặc mã hóa không hỗ trợ.');
  }
  
  return { markdown: fullMarkdown, images: Object.keys(imagesStore).length > 0 ? imagesStore : undefined };
}
