import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <footer class="shrink-0 bg-white border-t border-zinc-200 py-2.5 px-6 text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-y-2">
      <div class="flex items-center space-x-3">
        <button (click)="!isDisabled() && openApiKeyModal.emit()" 
                [disabled]="isDisabled()"
                class="flex items-center font-medium transition-colors bg-transparent border-none py-1 px-1.5 cursor-pointer outline-none rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                [class.text-emerald-700]="hasUserApiKey() && !isDisabled()"
                [class.hover:text-emerald-800]="hasUserApiKey() && !isDisabled()"
                [class.hover:bg-emerald-50]="hasUserApiKey() && !isDisabled()"
                [class.text-zinc-600]="(!hasUserApiKey() && !isDisabled()) || isDisabled()"
                [class.hover:text-indigo-700]="!hasUserApiKey() && !isDisabled()"
                [class.hover:bg-zinc-50]="!hasUserApiKey() && !isDisabled()">
          <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mr-1.5 inline-flex items-center justify-center"
                    [class.text-emerald-500]="hasUserApiKey() && !isDisabled()"
                    [class.text-zinc-400]="isDisabled()"
                    [class.text-indigo-400]="!hasUserApiKey() && !isDisabled()">
            {{ hasUserApiKey() ? 'vpn_key' : 'vpn_key_off' }}
          </mat-icon>
          <span>{{ hasUserApiKey() ? 'Đang dùng Key của bạn' : 'Nhập API Key' }}</span>
        </button>

        <span class="text-zinc-200 hidden sm:inline">|</span>

        <button (click)="!isDisabled() && openRemixModal.emit()" [disabled]="isDisabled()" class="flex items-center font-medium text-zinc-600 hover:text-indigo-700 hover:bg-zinc-50 transition-colors bg-transparent border-none py-1 px-1.5 cursor-pointer outline-none rounded-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-zinc-600 disabled:hover:bg-transparent">
          <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mr-1.5 inline-flex items-center justify-center" [class.text-indigo-400]="!isDisabled()" [class.text-zinc-400]="isDisabled()">content_copy</mat-icon>
          <span>Cách remix app</span>
        </button>

        <span class="text-zinc-200 hidden sm:inline">|</span>

        <button (click)="!isDisabled() && openAppsModal.emit()" [disabled]="isDisabled()" class="flex items-center font-medium text-zinc-600 hover:text-indigo-700 hover:bg-zinc-50 transition-colors bg-transparent border-none py-1 px-1.5 cursor-pointer outline-none rounded-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-zinc-600 disabled:hover:bg-transparent">
          <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mr-1.5 inline-flex items-center justify-center" [class.text-indigo-400]="!isDisabled()" [class.text-zinc-400]="isDisabled()">apps</mat-icon>
          <span>Các ứng dụng khác</span>
        </button>
      </div>

      <div class="flex items-center flex-wrap justify-center gap-x-2 gap-y-1">
        <span class="font-medium text-zinc-600">v1.0.93</span>
        <span class="text-zinc-300">•</span>
        <a href="https://github.com/kiencang/silaBook" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600 transition-colors">GitHub</a>
        <span class="text-zinc-300">•</span>
        <span class="font-medium">Nguyễn Đức Anh</span>
        <span class="text-zinc-300">•</span>
        <span>contact&#64;wpsila.com</span>
        <span class="text-zinc-300">•</span>
        <a href="https://silabook-intro.wpsila.com/" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600 transition-colors">Hướng dẫn dùng</a>
        <span class="text-zinc-300">•</span>
        <a href="https://www.gutenberg.org/browse/scores/top#books-last100" target="_blank" rel="noopener noreferrer" class="hover:text-indigo-600 transition-colors">Gutenberg</a>
      </div>
    </footer>
  `
})
export class FooterComponent {
  isDisabled = input<boolean>(false);
  hasUserApiKey = signal<boolean>(false);
  openApiKeyModal = output<void>();
  openRemixModal = output<void>();
  openAppsModal = output<void>();

  constructor() {
    this.checkUserApiKey();
    if (typeof window !== 'undefined') {
      window.addEventListener('api-key-changed', () => {
        this.checkUserApiKey();
      });
    }
  }

  checkUserApiKey() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_gemini_api_key');
      this.hasUserApiKey.set(!!(saved && saved.trim() !== ''));
    }
  }
}
