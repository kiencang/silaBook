import { Component, inject, signal, effect, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookStore } from '../../core/book.store';
import { ToastService } from '../../core/toast.service';
import { GeminiClient, parseGeminiError, isQuotaError } from '../../core/gemini';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MarkdownTableEditorComponent } from '../../shared/components/markdown-table-editor.component';
import { smartHardSplit } from '../splitter/splitter.util';
import * as XLSX from 'xlsx';
import { hasSecureApiKey } from '../../core/crypto-storage.util';

@Component({
  selector: 'app-glossary-setup',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, MarkdownTableEditorComponent],
  template: `
    <div class="py-8">
      <div class="max-w-5xl mx-auto lg:px-8 px-4 flex items-center justify-between mb-8">
        <div>
          <h2 class="text-2xl font-bold text-zinc-900">Thiết lập Bảng Thuật Ngữ / Từ Khó (Tùy chọn)</h2>
          <p class="text-zinc-500 mt-1">Sử dụng mô hình AI mạnh để quét cuốn sách và trích xuất bảng thuật ngữ/từ khó dịch. Giúp bản dịch có chất lượng cao và thống nhất hơn, đặc biệt cần thiết với sách khó dịch. Mặc dù đây là tùy chọn, không bắt buộc, nhưng khi tạo thường cho kết quả tốt hơn với bất kỳ thể loại sách nào.</p>
          <p class="text-zinc-500 mt-2">Việc phân tích đầy đủ cả cuốn sách thường tốn thời gian từ 3 - 10 phút, tùy độ dài & tùy model AI. Nó cũng đặc biệt tốn token, nên nếu bạn dùng model Pro sẽ hết ngưỡng miễn phí sớm, bạn có thể dùng model Flash cho nhiệm vụ này. Đối với phân tích từ khó, model Flash cho chất lượng rất tốt, không kém nhiều so với model Pro.</p>
        </div>
      </div>

      <div class="max-w-5xl mx-auto lg:px-8 px-4 space-y-6 mb-8">
        <div class="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
          @if (glossaryTask() && !isGenerating()) {
            <div class="text-sm text-amber-700 bg-amber-50 rounded-lg p-4 border border-amber-200 mb-4">
              <p class="font-medium mb-1">Tiến trình bị gián đoạn</p>
              <p class="text-amber-600">Bạn có một tiến trình tạo bảng thuật ngữ đang dở dang (đã hoàn thành {{ completedChunksCount() }}/{{ glossaryTask()?.totalChunks }} phần). Bạn có thể tiếp tục hoặc hủy bỏ để bắt đầu lại.</p>
            </div>
          }
          <div class="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div class="w-full lg:w-1/2">
              <label for="glossaryModel" class="block text-xs font-semibold text-zinc-700 uppercase tracking-widest mb-2">Mô hình nhận diện</label>
              <select id="glossaryModel" [value]="glossaryModel()" (change)="glossaryModel.set($any($event.target).value)" [disabled]="isGenerating() || !!glossaryTask()" class="w-full pl-3 pr-8 py-2 text-sm border-zinc-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg border disabled:cursor-not-allowed">
                <option value="gemini-flash-latest">Flash (Nhanh & Tiết kiệm)</option>
                <option value="gemini-pro-latest">Pro (Tư duy sâu & Chuẩn xác)</option>
              </select>
            </div>
            
            <div class="w-full lg:w-1/2">
              @if (glossaryTask() && !isGenerating()) {
                <div class="flex gap-3">
                  <button 
                    (click)="resumeGeneration()"
                    [disabled]="isGenerating()"
                    class="flex-1 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <mat-icon class="mr-2 !w-5 !h-5 !text-[20px]">play_circle</mat-icon>
                    Tiếp tục quá trình tạo ({{ completedChunksCount() }}/{{ glossaryTask()?.totalChunks }})
                  </button>
                  <button 
                    (click)="cancelTask()"
                    [disabled]="isGenerating()"
                    class="px-4 py-2 border border-red-200 text-sm font-medium rounded-lg shadow-sm text-red-600 bg-white hover:bg-red-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Hủy tiến trình cũ
                  </button>
                </div>
              } @else {
                <button 
                  (click)="startGeneration()"
                  [disabled]="isGenerating()"
                  class="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                >
                  @if (isGenerating()) {
                    <mat-icon class="animate-spin mr-2 !w-5 !h-5 !text-[20px]">sync</mat-icon>
                    {{ generationStatus() || 'Đang phân tích sách và tạo bảng thuật ngữ...' }}
                  } @else if (draftTable().trim().length > 0) {
                    <mat-icon class="mr-2 !w-5 !h-5 !text-[20px]">refresh</mat-icon>
                    Tạo lại bảng dữ liệu Thuật ngữ
                  } @else {
                    <mat-icon class="mr-2 !w-5 !h-5 !text-[20px]">auto_awesome</mat-icon>
                    Bắt đầu tạo bảng Thuật ngữ tự động
                  }
                </button>
              }
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-5 rounded-xl border border-zinc-200 flex flex-col sm:flex-row gap-4 sm:items-start justify-between shadow-sm">
          <div>
            <h3 class="font-bold text-zinc-900">Sử dụng danh sách thuật ngữ của bạn [Khi bạn không muốn AI tạo]</h3>
            <p class="text-sm text-zinc-500 mt-1">Tải lên file Excel (.xlsx) chứa danh sách từ khó của riêng bạn để ứng dụng sử dụng cho bản dịch. Trước hết hãy "Tải file mẫu" về để có mẫu chuẩn. Lưu ý: Phải có nội dung Tiếng Anh / Từ loại / Tiếng Việt cho các hàng thông tin, riêng Ghi chú văn cảnh không bắt buộc phải có nội dung.</p>
          </div>
          <div class="flex flex-col gap-3 w-full sm:w-[220px] shrink-0">
            <button 
              (click)="downloadTemplate()"
              class="w-full flex justify-center items-center px-4 py-2 bg-indigo-50 border border-indigo-200 text-sm font-medium rounded-lg text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 focus:outline-none transition-colors whitespace-nowrap"
            >
              <mat-icon class="mr-2 !w-4 !h-4 !text-[16px]">download</mat-icon>
              Tải file mẫu
            </button>
            <button 
              (click)="fileInput.click()"
              class="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none transition-colors whitespace-nowrap"
            >
              <mat-icon class="mr-2 !w-4 !h-4 !text-[16px]">upload_file</mat-icon>
              Tải lên file (.xlsx)
            </button>
            <input type="file" #fileInput (change)="onFileUpload($event)" accept=".xlsx" class="hidden">
          </div>
        </div>
      </div>

      <div class="w-full max-w-[2000px] mx-auto px-2 lg:px-4 mb-8">
        <div class="bg-white rounded-xl shadow-sm border border-zinc-200 p-4 lg:p-6">
          <div class="w-full">
            <app-markdown-table-editor
              #editor
              [value]="draftTable()"
              (valueChange)="onTableChange($event)"
              [disabled]="isGenerating()"
              placeholder="Ví dụ:&#10;| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |&#10;|---|---|---|---|&#10;| Hogwarts | Noun | Hogwarts | Trường đào tạo phù thủy |"
            >
              @if (store.glossaryVersions().length > 0) {
                <div class="flex items-center justify-between py-2 border-b border-zinc-100 mb-2 relative">
                  <div class="flex items-center space-x-2">
                    @for (v of store.glossaryVersions(); track v.id; let i = $index) {
                      <button 
                        (click)="selectVersion(v)"
                        [class.bg-indigo-50]="store.activeGlossaryVersionId() === v.id"
                        [class.text-indigo-700]="store.activeGlossaryVersionId() === v.id"
                        [class.border-indigo-200]="store.activeGlossaryVersionId() === v.id"
                        [class.bg-white]="store.activeGlossaryVersionId() !== v.id"
                        [class.text-zinc-600]="store.activeGlossaryVersionId() !== v.id"
                        [class.border-zinc-200]="store.activeGlossaryVersionId() !== v.id"
                        class="group relative px-3 py-1 text-xs font-medium border rounded-md transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        V{{ v.versionNumber }}
                        @if (store.activeGlossaryVersionId() === v.id) {
                          <div class="pointer-events-none font-normal normal-case absolute top-full left-0 mt-2 w-72 opacity-0 transition-opacity group-hover:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-2 px-3 shadow-lg text-left">
                            Bạn đang đọc phiên bản này, phiên bản nào được bạn chọn sẽ là phiên bản công cụ dùng trong quá trình dịch thuật. Bạn có thể chọn bất cứ phiên bản nào mình muốn. Có tối đa 3 phiên bản gần nhất được lưu trữ.
                            <div class="absolute bottom-full left-4 border-4 border-transparent border-b-zinc-900"></div>
                          </div>
                        }
                      </button>
                    }
                  </div>

                  @if (editor.mode() === 'raw' && draftTable().trim().length > 0) {
                    <div class="absolute left-1/2 -translate-x-1/2">
                      <button 
                        (click)="copyRawData()"
                        class="px-3 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors flex items-center gap-1.5 border border-zinc-200"
                        title="Copy toàn bộ bảng"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">content_copy</mat-icon>
                        Copy toàn bộ bảng
                      </button>
                    </div>
                  }

                  @if (activeVersion()) {
                    <div class="flex items-center space-x-3 text-xs text-zinc-500">
                      <span class="flex items-center" title="Model"><mat-icon class="!w-4 !h-4 !text-[16px] mr-1">model_training</mat-icon> {{ getModelDisplay(activeVersion()) }}</span>
                      <span class="flex items-center" title="Thời gian"><mat-icon class="!w-4 !h-4 !text-[16px] mr-1">schedule</mat-icon> {{ activeVersion()?.timestamp | date:'HH:mm dd/MM/yy' }}</span>
                    </div>
                  }
                </div>
              }
            </app-markdown-table-editor>
          </div>
        </div>
      </div>

      <div class="w-full max-w-[2000px] mx-auto px-2 lg:px-4 flex justify-between items-center">
        <button 
          (click)="skipAndContinue()"
          [disabled]="isGenerating()"
          class="flex items-center space-x-2 text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-50 px-6 py-3 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <span>Bỏ qua phần này</span>
          <mat-icon class="!w-5 !h-5 !text-xl !flex !items-center !justify-center">fast_forward</mat-icon>
        </button>

        <button 
          (click)="saveChanges()"
          [disabled]="isGenerating() || !isManuallyEdited()"
          class="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-4"
        >
          <span>Lưu thay đổi</span>
          <mat-icon class="!w-5 !h-5 !text-xl !flex !items-center !justify-center">save</mat-icon>
        </button>

        <button 
          (click)="saveAndContinue()"
          [disabled]="isGenerating() || store.glossaryVersions().length === 0"
          class="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          <span>Tiếp tục</span>
          <mat-icon class="!w-5 !h-5 !text-xl !flex !items-center !justify-center">arrow_forward</mat-icon>
        </button>
      </div>
    </div>
  `
})
export class GlossarySetup {
  store = inject(BookStore);
  gemini = inject(GeminiClient);
  toast = inject(ToastService);

  isGenerating = signal<boolean>(false);
  generationStatus = signal<string>('');
  draftTable = signal<string>('');
  
  glossaryTask = this.store.glossaryTask;
  completedChunksCount = computed(() => this.glossaryTask()?.chunks.filter(c => c.status === 'completed').length || 0);

  glossaryModel = signal<string>(this.store.glossaryTask()?.model ?? this.store.config().glossaryGenModel ?? 'gemini-flash-latest');
  isManuallyEdited = signal<boolean>(false);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      const activeContent = this.store.glossaryTable();
      if (!this.isManuallyEdited()) {
        this.draftTable.set(activeContent);
      }
    });
  }

  activeVersion() {
    const id = this.store.activeGlossaryVersionId();
    if (!id) return null;
    return this.store.glossaryVersions().find(v => v.id === id);
  }

  getModelDisplay(v: import('../../core/db').ContentVersion | null | undefined): string {
    if (!v) return '';
    if (v.source === 'manual') {
      if (v.model === 'Tải lên từ Excel') return 'Từ file Excel';
      return 'Thủ công';
    }
    const name = v.model.includes('pro') ? 'Pro' : 'Flash';
    if (v.source === 'ai_edited') return `${name} (Chỉnh tay)`;
    return name;
  }

  selectVersion(v: import('../../core/db').ContentVersion) {
    this.store.selectGlossaryVersion(v.id);
    this.draftTable.set(v.content);
    this.isManuallyEdited.set(false);
  }

  onTableChange(val: string) {
    this.draftTable.set(val);
    this.isManuallyEdited.set(true);
  }

  async copyRawData() {
    try {
      if (this.draftTable().trim()) {
        await navigator.clipboard.writeText(this.draftTable());
        this.toast.success('Đã sao chép nội dung bảng!');
      }
    } catch (err) {
      this.toast.error('Không thể sao chép: ' + err);
    }
  }

  cancelTask() {
    this.store.setGlossaryTask(undefined);
  }

  getFullText() {
    let fullText = '';
    const chapters = this.store.chapters();
    if (chapters && chapters.length > 0) {
       fullText = chapters.filter(c => !c.excludeFromTranslation).map(c => c.title + '\n' + c.originalText).join('\n\n');
    } else {
       fullText = this.store.rawMarkdown() || '';
    }
    return fullText;
  }

  async startGeneration() {
    const hasKey = await hasSecureApiKey();
    if (!hasKey) {
      this.toast.error('Vui lòng thêm GEMINI API KEY CÁ NHÂN (biểu tượng chìa khóa ở góc trái dưới cùng màn hình) trước khi sử dụng tính năng này.');
      return;
    }

    const fullText = this.getFullText();

    if (!fullText) {
       this.toast.error(this.toast.Messages.NO_CONTENT_TO_ANALYZE);
       return;
    }

    const maxWordsPerChunk = 10000;
    const chunkTexts = smartHardSplit(fullText, maxWordsPerChunk);
    
    this.store.setGlossaryTask({
      status: 'processing',
      model: this.glossaryModel(),
      totalChunks: chunkTexts.length,
      chunks: chunkTexts.map((text, i) => ({
        index: i,
        text,
        status: 'pending'
      }))
    });

    await this.processGlossaryTask();
  }

  async resumeGeneration() {
    const task = this.store.glossaryTask();
    if (task) {
      this.glossaryModel.set(task.model);
      await this.processGlossaryTask();
    }
  }

  async processGlossaryTask() {
    const task = this.store.glossaryTask();
    if (!task) return;

    try {
      this.isGenerating.set(true);
      this.store.isGeneratingMetadata.set(true);
      
      this.store.updateConfig({
        glossaryGenModel: task.model
      });

      const isProModel = task.model.includes('pro');
      const maxConcurrent = isProModel ? 2 : 4;
      
      const chunksToProcess = task.chunks.filter(c => c.status !== 'completed');
      
      this.generationStatus.set(`Đang tiếp tục phân tích... (${task.chunks.length - chunksToProcess.length}/${task.totalChunks})`);

      for (let i = 0; i < chunksToProcess.length; i += maxConcurrent) {
        const batch = chunksToProcess.slice(i, i + maxConcurrent);
        const promises = batch.map(async chunk => {
          try {
            const result = await this.gemini.generateGlossaryRaw(chunk.text, task.model, this.store.bookTitle(), this.store.author());
            chunk.result = result;
            chunk.status = 'completed';
          } catch (err) {
            chunk.status = 'error';
            throw err;
          }
        });
        
        await Promise.all(promises);
        
        // Save intermediate state
        this.store.updateTaskBatch('glossaryTask', { ...task }, batch.map(c => c.index));
        
        const completedCount = task.chunks.filter(c => c.status === 'completed').length;
        this.generationStatus.set(`Đang nhận diện Thuật ngữ (${completedCount}/${task.totalChunks})...`);
      }

      // If all completed, generate final
      const allCompleted = task.chunks.every(c => c.status === 'completed');
      if (allCompleted) {
        this.generationStatus.set('Đang tổng hợp bảng thuật ngữ...');
        const allGlossaryItems = task.chunks.flatMap(c => Array.isArray(c.result) ? c.result : []);
        
        // Deduplicate by english + pos
        const uniqueItems = new Map<string, { english?: string; pos?: string; vietnamese?: string; contextNotes?: string; }>();
        for (const item of allGlossaryItems) {
          if (!item.english) continue;
          const key = `${String(item.english).toLowerCase().trim()}_${String(item.pos || '').toLowerCase().trim()}`;
          if (!uniqueItems.has(key)) {
            uniqueItems.set(key, item);
          }
        }
        
        const deduplicatedGlossary = Array.from(uniqueItems.values());
        deduplicatedGlossary.sort((a, b) => String(a.english).localeCompare(String(b.english)));

        let result = '';
        if (deduplicatedGlossary.length > 0) {
          result = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
          for (const pt of deduplicatedGlossary) {
            result += `| ${pt.english || ''} | ${pt.pos || ''} | ${pt.vietnamese || ''} | ${pt.contextNotes || ''} |\n`;
          }
        }

        this.draftTable.set(result);
        this.isManuallyEdited.set(false);
        this.store.addGlossaryVersion(result, task.model);
        this.store.saveGlossaryConf(true);
        this.store.setGlossaryTask(undefined);
        this.toast.success(this.toast.Messages.GLOSSARY_SUCCESS);
      }
    } catch (e: unknown) {
      if (!isQuotaError(e)) {
        console.error(e);
      }
      this.store.setGlossaryTask({ ...task, status: 'error' });
      this.toast.error(this.toast.Messages.GLOSSARY_ERROR(parseGeminiError(e)));
    } finally {
      this.isGenerating.set(false);
      this.store.isGeneratingMetadata.set(false);
    }
  }

  saveChanges() {
    if (this.isManuallyEdited()) {
      const active = this.activeVersion();
      const isFromAi = active && active.source !== 'manual';
      const model = active ? active.model : this.glossaryModel();
      const source: 'ai_edited' | 'manual' = isFromAi ? 'ai_edited' : 'manual';
      this.store.addGlossaryVersion(this.draftTable(), model, source);
      this.store.saveGlossaryConf(true);
      this.isManuallyEdited.set(false);
      this.toast.success('Đã lưu version mới');
    }
  }

  saveAndContinue() {
    if (this.isManuallyEdited()) {
      this.saveChanges();
    }
    this.store.saveGlossaryConf(true);
    this.store.phase.set(5);
  }

  skipAndContinue() {
    this.store.saveGlossaryConf(false);
    this.store.phase.set(5);
  }

  downloadTemplate() {
    const ws_data = [
      ['Tiếng Anh', 'Từ loại', 'Tiếng Việt', 'Ghi chú văn cảnh'],
      ['Defenestration', 'Noun', 'Sự ném qua cửa sổ', '(Không bắt buộc) Hành động ném ai đó hoặc thứ gì đó ra ngoài cửa sổ'],
      ['Petrichor', 'Noun', 'Mùi đất sau mưa', '(Không bắt buộc) Mùi dễ chịu đặc trưng thường theo sau cơn mưa đầu tiên sau một thời gian khô hạn dài']
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Auto size columns
    ws['!cols'] = [
      { wch: 25 }, // Tiếng Anh
      { wch: 15 }, // Từ loại
      { wch: 25 }, // Tiếng Việt
      { wch: 50 }  // Ghi chú văn cảnh
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Thuật ngữ");
    XLSX.writeFile(wb, "Mau_Tu_Dien_Thuat_Ngu.xlsx");
  }

  async onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    // Check file size limit (2MB)
    const MAX_SIZE_MB = 2;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      this.toast.error(`File Excel tải lên vượt quá giới hạn ${MAX_SIZE_MB}MB.`);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        if (json.length < 2) {
          this.toast.error('File Excel không có dữ liệu hoặc không đúng định dạng.');
          return;
        }

        const headers = json[0] as string[];
        const requiredHeaders = ['Tiếng Anh', 'Từ loại', 'Tiếng Việt', 'Ghi chú văn cảnh'];
        
        const hasAllHeaders = requiredHeaders.every(rh => headers.some(h => String(h).trim().toLowerCase() === rh.toLowerCase()));
        
        if (!hasAllHeaders) {
          this.toast.error('File Excel không đúng định dạng mẫu. Vui lòng tải file mẫu và đảm bảo có đủ 4 cột bắt buộc.');
          return;
        }
        
        const engIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'tiếng anh');
        const posIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'từ loại');
        const viIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'tiếng việt');
        const noteIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'ghi chú văn cảnh');

        let result = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
        let validRowsCount = 0;
        let invalidRowsCount = 0;

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;
          
          const eng = row[engIdx] ? String(row[engIdx]).trim().replace(/\|/g, '-') : '';
          const pos = row[posIdx] ? String(row[posIdx]).trim().replace(/\|/g, '-') : '';
          const vi = row[viIdx] ? String(row[viIdx]).trim().replace(/\|/g, '-') : '';
          const note = row[noteIdx] ? String(row[noteIdx]).trim().replace(/\|/g, '-') : '';

          if (!eng && !pos && !vi && !note) continue; // Bỏ qua dòng hoàn toàn trống

          if (eng === 'Defenestration' || eng === 'Petrichor') {
            continue; // Bỏ qua ví dụ mẫu
          }

          if (eng && pos && vi) {
            result += `| ${eng} | ${pos} | ${vi} | ${note} |\n`;
            validRowsCount++;
          } else {
            invalidRowsCount++;
          }
        }

        if (validRowsCount > 0) {
          this.draftTable.set(result);
          this.isManuallyEdited.set(false);
          this.store.addGlossaryVersion(result, 'Tải lên từ Excel', 'manual');
          this.store.saveGlossaryConf(true);
          
          if (invalidRowsCount > 0) {
            this.toast.success(`Đã thêm ${validRowsCount} thuật ngữ thành công! Bỏ qua ${invalidRowsCount} dòng thiếu dữ liệu.`);
          } else {
            this.toast.success(`Đã tải lên và thêm ${validRowsCount} thuật ngữ thành công!`);
          }
        } else {
           if (invalidRowsCount > 0) {
             this.toast.error(`Không thêm được thuật ngữ nào. Có ${invalidRowsCount} dòng bị thiếu dữ liệu bắt buộc (Tiếng Anh, Từ loại, Tiếng Việt).`);
           } else {
             this.toast.error('Không tìm thấy thuật ngữ hợp lệ nào trong file.');
           }
        }

      } catch (err) {
        this.toast.error('Lỗi khi đọc file Excel: ' + String(err));
      } finally {
        if (this.fileInput?.nativeElement) {
          this.fileInput.nativeElement.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }
}
