import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  parseMarkdownWithImages,
  matchInlineMathAt
} from './marked-setup';

describe('marked-setup & HTML/MathML sanitizer', () => {
  describe('sanitizeHtml', () => {
    it('removes executable tags (<script>, <style>, <iframe>, <svg>, <object>) and their subtrees', () => {
      const malicious = `
        <p>Đoạn văn an toàn</p>
        <script>window.xss = 1;</script>
        <svg onload="alert(1)"><script>alert(2)</script></svg>
        <iframe src="https://evil.example.com"></iframe>
        <style>body { display: none; }</style>
      `;
      const clean = sanitizeHtml(malicious);
      expect(clean).toContain('<p>Đoạn văn an toàn</p>');
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('<svg');
      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('<style');
    });

    it('strips inline event handlers (on*) and dangerous URI schemes (javascript:, data:text/html)', () => {
      const malicious = `
        <a href="javascript:alert(1)" onclick="steal()">Link 1</a>
        <a href="jav&#x0A;ascript:alert(2)">Link 2</a>
        <a href="data:text/html,<script>alert(3)</script>">Link 3</a>
        <img src="javascript:alert(4)" onerror="alert(5)" alt="Pic" />
      `;
      const clean = sanitizeHtml(malicious);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('data:text/html');
    });

    it('enforces MathML namespace isolation by rejecting non-MathML tags inside <math>', () => {
      const mXssVector = `<math><mrow><mi>x</mi><mtext><img src="x" onerror="alert(1)"/></mtext></mrow></math>`;
      const clean = sanitizeHtml(mXssVector);
      expect(clean).toContain('<math>');
      expect(clean).toContain('<mi>x</mi>');
      expect(clean).not.toContain('<img');
      expect(clean).not.toContain('onerror');
    });
  });

  describe('parseMarkdownWithImages & KaTeX / Footnotes', () => {
    it('renders inline and block LaTeX formulas into valid MathML', () => {
      const md = `Công thức inline $E = mc^2$ và khối:\n\n$$\\int_0^1 x^2 dx$$`;
      const html = parseMarkdownWithImages(md);
      expect(html).toContain('<math');
      expect(html).toContain('mc');
      expect(html).toContain('∫');
    });

    it('resolves scoped images without mutating global window.__SILA_IMAGES__', () => {
      if (typeof window !== 'undefined') {
        window.__SILA_IMAGES__ = { SILA_IMG_GLOBAL: 'data:image/png;base64,AAAA' };
      }

      const customMap = {
        SILA_IMG_0: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      };
      const html = parseMarkdownWithImages('![Minh họa](SILA_IMG_0)', customMap);

      expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo');
      if (typeof window !== 'undefined') {
        expect(window.__SILA_IMAGES__).toEqual({ SILA_IMG_GLOBAL: 'data:image/png;base64,AAAA' });
      }
    });

    it('supports custom heading IDs {#custom-id} and footnotes [^1]', () => {
      const md = `## Chương 1: Mở đầu {#chuong-1}\n\nĐoạn văn có chú thích[^1].\n\n[^1]: Nội dung giải thích chú thích.`;
      const html = parseMarkdownWithImages(md);
      expect(html).toContain('<h2 id="chuong-1">Chương 1: Mở đầu</h2>');
      expect(html).toContain('id="footnote-1"');
      expect(html).toContain('Nội dung giải thích chú thích.');
    });
  });

  describe('matchInlineMathAt', () => {
    it('matches valid inline math $...$ while ignoring currency amounts like $100 and $200', () => {
      expect(matchInlineMathAt('$x^2 + 1$', ' ')).toEqual({
        raw: '$x^2 + 1$',
        text: 'x^2 + 1',
        displayMode: false
      });
      expect(matchInlineMathAt('$100 to $200', ' ')).toBeNull();
    });
  });
});
