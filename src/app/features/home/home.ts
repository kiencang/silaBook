import { Component, inject, signal } from '@angular/core';
import { BookStore } from '../../core/book.store';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/toast.service';
import { hasSecureApiKey } from '../../core/crypto-storage.util';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  host: {
    class: 'flex-1 flex flex-col'
  },
  template: `
    <div class="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div class="w-full max-w-2xl p-8 bg-white rounded-2xl shadow-sm border border-zinc-100">
        <div class="text-center mb-5">
        <h2 class="text-3xl font-bold text-zinc-900 tracking-tight">Tạo dự án dịch mới</h2>
        <p class="text-zinc-500 mt-3 text-lg">Bắt đầu bằng cách nhập thông tin cho dự án sách của bạn.</p>
      </div>
      
      <div class="space-y-4">
        <div>
          <label for="bookTitle" class="block text-sm font-medium text-zinc-700 mb-1">Tên tác phẩm <span class="text-red-500">*</span></label>
          <div class="relative group">
            <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 !w-5 !h-5 !text-[20px] text-zinc-400 group-focus-within:text-indigo-600 transition-colors">menu_book</mat-icon>
            <input id="bookTitle" type="text" [(ngModel)]="bookTitle" placeholder="Ví dụ: Moby Dick" 
                   (keydown.enter)="canCreate() && createProject()"
                   class="w-full pl-11 pr-4 py-3 border border-zinc-300 rounded-xl focus:ring-0 focus:border-indigo-600 focus:border-2 outline-none text-lg transition-all">
          </div>
        </div>
        <div>
          <label for="author" class="block text-sm font-medium text-zinc-700 mb-1">Tác giả <span class="text-red-500">*</span></label>
          <div class="relative group">
            <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 !w-5 !h-5 !text-[20px] text-zinc-400 group-focus-within:text-indigo-600 transition-colors">person</mat-icon>
            <input id="author" type="text" [(ngModel)]="author" placeholder="Ví dụ: Herman Melville (hoặc Vô danh)" 
                   (keydown.enter)="canCreate() && createProject()"
                   class="w-full pl-11 pr-4 py-3 border border-zinc-300 rounded-xl focus:ring-0 focus:border-indigo-600 focus:border-2 outline-none text-lg transition-all">
          </div>
        </div>
        
        <div class="pt-2">
          <button [disabled]="!canCreate()" (click)="createProject()" 
                  class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm text-lg">
            Tạo dự án & Bắt đầu
          </button>
        </div>
      </div>
      </div>

      <button (click)="showVideo.set(true)" class="mt-6 flex items-center gap-2 text-zinc-500 bg-transparent border border-zinc-200 hover:border-zinc-300 hover:text-indigo-600 transition-all rounded-full px-4 py-2 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <mat-icon class="!w-5 !h-5 !text-[20px]">play_circle</mat-icon>
        <span class="text-sm font-medium">Xem video cách dùng</span>
      </button>
    </div>

    @if (showVideo()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4" (click)="showVideo.set(false)">
        <div class="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10" (click)="$event.stopPropagation()">
          <button (click)="showVideo.set(false)" class="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
            <mat-icon class="!w-6 !h-6 !text-[24px]">close</mat-icon>
          </button>
          <iframe class="w-full h-full" src="https://www.youtube.com/embed/HetHC9r68dk?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
    }
  `
})
export class Home {
  store = inject(BookStore);
  toast = inject(ToastService);
  bookTitle = signal('');
  author = signal('');
  showVideo = signal(false);

  canCreate() {
    return this.bookTitle().trim().length > 0 && this.author().trim().length > 0;
  }

  async createProject() {
    if (this.canCreate()) {
      const title = this.bookTitle().trim().replace(/\s+/g, ' ');
      const author = this.author().trim().replace(/\s+/g, ' ');
      const projectName = author ? `${title} - ${author}` : title;
      
      if (typeof window !== 'undefined') {
        const hasKey = await hasSecureApiKey();
        if (!hasKey) {
          this.toast.error('Bạn cần nhập API Key để dịch, nó là button nằm bên trái ở chân trang.');
        }
      }

      this.store.createNewProject(projectName, title, author);
    }
  }
}
