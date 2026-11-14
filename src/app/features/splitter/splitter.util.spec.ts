import { describe, it, expect } from 'vitest';
import {
  countWords,
  escapeRegExp,
  smartHardSplit,
  generatePreview,
  analyzeAndSplitText
} from './splitter.util';

describe('splitter.util', () => {
  describe('countWords', () => {
    it('counts words accurately across normal, multiple, and unicode spaces', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   \n\t  ')).toBe(0);
      expect(countWords('Xin chào thế giới')).toBe(4);
      expect(countWords('One\u00A0Two\u2003Three\n\nFour')).toBe(4);
    });
  });

  describe('escapeRegExp', () => {
    it('escapes special regex characters safely', () => {
      const raw = 'Chapter [1].*+?^${}()|\\';
      const escaped = escapeRegExp(raw);
      const regex = new RegExp(escaped);
      expect(regex.test(raw)).toBe(true);
    });
  });

  describe('smartHardSplit', () => {
    it('returns a single chunk when word count is within maxWords', () => {
      const text = 'Đoạn văn ngắn chỉ có vài từ.';
      expect(smartHardSplit(text, 20)).toEqual([text]);
    });

    it('prefers splitting at paragraph boundaries (double newline)', () => {
      const p1 = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
      const p2 = Array.from({ length: 15 }, (_, i) => `next${i}`).join(' ');
      const combined = `${p1}\n\n${p2}`;

      const chunks = smartHardSplit(combined, 20);
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(p1);
      expect(chunks[1]).toBe(p2);
    });

    it('falls back to sentence boundaries when no newlines exist', () => {
      const s1 = Array.from({ length: 12 }, (_, i) => `first${i}`).join(' ') + '.';
      const s2 = Array.from({ length: 12 }, (_, i) => `second${i}`).join(' ') + '.';
      const combined = `${s1} ${s2}`;

      const chunks = smartHardSplit(combined, 15);
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(s1);
      expect(chunks[1]).toBe(s2);
    });
  });

  describe('generatePreview & Project Gutenberg handling', () => {
    it('extracts Project Gutenberg header and footer with excludeFromTranslation = true', () => {
      const sampleBook = [
        'The Project Gutenberg eBook of Sample',
        '*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***',
        '## Chapter 1',
        'This is the main story content of chapter one with several words.',
        '## Chapter 2',
        'This is the main story content of chapter two with several words.',
        '*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***',
        'Full license text at the end of the file.'
      ].join('\n');

      const regex = /^(##\s+.*)$/gim;
      const chapters = generatePreview(sampleBook, 'Thẻ H2', 1, 500, regex);

      expect(chapters.length).toBe(4);
      expect(chapters[0].title).toBe('Thông tin Project Gutenberg');
      expect(chapters[0].excludeFromTranslation).toBe(true);

      expect(chapters[1].title).toBe('Chapter 1');
      expect(chapters[1].excludeFromTranslation).toBeUndefined();

      expect(chapters[2].title).toBe('Chapter 2');
      expect(chapters[2].excludeFromTranslation).toBeUndefined();

      expect(chapters[3].title).toBe('Giấy phép Project Gutenberg');
      expect(chapters[3].excludeFromTranslation).toBe(true);
    });

    it('merges short chapters below minWords and splits long chapters above maxWords', () => {
      const ch1Words = Array.from({ length: 10 }, (_, i) => `a${i}`).join(' ');
      const ch2Words = Array.from({ length: 10 }, (_, i) => `b${i}`).join(' ');
      const ch3Words = Array.from({ length: 60 }, (_, i) => `c${i}`).join(' ');

      const md = `## Ch 1\n${ch1Words}\n\n## Ch 2\n${ch2Words}\n\n## Ch 3\n${ch3Words}`;
      const regex = /^(##\s+.*)$/gim;

      const chapters = generatePreview(md, 'Thẻ H2', 18, 35, regex);
      // Ch 1 (12 words) + Ch 2 (12 words) merge into "Ch 1 & Ch 2" (24 words)
      // Ch 3 (62 words) splits into "Ch 3 (Phần 1)" and "Ch 3 (Phần 2)"
      expect(chapters[0].title).toBe('Ch 1 & Ch 2');
      expect(chapters[1].title).toBe('Ch 3 (Phần 1)');
      expect(chapters[2].title).toBe('Ch 3 (Phần 2)');
    });
  });

  describe('analyzeAndSplitText', () => {
    it('evaluates heading, keyword, and standalone split modes accurately', () => {
      const md = [
        '## Chapter 1: Beginning',
        'Some text in chapter one.',
        '## Chapter 2: Middle',
        'Some text in chapter two.'
      ].join('\n');

      const headingMethods = analyzeAndSplitText(md, 1, 1000, 'heading', [], 'h2');
      expect(headingMethods.some(m => m.keyword === 'Thẻ H2' && m.count === 2)).toBe(true);

      const kwMethods = analyzeAndSplitText(md, 1, 1000, 'keyword', ['Chapter'], 'h2');
      expect(kwMethods.some(m => m.keyword === 'Chapter' && m.count === 2)).toBe(true);
    });
  });
});
