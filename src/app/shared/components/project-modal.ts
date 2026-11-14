import { Component, inject, signal, computed, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { DbService, Project } from '../../core/db';
import { BookStore } from '../../core/book.store';
import { ToastService } from '../../core/toast.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 cursor-pointer animate-fade-in" tabindex="0" (click)="triggerClose()" (keydown.escape)="triggerClose()" [class.animate-fade-out]="isClosing()">
      <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-zoom-in" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosing()">
        <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/80">
          <h2 class="text-xl font-bold text-zinc-900">Quản lý dự án</h2>
          <div class="flex items-center gap-2">
            <button (click)="toggleSort()" class="group relative text-sm px-2 py-1.5 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-lg font-medium transition-colors flex items-center justify-center">
              <span class="material-icons text-[18px]">{{ sortBy() === 'time' ? 'schedule' : 'sort_by_alpha' }}</span>
              <div class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                {{ sortBy() === 'time' ? 'Đang sắp xếp theo thời gian' : 'Đang sắp xếp theo tên (A-Z)' }}
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></div>
              </div>
            </button>
            <button (click)="fileInput.click()" class="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors flex items-center gap-1">
              <span class="material-icons text-[18px]">file_upload</span> Nhập dự án
            </button>
            <input #fileInput type="file" accept=".zip,.json" class="hidden" (change)="importProject($event)" />
            <button (click)="triggerClose()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center">
              <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
            </button>
          </div>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1 bg-white">
          @if (isLoading()) {
            <div class="flex justify-center items-center h-32">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          } @else if (sortedProjects().length === 0) {
            <div class="text-center py-12">
              <div class="bg-zinc-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span class="material-icons text-zinc-400 text-3xl">folder_open</span>
              </div>
              <h3 class="text-lg font-medium text-zinc-900 mb-1">Chưa có dự án nào</h3>
              <p class="text-zinc-500">Hãy tạo dự án mới để bắt đầu dịch sách.</p>
              
              <button (click)="closeAndGoHome()" class="mt-6 text-indigo-600 font-medium hover:text-indigo-700 underline underline-offset-2">
                Quay lại trang chủ tạo dự án
              </button>
            </div>
          } @else {
            <div class="grid gap-4">
              @for (p of sortedProjects(); track p.id; let isFirst = $first) {
                <div class="border border-zinc-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col gap-4 bg-white relative"
                     [class.ring-2]="store.currentProjectId() === p.id" [class.ring-indigo-500]="store.currentProjectId() === p.id">
                  
                  @if (store.currentProjectId() === p.id) {
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl"></div>
                    <div class="absolute left-1 top-0 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-b-md shadow-sm z-10">
                      Đang mở
                    </div>
                  }
                  
                  <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full">
                    <div class="flex-1 cursor-pointer min-w-0" [class.mt-2]="store.currentProjectId() === p.id" role="button" tabindex="0" (keydown.enter)="loadProject(p.id)" (click)="loadProject(p.id)">
                      <div class="flex items-start justify-between gap-3">
                        <h3 class="font-bold text-base text-zinc-900 mb-1 line-clamp-2" [title]="p.name">
                          {{p.name}}
                        </h3>
                      </div>
                      <div class="flex flex-col gap-2 w-full mt-2">
                        <div class="flex flex-wrap items-center text-sm text-zinc-500 gap-x-4 gap-y-2">
                          <span class="group/created relative flex items-center">
                            <span class="material-icons text-[16px] mr-1 opacity-70">add_circle_outline</span> {{p.createdAt | date:'dd/MM/yy HH:mm'}}
                            <span class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-max opacity-0 transition-opacity duration-150 group-hover/created:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                              Ngày tạo ban đầu.
                              <span class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></span>
                            </span>
                          </span>
                          @if (p.importedAt) {
                            <span class="group/imported relative flex items-center text-indigo-600 font-medium">
                              <span class="material-icons text-[16px] mr-1">publish</span> {{p.importedAt | date:'dd/MM/yy HH:mm'}}
                              <span class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-max opacity-0 transition-opacity duration-150 group-hover/imported:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                                Ngày nhập vào máy.
                                <span class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></span>
                              </span>
                            </span>
                          }
                        </div>
                        <div class="flex flex-wrap items-center text-sm text-zinc-500 gap-x-4 gap-y-2">
                          <span class="flex items-center">
                            <span class="w-2 h-2 rounded-full mr-1.5" 
                                  [class.bg-zinc-400]="p.phase === 1"
                                  [class.bg-yellow-400]="p.phase === 2"
                                  [class.bg-purple-500]="p.phase === 3"
                                  [class.bg-indigo-500]="p.phase === 4"
                                  [class.bg-green-500]="p.phase === 5"></span>
                            Giai đoạn {{p.phase}}: 
                            {{p.phase === 1 ? 'Tải lên' : (p.phase === 2 ? 'Chia chương' : (p.phase === 3 ? 'Đại từ' : (p.phase === 4 ? 'Từ khó' : 'Dịch thuật')))}}
                          </span>
                          @if (p.pdfTaskMeta) {
                             <span class="flex items-center text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium border border-orange-100 uppercase tracking-wide">
                               <span class="material-icons !text-[14px] !w-3.5 !h-3.5 mr-1 leading-none flex items-center justify-center">warning</span> {{ p.pdfTaskMeta.chunkCount > 0 ? 'Gián đoạn PDF' : 'PDF' }}
                             </span>
                          }
                        </div>
                        @if (getProgress(p); as prog) {
                          <div class="w-full sm:w-2/3 max-w-sm mt-1 mb-1 flex items-center gap-3">
                            <div class="flex-1 overflow-hidden h-1.5 bg-zinc-200 rounded-full">
                              <div class="h-full rounded-full transition-all duration-300" [class]="prog.barColorClass" [style.width.%]="prog.percentage"></div>
                            </div>
                            <span class="text-xs font-bold min-w-[2.5rem] text-right" [class]="prog.textColorClass">{{prog.percentage}}%</span>
                          </div>
                        }
                      </div>
                    </div>
                    
                    <div class="flex sm:flex-col gap-2 min-w-[120px] sm:min-w-[150px] justify-center">
                      @if (confirmingDeleteId() === p.id) {
                        <div class="flex flex-col gap-3 p-3 bg-red-50 rounded-xl border border-red-100 w-full animate-in fade-in duration-200">
                          <span class="text-xs text-red-700 font-semibold text-center">Xóa dự án này?</span>
                          <div class="flex gap-3.5">
                            <button (click)="deleteProject(p.id, $event)" class="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors text-center shadow-sm cursor-pointer">
                              Có
                            </button>
                            <button (click)="cancelDelete($event)" class="flex-1 py-2 px-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg text-sm font-semibold transition-colors text-center shadow-sm cursor-pointer">
                              Không
                            </button>
                          </div>
                        </div>
                      } @else {
                        <button (click)="exportProjectData(p, $event)" class="group/export relative px-4 py-2 w-full bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors border border-purple-200 shadow-sm text-center flex items-center justify-center gap-1.5">
                          <span class="material-icons text-[18px]">save_alt</span> Xuất dự án
                          <div class="pointer-events-none font-normal normal-case absolute right-0 w-max max-w-[calc(100vw-4rem)] sm:max-w-md opacity-0 transition-opacity duration-150 group-hover/export:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs leading-relaxed rounded-lg py-2 px-3 shadow-lg text-left"
                               [class.top-full]="isFirst"
                               [class.mt-2]="isFirst"
                               [class.bottom-full]="!isFirst"
                               [class.mb-2]="!isFirst">
                            Xuất toàn bộ dữ liệu dự án (định dạng ZIP).<br>Cho mục đích lưu trữ hoặc nhập vào thiết bị khác dịch tiếp.
                            <div class="absolute right-6 border-4 border-transparent"
                                 [class.bottom-full]="isFirst"
                                 [class.border-b-zinc-900]="isFirst"
                                 [class.top-full]="!isFirst"
                                 [class.border-t-zinc-900]="!isFirst"></div>
                          </div>
                        </button>
                        <button (click)="loadProject(p.id)" class="px-4 py-2 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors border border-indigo-200 shadow-sm text-center flex items-center justify-center gap-1.5">
                          <span class="material-icons text-[18px]">folder_open</span> Mở dự án
                        </button>
                        <button (click)="initiateDelete(p.id, $event)" class="px-4 py-2 w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors border border-red-200 shadow-sm text-center flex items-center justify-center gap-1.5">
                          <span class="material-icons text-[18px]">delete</span> Xóa dự án
                        </button>
                      }
                    </div>
                  </div>

                  @if (getProgress(p)?.percentage === 100) {
                    <div class="flex flex-wrap items-center gap-2 mt-1 pt-3 border-t border-dashed border-zinc-200" tabindex="0" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                      <span class="text-xs font-medium text-zinc-500 mr-1">Download</span>
                      <button (click)="exportProjectToEpub(p, $event)" class="group/epub relative px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold transition-colors border border-indigo-200 shadow-sm flex items-center gap-1">
                        <span class="material-icons text-[13px]">menu_book</span>EPUB
                        <div class="pointer-events-none font-normal normal-case absolute top-full left-0 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/epub:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                          Tải về định dạng sách điện tử EPUB.
                          <div class="absolute bottom-full left-5 border-4 border-transparent border-b-zinc-900"></div>
                        </div>
                      </button>
                      <button (click)="exportProjectToDocx(p, $event)" class="group/docx relative px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold transition-colors border border-blue-200 shadow-sm flex items-center gap-1">
                        <span class="material-icons text-[13px]">description</span>DOCX
                        <div class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/docx:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                          Tải về định dạng Word (DOCX).
                          <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></div>
                        </div>
                      </button>
                      <button (click)="exportProjectToPdf(p, $event)" class="group/pdf relative px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold transition-colors border border-rose-200 shadow-sm flex items-center gap-1">
                        <span class="material-icons text-[13px]">picture_as_pdf</span>PDF
                        <div class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/pdf:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                          Tải về định dạng PDF.
                          <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></div>
                        </div>
                      </button>
                      <button (click)="exportProjectToHtml(p, $event)" class="group/html relative px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-semibold transition-colors border border-green-200 shadow-sm flex items-center gap-1">
                        <span class="material-icons text-[13px]">html</span>HTML
                        <div class="pointer-events-none font-normal normal-case absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/html:opacity-100 z-[100] bg-zinc-900 text-zinc-100 text-xs rounded-lg py-1.5 px-2.5 shadow-lg text-center whitespace-nowrap">
                          Tải về định dạng trang web HTML (tối ưu cho khả năng đọc).
                          <div class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900"></div>
                        </div>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class ProjectModal implements OnInit, OnDestroy {
  db = inject(DbService);
  store = inject(BookStore);
  toast = inject(ToastService);
  
  projects = signal<Project[]>([]);
  sortBy = signal<'time' | 'name'>('time');
  sortedProjects = computed(() => {
    const list = [...this.projects()];
    const activeId = this.store.currentProjectId();
    list.sort((a, b) => {
      if (activeId) {
        if (a.id === activeId) return -1;
        if (b.id === activeId) return 1;
      }
      if (this.sortBy() === 'time') {
        return (b.importedAt ?? b.createdAt) - (a.importedAt ?? a.createdAt);
      } else {
        return a.name.localeCompare(b.name);
      }
    });
    return list;
  });
  isLoading = signal(true);
  confirmingDeleteId = signal<string | null>(null);
  isClosing = signal(false);
  
  @Output() closeModal = new EventEmitter<void>();

  private projectWorker = new Worker(new URL('./project.worker', import.meta.url), { type: 'module' });
  private workerId = 0;

  ngOnDestroy() {
    if (this.projectWorker) {
      this.projectWorker.terminate();
    }
  }

  private runProjectWorkerTask(type: string, payload: unknown): Promise<{ jsonStr?: string; project?: Project; error?: string; [key: string]: unknown }> {
    return new Promise((resolve, reject) => {
      const id = ++this.workerId;
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          this.projectWorker.removeEventListener('message', handler);
          if (event.data.type === 'SUCCESS') {
            resolve(event.data.payload);
          } else {
            reject(new Error(event.data.payload.error));
          }
        }
      };
      this.projectWorker.addEventListener('message', handler);
      this.projectWorker.postMessage({ type, payload, id });
    });
  }

  triggerClose() {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closeModal.emit();
    }, 200); // 200ms matches the animation duration
  }

  toggleSort() {
    this.sortBy.set(this.sortBy() === 'time' ? 'name' : 'time');
  }

  ngOnInit() {
    this.loadProjects();
  }

  async loadProjects() {
    this.isLoading.set(true);
    const list = await this.db.getAllProjects();
    this.projects.set(list);
    this.isLoading.set(false);
  }

  async loadProject(id: string) {
    if (this.store.currentProjectId() !== id) {
      this.triggerClose(); // Close UI with animation
      await this.store.loadProject(id);
    } else {
      this.triggerClose();
    }
  }

  initiateDelete(id: string, event: Event) {
    event.stopPropagation();
    this.confirmingDeleteId.set(id);
  }

  cancelDelete(event: Event) {
    event.stopPropagation();
    this.confirmingDeleteId.set(null);
  }

  async exportProjectToPdf(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    this.store.exportProjectToPdf(fullProject);
  }

  async exportProjectToHtml(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    this.store.exportProjectToHtml(fullProject);
  }

  async exportProjectToEpub(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    this.store.exportProjectToEpub(fullProject);
  }

  async exportProjectToDocx(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    this.store.exportProjectToDocx(fullProject);
  }

  async exportProjectData(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    
    this.toast.info('Đang chuẩn bị dữ liệu xuất bản... Xin vui lòng chờ');
    
    const baseFileName = `silaBook_Project_${p.name.replace(/\s+/g, '_')}_${p.id}`;
    let blob: Blob;
    try {
      const result = await this.runProjectWorkerTask('EXPORT_PROJECT', fullProject);
      const dataStr = result.jsonStr || '';
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file(`${baseFileName}.json`, dataStr);
      blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    } catch (e: unknown) {
      this.toast.error('Lỗi khi xuất dữ liệu: ' + (e instanceof Error ? e.message : 'Unknown error'));
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFileName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toast.success(this.toast.Messages.PROJECT_BACKUP_SUCCESS);
  }

  private decompressZipEntrySafely(jsonEntry: unknown, maxBytes: number): Promise<string> {
    const streamable = jsonEntry as {
      _data?: { uncompressedSize?: number };
      internalStream?: (type: 'uint8array') => {
        on(event: 'data', cb: (chunk: Uint8Array) => void): unknown;
        on(event: 'end', cb: () => void): unknown;
        on(event: 'error', cb: (err: Error) => void): unknown;
        pause(): void;
        resume(): void;
      };
      async: (type: 'string') => Promise<string>;
    };

    const declaredSize = streamable._data?.uncompressedSize;
    if (typeof declaredSize === 'number' && (declaredSize > maxBytes || declaredSize < 0)) {
      return Promise.reject(new Error('ZIP_SIZE_LIMIT_EXCEEDED'));
    }

    if (typeof streamable.internalStream !== 'function') {
      return streamable.async('string');
    }

    return new Promise<string>((resolve, reject) => {
      const stream = streamable.internalStream!('uint8array');
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let aborted = false;

      stream.on('data', (chunk: Uint8Array) => {
        if (aborted) return;
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          aborted = true;
          stream.pause();
          reject(new Error('ZIP_SIZE_LIMIT_EXCEEDED'));
          return;
        }
        chunks.push(chunk);
      });

      stream.on('end', () => {
        if (aborted) return;
        try {
          let merged: Uint8Array;
          if (chunks.length === 1) {
            merged = chunks[0];
          } else {
            merged = new Uint8Array(totalBytes);
            let offset = 0;
            for (const c of chunks) {
              merged.set(c, offset);
              offset += c.byteLength;
            }
          }
          const decoded = new TextDecoder('utf-8').decode(merged);
          resolve(decoded);
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', (err: Error) => {
        if (aborted) return;
        aborted = true;
        reject(err);
      });

      stream.resume();
    });
  }

  private isValidImportedProject(proj: unknown): proj is Project {
    if (!proj || typeof proj !== 'object' || Array.isArray(proj)) {
      return false;
    }

    const p = proj as Record<string, unknown>;

    if (typeof p['id'] !== 'string' || p['id'].trim().length === 0) {
      return false;
    }
    if (typeof p['name'] !== 'string' || p['name'].trim().length === 0) {
      return false;
    }

    const hasSilaSignature =
      'phase' in p || 'chapters' in p || 'rawMarkdown' in p || 'config' in p;
    if (!hasSilaSignature) {
      return false;
    }

    if (p['chapters'] !== undefined && p['chapters'] !== null) {
      if (!Array.isArray(p['chapters'])) {
        return false;
      }
      for (const ch of p['chapters']) {
        if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
          return false;
        }
        const chapterObj = ch as Record<string, unknown>;
        if (
          typeof chapterObj['title'] !== 'string' ||
          typeof chapterObj['originalText'] !== 'string'
        ) {
          return false;
        }
      }
    }

    if (p['images'] !== undefined && p['images'] !== null) {
      if (typeof p['images'] !== 'object' || Array.isArray(p['images'])) {
        return false;
      }
      for (const val of Object.values(p['images'] as Record<string, unknown>)) {
        if (typeof val !== 'string') {
          return false;
        }
      }
    }

    return true;
  }

  async importProject(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const MAX_ZIP_FILE_SIZE = 150 * 1024 * 1024; // 150 MB
    const MAX_JSON_SIZE = 250 * 1024 * 1024; // 250 MB
    const MAX_ZIP_ENTRIES = 10;
    
    try {
      const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
      if (isZip && file.size > MAX_ZIP_FILE_SIZE) {
        this.toast.error('File dự án (.zip) vượt quá giới hạn dung lượng an toàn (tối đa 150MB)!');
        return;
      }
      if (!isZip && file.size > MAX_JSON_SIZE) {
        this.toast.error('File dự án (.json) vượt quá giới hạn dung lượng an toàn (tối đa 250MB)!');
        return;
      }

      this.toast.info('Đang nhập dữ liệu... Xin vui lòng chờ');
      let text = '';
      if (isZip) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files);
        if (entries.length > MAX_ZIP_ENTRIES) {
          this.toast.error('File nén chứa quá nhiều tập tin bất thường, đã chặn để bảo vệ bộ nhớ!');
          return;
        }
        const realFiles = entries.filter(entry => {
          if (entry.dir) return false;
          const normalizedName = entry.name.replace(/\\/g, '/');
          const baseName = normalizedName.split('/').pop() || '';
          if (
            normalizedName.includes('__MACOSX/') ||
            baseName === '.DS_Store' ||
            baseName.startsWith('._')
          ) {
            return false;
          }
          return true;
        });
        if (realFiles.length !== 1 || !realFiles[0].name.toLowerCase().endsWith('.json')) {
          this.toast.error(this.toast.Messages.PROJECT_IMPORT_DRAFT_ERROR);
          return;
        }
        const jsonEntry = realFiles[0];
        try {
          text = await this.decompressZipEntrySafely(jsonEntry, MAX_JSON_SIZE);
        } catch (zipErr: unknown) {
          if (zipErr instanceof Error && zipErr.message === 'ZIP_SIZE_LIMIT_EXCEEDED') {
            this.toast.error('Dữ liệu giải nén vượt quá giới hạn dung lượng an toàn (tối đa 250MB)!');
            return;
          }
          throw zipErr;
        }
      } else {
        text = await file.text();
      }
      
      const result = await this.runProjectWorkerTask('IMPORT_PROJECT', { text });
      const proj = result.project;
      
      if (!this.isValidImportedProject(proj)) {
        this.toast.error(this.toast.Messages.PROJECT_IMPORT_DRAFT_ERROR);
        return;
      }
      
      // Always generate a new unique ID for imported projects to prevent ANY collision
      // since users might import a project they already have, or deleted and re-imported.
      const newProjectId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const existingIds = this.projects().map(p => p.id);
      
      if (existingIds.includes(proj.id)) {
        proj.name = `${proj.name} (Imported)`;
      }
      proj.id = newProjectId;
      
      // We MUST assign new unique IDs to the imported chapters, because IndexedDB uses `id` as the primary key.
      // If we don't, importing the same project again will overwrite the old project's chapters in the DB!
      if (proj.chapters) {
        proj.chapters = proj.chapters.map((c, idx) => ({
          ...c,
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9) + idx
        }));
      }
      
      proj.updatedAt = Date.now();
      proj.importedAt = Date.now();
      
      await this.db.saveProject(proj);
      this.toast.success(this.toast.Messages.PROJECT_IMPORT_SUCCESS);
      await this.loadProject(proj.id);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(this.toast.Messages.PROJECT_IMPORT_ERROR);
    } finally {
      input.value = ''; // Reset the input
    }
  }

  async deleteProject(id: string, event: Event) {
    event.stopPropagation();
    const deletedName = this.projects().find(p => p.id === id)?.name || '';
    if (this.store.currentProjectId() === id) {
       this.store.closeProject();
    }
    await this.db.deleteProject(id);
    this.toast.success(this.toast.Messages.PROJECT_DELETE_SUCCESS(deletedName));
    this.confirmingDeleteId.set(null);
    await this.loadProjects();
  }
  
  closeAndGoHome() {
    this.store.closeProject();
    this.triggerClose();
  }

  getProgress(p: Project) {
    if (p.phase < 3) return null;
    let total = p.totalWords || 0;
    let translated = p.translatedWords || 0;

    if (p.chapters && p.chapters.length > 0) {
      total = 0;
      translated = 0;
      for (const c of p.chapters) {
        total += c.wordCount || 0;
        if (c.status === 'done') {
          translated += c.wordCount || 0;
        }
      }
    }

    if (total === 0) return null;
    const percentage = Math.round((translated / total) * 100);
    
    let barColorClass = 'bg-indigo-500';
    let textColorClass = 'text-indigo-600';
    if (percentage === 100) {
      barColorClass = 'bg-green-500';
      textColorClass = 'text-green-600';
    } else if (percentage === 0) {
      textColorClass = 'text-zinc-500';
    }

    return { percentage, barColorClass, textColorClass, translated, total };
  }
}
