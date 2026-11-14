import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { EpubExporter } from './epub-export.util';
import { DocxExporter } from './docx-export.util';

describe('Exporters (EPUB & DOCX)', () => {
  describe('EpubExporter.generateEpub', () => {
    it('splits content into multiple XHTML sections by H1/H2, generates hierarchical TOC, rewrites cross-section footnote links, and sets author metadata', async () => {
      const markdown = [
        '# Phần I: Khởi đầu',
        '## Chương 1: Buổi sáng',
        'Đoạn văn trong chương 1 có chú thích[^c0-t-1].',
        '### Mục 1.1: Chi tiết nhỏ',
        'Nội dung mục 1.1.',
        '## Chương 2: Buổi chiều',
        'Đoạn văn trong chương 2 có công thức $E = mc^2$.',
        '',
        '[^c0-t-1]: Giải thích chú thích ở cuối sách.'
      ].join('\n\n');

      const blob = await EpubExporter.generateEpub('Tên Sách Thử Nghiệm', markdown, undefined, 'Nguyễn Văn A');
      expect(blob.size).toBeGreaterThan(0);

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 1. Check content.opf metadata & multi-section manifest
      const opf = await zip.file('OEBPS/content.opf')?.async('string');
      expect(opf).toBeDefined();
      expect(opf).toContain('<dc:title>Tên Sách Thử Nghiệm</dc:title>');
      expect(opf).toContain('<dc:creator id="author_0">Nguyễn Văn A</dc:creator>');
      expect(opf).toContain('href="section1.xhtml"');
      expect(opf).toContain('href="section2.xhtml"');
      expect(opf).toContain('href="section3.xhtml"'); // Footnotes section

      // 2. Check hierarchical TOC in nav.xhtml and toc.ncx
      const nav = await zip.file('OEBPS/nav.xhtml')?.async('string');
      expect(nav).toContain('Phần I: Khởi đầu');
      expect(nav).toContain('Chương 1: Buổi sáng');
      expect(nav).toContain('Mục 1.1: Chi tiết nhỏ');
      expect(nav).toContain('Chương 2: Buổi chiều');
      expect(nav).toContain('Chú thích');

      const ncx = await zip.file('OEBPS/toc.ncx')?.async('string');
      expect(ncx).toContain('<meta name="dtb:depth" content="3"/>');
      expect(ncx).toContain('Chương 2: Buổi chiều');

      // 3. Check cross-section footnote link rewriting between section1.xhtml and section3.xhtml
      const sec1 = await zip.file('OEBPS/section1.xhtml')?.async('string');
      const sec3 = await zip.file('OEBPS/section3.xhtml')?.async('string');
      expect(sec1).toContain('href="section3.xhtml#footnote-c0-t-1"');
      expect(sec3).toContain('href="section1.xhtml#footnote-ref-c0-t-1"');
    });

    it('defaults dc:creator to "Không rõ" when author is empty or omitted', async () => {
      const blob = await EpubExporter.generateEpub('Sách Khuyết Danh', 'Nội dung thuần không có tiêu đề.');
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      const zip = await JSZip.loadAsync(arrayBuffer);

      const opf = await zip.file('OEBPS/content.opf')?.async('string');
      expect(opf).toContain('<dc:creator id="author_0">Không rõ</dc:creator>');

      const nav = await zip.file('OEBPS/nav.xhtml')?.async('string');
      expect(nav).toContain('Nội dung chính');
    });
  });

  describe('DocxExporter.generateDocx', () => {
    it('converts Markdown with headings, tables, footnotes, and LaTeX math into a valid DOCX package with OMML (<m:oMath>)', async () => {
      const markdown = [
        '# Chương 1: Toán & Hóa',
        'Công thức inline $\\text{Ca}^{2+} + 2\\text{Cl}^-$ và khối:',
        '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
        '| Cột A | Cột B |',
        '|---|---|',
        '| Giá trị 1 | Giá trị 2 |',
        'Đoạn văn có chú thích[^1].',
        '',
        '[^1]: Nội dung chú thích trong DOCX.'
      ].join('\n\n');

      const blob = await DocxExporter.generateDocx('Tài liệu Khoa học', markdown);
      expect(blob.size).toBeGreaterThan(0);

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      const zip = await JSZip.loadAsync(arrayBuffer);

      const documentXml = await zip.file('word/document.xml')?.async('string');
      expect(documentXml).toBeDefined();
      expect(documentXml).toContain('Chương 1: Toán &amp; Hóa');
      expect(documentXml).toContain('<m:oMath');
      expect(documentXml).toContain('Ca');
      expect(documentXml).toContain('Giá trị 1');
    });
  });
});
