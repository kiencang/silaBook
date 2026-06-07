import { Component, Output, EventEmitter, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-remix-modal',
  imports: [MatIconModule],
  template: `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900 animate-fade-in" tabindex="0" (click)="triggerClose()" (keydown.escape)="triggerClose()" [class.animate-fade-out]="isClosing()">
      <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in cursor-default" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosing()">
        <!-- Header -->
        <div class="p-6 border-b border-zinc-100 flex justify-between items-center bg-white">
          <div class="flex items-center space-x-2.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <mat-icon>content_copy</mat-icon>
            </div>
            <div>
              <h3 class="text-lg font-bold text-zinc-900 tracking-tight">Hướng dẫn Remix ứng dụng</h3>
            </div>
          </div>
          <button (click)="triggerClose()" class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-650 transition-colors rounded-lg hover:bg-zinc-100 cursor-pointer border-none bg-transparent focus:outline-none">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-6 space-y-5 overflow-y-auto bg-white">
          <p class="text-sm text-zinc-600 leading-relaxed">
            Chỉ ứng dụng dùng trên AI Studio mới dùng ngưỡng miễn phí thoải mái, bạn hãy remix app này về AI Studio để tận dụng ngưỡng Free từ Gemini. <a href="https://aistudio.google.com/apps/d25924ff-35f1-42f7-9543-f142ecfe037a?showAssistant=true&showPreview=true" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-750 font-medium hover:underline">Bạn vào app</a>, rồi remix như hình bên dưới:
          </p>
          
          <img src="/remix-silabook.png" alt="Hướng dẫn remix ứng dụng" class="w-full rounded-xl border border-zinc-200 shadow-sm" referrerpolicy="no-referrer" />
        </div>

        <!-- Actions -->
        <div class="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end items-center shrink-0">
          <button (click)="triggerClose()" 
                  class="px-5 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm cursor-pointer border-none">
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  `
})
export class RemixModalComponent {
  @Output() closeModal = new EventEmitter<void>();
  isClosing = signal(false);

  triggerClose() {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closeModal.emit();
    }, 200);
  }
}
