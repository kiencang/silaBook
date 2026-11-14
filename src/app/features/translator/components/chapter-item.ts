import { Component, input, model, output, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BookStore, Chapter, TranslationVersion } from '../../../core/book.store';
import { ToastService } from '../../../core/toast.service';
import { getConfiguredMarked, parseMarkdownWithImages } from '../../../core/marked-setup';
import { ReaderStore } from '../../../core/reader.store';
import { GeminiClient } from '../../../core/gemini';
import { OFFLINE_READER_SCRIPT, OFFLINE_READER_STYLES, OFFLINE_READER_TOOLBAR_HTML, PRINT_PDF_STYLES, escapeHtml } from '../../../core/html-export.util';
import { TranslatingSkeletonComponent } from './translating-skeleton';

@Component({
  selector: 'app-chapter-item',
  standalone: true,
  imports: [MatIconModule, DatePipe, TranslatingSkeletonComponent],
  host: {
    class: 'block',
    '(click)': 'onLinkClick($event)',
    '(window:resize)': 'onResize()'
  },
  templateUrl: './chapter-item.html'
})
export class ChapterItemComponent implements OnDestroy {
  store = inject(BookStore);
  toast = inject(ToastService);
  readerStore = inject(ReaderStore);
  gemini = inject(GeminiClient);
  private sanitizer = inject(DomSanitizer);
  chapter = input.required<Chapter>();
  index = input.required<number>();
  
  isExpanded = model(false);
  isFullscreen = signal(false);
  isBilingualFullscreen = signal(false);
  isBilingualAligned = signal(false);
  
  elapsedSeconds = signal(0);
  private intervalFn: ReturnType<typeof setInterval> | null = null;
  
  constructor() {
    effect(() => {
      const status = this.chapter().status;
      if (status === 'translating') {
        if (!this.intervalFn) {
          this.elapsedSeconds.set(0);
          this.intervalFn = setInterval(() => {
            this.elapsedSeconds.update(s => s + 1);
          }, 1000);
        }
      } else {
        if (this.intervalFn) {
          clearInterval(this.intervalFn);
          this.intervalFn = null;
        }
      }
    });
  }

  showGlossaryModal = signal(false);
  isClosingGlossaryModal = signal(false);
  parsedCustomGlossary = signal<SafeHtml | string>('');
  currentGlossaryRatio = signal<number | undefined>(undefined);
  currentGlossaryVersion = signal<number | undefined>(undefined);

  showSummaryModal = signal(false);
  isClosingSummaryModal = signal(false);
  activeSummary = signal('');

  showContextSummaryModal = signal(false);
  isClosingContextSummaryModal = signal(false);
  activeContextSummary = signal('');
  activeContextSummaryTitle = signal('');

  parsedOriginalText = computed(() =>
    this.parseMarkdown(this.chapter().originalText, 'c' + this.index() + '-o')
  );

  parsedTranslatedText = computed(() =>
    this.parseMarkdown(this.chapter().translatedText, 'c' + this.index() + '-t')
  );

  parsedActiveSummary = computed(() =>
    this.parseMarkdown(this.activeSummary(), this.chapter().id + '-sum')
  );

  parsedActiveContextSummary = computed(() =>
    this.parseMarkdown(this.activeContextSummary(), this.chapter().id + '-csum')
  );

  showPronounModal = signal(false);
  isClosingPronounModal = signal(false);
  parsedPronounSnapshot = signal<SafeHtml | string>('');
  currentPronounVersion = signal<number | undefined>(undefined);

  showCustomInstructionsModal = signal(false);
  isClosingCustomInstructionsModal = signal(false);
  parsedCustomInstructionsSnapshot = signal<SafeHtml | string>('');

  isGeneratingSummary = signal(false);
  showConfirmCreateSummary = signal(false);
  selectedVersionForSummary = signal<TranslationVersion | null>(null);

  ngOnDestroy() {
    if (this.intervalFn) {
      clearInterval(this.intervalFn);
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  confirmCreateSummary(version: TranslationVersion) {
    this.selectedVersionForSummary.set(version);
    this.showConfirmCreateSummary.set(true);
  }

  cancelConfirmSummary() {
    this.showConfirmCreateSummary.set(false);
    this.selectedVersionForSummary.set(null);
  }

  async generateMissingSummary() {
    const version = this.selectedVersionForSummary();
    if (!version || !version.text.trim()) {
      this.cancelConfirmSummary();
      return;
    }

    this.showConfirmCreateSummary.set(false);
    this.isGeneratingSummary.set(true);

    try {
      // Use the model stored in the version, or fallback to config model
      const model = version.model || this.store.config().model;
      const summary = await this.gemini.summarizeTranslation(version.text, model, this.store.config().translationMode);
      
      if (summary) {
        // Update the version in the chapter
        const currentChapter = this.chapter();
        if (currentChapter.versions) {
          const updatedVersions = currentChapter.versions.map(v => 
            v.versionNumber === version.versionNumber ? { ...v, summary } : v
          );
          
          this.store.updateChapter(currentChapter.id, {
            versions: updatedVersions
          });
          
          this.toast.success('Đã tạo bản tóm tắt thành công.');
        }
      } else {
        this.toast.error('Không thể tạo bản tóm tắt. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('Failed to create missing summary', e);
      this.toast.error('Có lỗi xảy ra khi tạo bản tóm tắt.');
    } finally {
      this.isGeneratingSummary.set(false);
      this.selectedVersionForSummary.set(null);
    }
  }

  viewPronounSnapshot(snapshotText: string | undefined, version: number | undefined) {
    if (!snapshotText) {
      this.parsedPronounSnapshot.set('');
    } else {
      this.parsedPronounSnapshot.set(this.parseMarkdown(snapshotText, 'pronoun'));
    }
    this.currentPronounVersion.set(version);
    this.showPronounModal.set(true);
  }

  triggerClosePronounModal() {
    this.isClosingPronounModal.set(true);
    setTimeout(() => {
      this.showPronounModal.set(false);
      this.isClosingPronounModal.set(false);
    }, 200);
  }

  viewCustomInstructionsSnapshot(snapshotText: string | undefined) {
    if (!snapshotText) {
      this.parsedCustomInstructionsSnapshot.set('');
    } else {
      this.parsedCustomInstructionsSnapshot.set(this.parseMarkdown(snapshotText, 'cinst'));
    }
    this.showCustomInstructionsModal.set(true);
  }

  triggerCloseCustomInstructionsModal() {
    this.isClosingCustomInstructionsModal.set(true);
    setTimeout(() => {
      this.showCustomInstructionsModal.set(false);
      this.isClosingCustomInstructionsModal.set(false);
    }, 200);
  }

  viewSummary(summary: string) {
    if (!summary) return;
    this.activeSummary.set(summary);
    this.showSummaryModal.set(true);
  }

  triggerCloseSummaryModal() {
    this.isClosingSummaryModal.set(true);
    setTimeout(() => {
      this.showSummaryModal.set(false);
      this.isClosingSummaryModal.set(false);
    }, 200);
  }

  viewContextSummary(summary: string | undefined, title: string | undefined) {
    if (!summary) return;
    this.activeContextSummary.set(summary);
    this.activeContextSummaryTitle.set(title || 'Chương trước');
    this.showContextSummaryModal.set(true);
  }

  triggerCloseContextSummaryModal() {
    this.isClosingContextSummaryModal.set(true);
    setTimeout(() => {
      this.showContextSummaryModal.set(false);
      this.isClosingContextSummaryModal.set(false);
    }, 200);
  }

  viewCustomGlossary(glossaryMd: string | undefined, ratio?: number, version?: number) {
    if (!glossaryMd) return;
    this.parsedCustomGlossary.set(this.parseMarkdown(glossaryMd, 'cgloss'));
    this.currentGlossaryRatio.set(ratio);
    this.currentGlossaryVersion.set(version);
    this.showGlossaryModal.set(true);
  }
  
  triggerCloseGlossaryModal() {
    this.isClosingGlossaryModal.set(true);
    setTimeout(() => {
      this.closeGlossaryModal();
      this.isClosingGlossaryModal.set(false);
    }, 200);
  }

  closeGlossaryModal() {
    this.showGlossaryModal.set(false);
  }

  translateSingle = output<void>();
  requestNavigate = output<number>();

  toggleExpand() {
    this.isExpanded.set(!this.isExpanded());
  }

  openFullscreen() {
    this.isFullscreen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeFullscreen() {
    this.isFullscreen.set(false);
    document.body.style.overflow = '';
  }

  openBilingualFullscreen() {
    this.isBilingualFullscreen.set(true);
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      this.alignBilingualBlocks();
    }, 50); // allow DOM to render
  }

  closeBilingualFullscreen() {
    this.isBilingualFullscreen.set(false);
    this.isBilingualAligned.set(false);
    document.body.style.overflow = '';
  }

  alignBilingualBlocks() {
    const originalProse = document.querySelector('.bilingual-fullscreen-container .prose-original');
    const translatedProse = document.querySelector('.bilingual-fullscreen-container .prose-translated');

    if (!originalProse || !translatedProse) return;

    const originalBlocks = Array.from(originalProse.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > blockquote, :scope > table')) as HTMLElement[];
    const translatedBlocks = Array.from(translatedProse.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > blockquote, :scope > table')) as HTMLElement[];

    // Lớp 1: Số lượng block phải bằng nhau
    if (originalBlocks.length !== translatedBlocks.length || originalBlocks.length === 0) {
      this.isBilingualAligned.set(false);
      return;
    }

    // Lớp 2: Loại tag của các block phải khớp nhau hoàn toàn theo thứ tự
    const tagsMatch = originalBlocks.every((el, i) => el.tagName === translatedBlocks[i].tagName);
    if (!tagsMatch) {
      this.isBilingualAligned.set(false);
      return;
    }

    this.isBilingualAligned.set(true);
    
    // Khôi phục chiều cao mặc định nếu trước đó đã áp dụng minHeight (để an toàn khi resize)
    for (let i = 0; i < originalBlocks.length; i++) {
        originalBlocks[i].style.minHeight = '';
        translatedBlocks[i].style.minHeight = '';
    }
  }

  onResize() {
    if (this.isBilingualFullscreen() && this.isBilingualAligned()) {
      this.alignBilingualBlocks();
    }
  }

  onBilingualContentClick(event: Event, source: 'original' | 'translated') {
    const target = event.target as HTMLElement;
    
    // Ignore click on links (like footnotes/back-references) from triggering alignment logic
    if (target.closest('a')) {
      return;
    }
    
    const blockElement = target.closest('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table') as HTMLElement;
    if (!blockElement) return;

    const parentProse = blockElement.closest('.prose');
    if (!parentProse) return;

    const allBlocks = Array.from(parentProse.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > blockquote, :scope > table'));
    const index = allBlocks.indexOf(blockElement);

    if (index === -1) return;

    const isAligned = this.isBilingualAligned();

    // Find counterpart container
    const counterpartSelector = source === 'original' ? '.prose-translated' : '.prose-original';
    const counterpartProse = document.querySelector(`.bilingual-fullscreen-container ${counterpartSelector}`);
    const counterpartScrollContainer = counterpartProse?.closest('.overflow-y-auto') as HTMLElement;
    const activeScrollContainer = parentProse.closest('.overflow-y-auto') as HTMLElement;

    if (counterpartProse && counterpartScrollContainer && activeScrollContainer) {
      const counterpartBlocks = Array.from(counterpartProse.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > blockquote, :scope > table'));
      const counterpartBlock = counterpartBlocks[index] as HTMLElement;
      
      if (counterpartBlock) {
        if (isAligned) {
            // Exactly sync position relative to viewport
            const activeBlockRect = blockElement.getBoundingClientRect();
            const activeContainerRect = activeScrollContainer.getBoundingClientRect();
            const relativeTopOffset = activeBlockRect.top - activeContainerRect.top;
            
            const counterpartBlockRect = counterpartBlock.getBoundingClientRect();
            const counterpartContainerRect = counterpartScrollContainer.getBoundingClientRect();
            const targetScrollTop = counterpartScrollContainer.scrollTop + (counterpartBlockRect.top - counterpartContainerRect.top) - relativeTopOffset;
            
            counterpartScrollContainer.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });
        } else {
            // Fallback to center scroll without strong highlighting if not strictly aligned
            counterpartBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  prevTranslatedChapterIndex(): number {
    const chapters = this.store.chapters();
    const prevIndex = this.index() - 1;
    if (prevIndex >= 0 && chapters[prevIndex].translatedText) {
      return prevIndex;
    }
    return -1;
  }

  nextTranslatedChapterIndex(): number {
    const chapters = this.store.chapters();
    const nextIndex = this.index() + 1;
    if (nextIndex < chapters.length && chapters[nextIndex].translatedText) {
      return nextIndex;
    }
    return -1;
  }

  navigateTo(index: number) {
    this.closeFullscreen();
    this.requestNavigate.emit(index);
  }

  changeFontSize(delta: number) {
    const current = this.readerStore.prefs().fontSize;
    this.readerStore.updatePrefs({ fontSize: Math.max(14, Math.min(42, current + delta)) });
  }

  changeTheme(theme: 'white' | 'sepia' | 'dark') {
    this.readerStore.updatePrefs({ theme });
  }

  changeFontFamily(fontFamily: 'Inter' | 'Lora' | 'Lexend') {
    this.readerStore.updatePrefs({ fontFamily });
  }

  resetPrefs() {
    this.readerStore.resetPrefs();
  }

  toggleToolbar() {
    this.readerStore.updatePrefs({ isToolbarExpanded: !this.readerStore.prefs().isToolbarExpanded });
  }

  getContainerBg(theme: string) {
    switch (theme) {
      case 'dark': return '#121212';
      case 'white': return '#FFFFFF';
      case 'sepia':
      default: return '#FFFFF0';
    }
  }

  getCloseBtnClass(theme: string) {
    switch (theme) {
      case 'dark': return 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:bg-zinc-700/90';
      case 'white': return 'bg-zinc-100/90 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-200/90';
      case 'sepia':
      default: return 'bg-[#EAE4D3]/90 text-[#8C7A6B] hover:text-[#4A3C31] border border-[#DED6C1] hover:bg-[#DED6C1]/90';
    }
  }

  getToolbarClass(theme: string) {
    switch (theme) {
      case 'dark': return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      case 'white': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'sepia':
      default: return 'bg-[#F3EFE0] text-[#5C4D3C] border-[#E8DFC8]';
    }
  }

  getContentClass(theme: string) {
    switch (theme) {
      case 'dark': return 'prose-invert prose-p:text-zinc-300 prose-headings:text-zinc-100 prose-strong:text-zinc-200 prose-blockquote:text-zinc-400';
      case 'white': return 'prose-p:text-zinc-800 prose-headings:text-zinc-900';
      case 'sepia':
      default: return 'prose-p:text-[#333333] prose-headings:text-[#111111] prose-blockquote:text-[#555555]';
    }
  }

  getFontFamily(font: string) {
    switch (font) {
      case 'Lora': return "'Lora', serif";
      case 'Lexend': return "'Lexend', sans-serif";
      case 'Inter':
      default: return "'Inter', sans-serif";
    }
  }

  private getChapterImages(markdown: string): Record<string, string> | undefined {
    const allImages = this.store.images();
    if (!allImages) return undefined;
    const lowerMarkdown = markdown.toLowerCase();
    const filtered: Record<string, string> = {};
    for (const [key, dataUrl] of Object.entries(allImages)) {
      const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (lowerMarkdown.includes(key.toLowerCase()) || (cleanKey && lowerMarkdown.includes(cleanKey))) {
        filtered[key] = dataUrl;
      }
    }
    return filtered;
  }

  async downloadEpub() {
    const text = this.chapter().translatedText;
    if (!text) return;

    this.toast.info('Đang khởi tạo file EPUB...');
    await new Promise(resolve => setTimeout(resolve, 20));
    try {
      const prefix = 'c' + this.index() + '-t';
      const processed = text.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const fullTitle = `${this.store.currentProjectName()}_${title}`;
      const chapterImages = this.getChapterImages(processed);

      const { EpubExporter } = await import('../../../core/epub-export.util');
      const authorName = this.store.author().trim() || 'Không rõ';
      const blob = await EpubExporter.generateEpub(fullTitle, processed, chapterImages, authorName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.store.currentProjectName()}_${title}_silaBook_vi.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Đã tải xuống file EPUB.');
    } catch (e: unknown) {
      console.error('Error exporting chapter to EPUB:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống EPUB.');
    }
  }

  async downloadDocx() {
    const text = this.chapter().translatedText;
    if (!text) return;

    this.toast.info('Đang khởi tạo file DOCX...');
    await new Promise(resolve => setTimeout(resolve, 20));
    try {
      const prefix = 'c' + this.index() + '-t';
      const processed = text.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const fullTitle = `${this.store.currentProjectName()}_${title}`;
      const chapterImages = this.getChapterImages(processed);

      const { DocxExporter } = await import('../../../core/docx-export.util');
      const blob = await DocxExporter.generateDocx(fullTitle, processed, chapterImages);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.store.currentProjectName()}_${title}_silaBook_vi.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Đã tải xuống file DOCX.');
    } catch (e: unknown) {
      console.error('Error exporting chapter to DOCX:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống DOCX.');
    }
  }

  downloadPdf() {
    const text = this.chapter().translatedText;
    if (!text) return;

    try {
      const prefix = 'c' + this.index() + '-t';
      const processed = text.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const htmlBody = parseMarkdownWithImages(processed, this.store.images());
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const safeTitle = escapeHtml(`${this.store.currentProjectName()}_${title}_silaBook_vi`);
      const printScriptUrl = escapeHtml(new URL('print-trigger.js', document.baseURI).href);
      const htmlDoc = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${PRINT_PDF_STYLES}
</style>
</head>
<body>
<div class="content-wrapper">
${htmlBody}
</div>
<script src="${printScriptUrl}"></script>
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (!newWindow) {
        this.toast.error('Vui lòng cho phép popup để nhận PDF');
        return;
      }
      this.toast.success('Đang tạo bản PDF chuẩn bị tải...');
    } catch (e: unknown) {
      console.error('Error opening PDF print:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống PDF.');
    }
  }

  downloadHtml() {
    const text = this.chapter().translatedText;
    if (!text) return;

    try {
      const prefix = 'c' + this.index() + '-t';
      const processed = text.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const htmlBody = parseMarkdownWithImages(processed, this.store.images());
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const safeProjectId = escapeHtml(this.store.currentProjectId());
      const safeChapterId = escapeHtml(this.chapter().id);
      const safeTitle = escapeHtml(`${this.store.currentProjectName()}_${title}_silaBook_vi`);
      const htmlDoc = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-sila-project-id" content="${safeProjectId}">
<meta name="x-sila-chapter-id" content="${safeChapterId}">
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Lexend:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${OFFLINE_READER_STYLES}
</style>
</head>
<body>
${OFFLINE_READER_TOOLBAR_HTML}
<div class="content-wrapper">
${htmlBody}
</div>
${OFFLINE_READER_SCRIPT}
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.store.currentProjectName()}_${title}_silaBook_vi.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Đã tải xuống file HTML.');
    } catch (e: unknown) {
      console.error('Error exporting to HTML:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống HTML.');
    }
  }

  parseMarkdown(text: string | undefined, prefix = ''): SafeHtml | string {
    if (!text) return '';
    let processedText = text;
    if (prefix) {
      processedText = processedText.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
    }
    const parsed = getConfiguredMarked().parse(processedText) as string;
    return this.sanitizer.bypassSecurityTrustHtml(parsed);
  }

  onLinkClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('#fn') || href.startsWith('#footnote'))) {
        event.preventDefault();
        event.stopPropagation();
        
        const id = href.substring(1);
        
        // Locate target element LOCALLY first, to avoid selecting duplicate IDs from other renderers!
        // We look inside the closest '.prose' container of the clicked link.
        const parentProse = anchor.closest('.prose');
        let targetElement = parentProse?.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement;
        
        // Fallback to global document.getElementById if not found locally
        if (!targetElement) {
          targetElement = document.getElementById(id) as HTMLElement;
        }
        
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30', 'transition-colors', 'duration-300', 'rounded', 'px-1');
          setTimeout(() => {
            targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30');
          }, 2000);
        }
      }
    }
  }

  getActiveVersion(chapter: Chapter) {
    if (!chapter.versions || !chapter.activeVersionNumber) return null;
    return chapter.versions.find(v => v.versionNumber === chapter.activeVersionNumber) || null;
  }
}
