import { Component, Output, EventEmitter, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-apps-modal',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900 animate-fade-in" tabindex="0" (click)="triggerClose()" (keydown.escape)="triggerClose()" [class.animate-fade-out]="isClosing()">
      <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in cursor-default" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosing()">
        <!-- Header -->
        <div class="p-6 border-b border-zinc-100 flex justify-between items-center bg-white shrink-0">
          <div class="flex items-center space-x-2.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <mat-icon>apps</mat-icon>
            </div>
            <div>
              <h3 class="text-lg font-bold text-zinc-900 tracking-tight">Các ứng dụng dịch thuật từ Anh sang Việt tiện dùng khác</h3>
            </div>
          </div>
          <button (click)="triggerClose()" class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors rounded-full hover:bg-zinc-200 cursor-pointer border-none bg-transparent focus:outline-none">
            <mat-icon class="!text-[20px] !w-5 !h-5 !flex !items-center !justify-center">close</mat-icon>
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-6 space-y-4 overflow-y-auto bg-white flex-1">
          <p class="text-sm text-zinc-650 leading-relaxed mb-4">
            Ngoài dịch sách, chúng tôi còn cung cấp bộ giải pháp dịch thuật chuyên sâu bằng AI, miễn phí trên AI Studio. Hãy tham khảo ứng dụng bạn muốn sử dụng dưới đây:
          </p>
          
          <div class="grid grid-cols-1 gap-4">
            <!-- App 1: Dịch PDF chuyên ngành -->
            <a href="https://aistudio.google.com/apps/bb5c61b7-e110-49aa-933c-04c4ccd18e16?showPreview=true&showAssistant=true&fullscreenApplet=true" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="group flex items-start p-4 bg-zinc-50/50 hover:bg-zinc-50 border border-zinc-200 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all duration-250 text-left cursor-pointer no-underline">
              <div class="mr-4 p-3 rounded-xl shrink-0 flex items-center justify-center transition-all group-hover:scale-105 duration-200 bg-amber-50 text-amber-600 border border-amber-100">
                <mat-icon class="!text-[24px] !w-6 !h-6 !flex !items-center !justify-center">picture_as_pdf</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <h4 class="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">Dịch PDF ngắn chuyên ngành</h4>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-100/50">PDF</span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed">
                  Cố gắng bảo toàn định dạng gốc, giữ lại công thức toán học, tối ưu cho tài liệu học thuật dưới 30 trang.
                </p>
                <div class="mt-3 flex justify-end">
                  <div class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    Trải nghiệm ngay
                    <mat-icon class="!text-[14px] !w-[14px] !h-[14px] ml-1 transition-transform group-hover:translate-x-1 duration-200">arrow_forward</mat-icon>
                  </div>
                </div>
              </div>
            </a>

            <!-- App 2: Dịch phụ đề YouTube -->
            <a href="https://aistudio.google.com/apps/b98324ac-cdef-4887-961c-dbcc2c50a6c7?fullscreenApplet=true&showPreview=true&showAssistant=true" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="group flex items-start p-4 bg-zinc-50/50 hover:bg-zinc-50 border border-zinc-200 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all duration-250 text-left cursor-pointer no-underline">
              <div class="mr-4 p-3 rounded-xl shrink-0 flex items-center justify-center transition-all group-hover:scale-105 duration-200 bg-red-50 text-red-600 border border-red-100">
                <mat-icon class="!text-[24px] !w-6 !h-6 !flex !items-center !justify-center">smart_display</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <h4 class="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">Dịch phụ đề YouTube</h4>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50/80 px-2 py-0.5 rounded-md border border-red-100/50">YouTube</span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed">
                  Dịch phụ đề video YouTube chất lượng hơn, chế độ song ngữ, lịch sử dịch để tiện xem lại khi cần.
                </p>
                <div class="mt-3 flex justify-end">
                  <div class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    Trải nghiệm ngay
                    <mat-icon class="!text-[14px] !w-[14px] !h-[14px] ml-1 transition-transform group-hover:translate-x-1 duration-200">arrow_forward</mat-icon>
                  </div>
                </div>
              </div>
            </a>

            <!-- App 3: Dịch website -->
            <a href="https://aistudio.google.com/apps/4cc7e19e-46dd-4d38-8617-ba38ef1c80c3?fullscreenApplet=true&showPreview=true&showAssistant=true" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="group flex items-start p-4 bg-zinc-50/50 hover:bg-zinc-50 border border-zinc-200 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all duration-250 text-left cursor-pointer no-underline">
              <div class="mr-4 p-3 rounded-xl shrink-0 flex items-center justify-center transition-all group-hover:scale-105 duration-200 bg-blue-50 text-blue-600 border border-blue-100">
                <mat-icon class="!text-[24px] !w-6 !h-6 !flex !items-center !justify-center">language</mat-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <h4 class="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">Dịch website</h4>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100/50">Trang Web</span>
                </div>
                <p class="text-xs text-zinc-500 leading-relaxed">
                  Dịch website chất lượng hơn & tối ưu cho việc đọc hiểu tài liệu.
                </p>
                <div class="mt-3 flex justify-end">
                  <div class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    Trải nghiệm ngay
                    <mat-icon class="!text-[14px] !w-[14px] !h-[14px] ml-1 transition-transform group-hover:translate-x-1 duration-200">arrow_forward</mat-icon>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end items-center shrink-0">
          <button (click)="triggerClose()" 
                  class="px-5 py-2 bg-zinc-200 text-zinc-700 font-medium hover:bg-zinc-300 rounded-lg transition-all focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 text-sm cursor-pointer border-none">
            Đóng
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AppsModalComponent {
  @Output() closeModal = new EventEmitter<void>();
  isClosing = signal(false);

  triggerClose() {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closeModal.emit();
    }, 200);
  }
}
