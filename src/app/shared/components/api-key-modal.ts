import { Component, Output, EventEmitter, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/toast.service';
import { getSecureApiKey, saveSecureApiKey, removeSecureApiKey, hasSecureApiKey } from '../../core/crypto-storage.util';

@Component({
  selector: 'app-api-key-modal',
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900 animate-fade-in" tabindex="0" (click)="triggerClose()" (keydown.escape)="triggerClose()" [class.animate-fade-out]="isClosing()">
      <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in cursor-default" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosing()">
        <!-- Header -->
        <div class="p-6 border-b border-zinc-100 flex justify-between items-center bg-white">
          <div class="flex items-center space-x-2.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <mat-icon>vpn_key</mat-icon>
            </div>
            <div>
              <h3 class="text-lg font-bold text-zinc-900 tracking-tight">Cấu hình Gemini API Key</h3>
            </div>
          </div>
          <button (click)="triggerClose()" class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors rounded-full hover:bg-zinc-200 cursor-pointer border-none bg-transparent focus:outline-none">
            <mat-icon class="!text-[20px] !w-5 !h-5 !flex !items-center !justify-center">close</mat-icon>
          </button>
        </div>
        
        <!-- Content -->
        <div class="p-6 space-y-5 overflow-y-auto bg-white">
          <p class="text-sm text-zinc-600 leading-relaxed">
            Để sử dụng công cụ dịch sách này bạn cần khóa API Key của Gemini. Bạn hãy vào link "Nơi lấy API Key Gemini" để thao tác. Key miễn phí chỉ có hiệu lực nếu bạn dùng <a href="https://aistudio.google.com/apps/d25924ff-35f1-42f7-9543-f142ecfe037a?showAssistant=true&showPreview=true" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-750 hover:underline">ứng dụng qua AI Studio</a>, với ai dùng trên silabook.wpsila.com, chỉ Key trả phí mới dùng được. Hãy remix ứng dụng trên AI Studio để dùng miễn phí.
          </p>

          <!-- Status badge/links -->
          <div class="flex items-center space-x-2.5 text-xs text-zinc-500 bg-zinc-50 border border-zinc-100 p-2.5 rounded-xl">
            @if (hasSavedKey()) {
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                Đang dùng API Key của bạn
              </span>
            } @else {
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-750 border border-indigo-100">
                Bạn chưa nhập API Key cho ứng dụng
              </span>
            }
            <span class="text-zinc-350">|</span>
            <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-750 font-bold hover:underline flex items-center cursor-pointer no-underline">
              <mat-icon class="!text-[14px] !w-3.5 !h-3.5 mr-1 text-indigo-500">help_outline</mat-icon>Nơi lấy API Key Gemini
            </a>
          </div>

          <div class="space-y-1.5">
            <label for="geminiApiKey" class="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
              GEMINI API KEY CÁ NHÂN
            </label>
            <div class="relative flex items-center">
              <input id="geminiApiKey" 
                     [type]="showKey() ? 'text' : 'password'" 
                     [ngModel]="apiKey()"
                     (ngModelChange)="apiKey.set($event)" 
                     placeholder="AIzaSy..." 
                     (keydown.enter)="saveKey()"
                     class="w-full pl-4 pr-11 py-2.5 border border-zinc-305 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm tracking-wide font-mono transition-shadow outline-none text-zinc-800 bg-zinc-50 focus:bg-white">
              <button (click)="toggleShowKey()" 
                      type="button"
                      class="absolute right-3 text-zinc-450 hover:text-zinc-650 transition-colors p-1 rounded-md focus:outline-none flex items-center justify-center border-none bg-transparent cursor-pointer">
                <mat-icon class="text-[20px]">{{ showKey() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
            <p class="text-[11px] text-zinc-450 leading-relaxed">
              Khóa API của bạn được lưu <em class="not-italic font-semibold text-zinc-600">cục bộ tuyệt đối</em> trong trình duyệt của bạn (<code class="bg-zinc-100 px-1 py-0.5 rounded text-zinc-700">LocalStorage</code>), không bao giờ gửi lên bất kỳ máy chủ nào khác.
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center shrink-0">
          <div>
            @if (hasSavedKey()) {
              <button (click)="deleteKey()" 
                      class="px-3.5 py-1.5 bg-white border border-red-200 text-red-600 font-medium hover:bg-red-50 hover:border-red-300 rounded-lg transition-all shadow-sm focus:ring-2 focus:ring-red-100 focus:outline-none text-xs cursor-pointer">
                Xóa Key cá nhân
              </button>
            }
          </div>
          <div class="flex space-x-2">
            <button (click)="triggerClose()" 
                    class="px-4 py-1.5 bg-white border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-100 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-zinc-200 focus:outline-none text-xs cursor-pointer">
              Hủy
            </button>
            <button (click)="saveKey()" 
                    [disabled]="!apiKey().trim()"
                    [class.opacity-50]="!apiKey().trim()"
                    [class.cursor-not-allowed]="!apiKey().trim()"
                    class="px-4 py-1.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-xs cursor-pointer border-none">
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ApiKeyModal {
  @Output() closeModal = new EventEmitter<void>();
  private toast = inject(ToastService);
  
  isClosing = signal(false);
  showKey = signal(false);
  apiKey = signal('');
  hasSavedKey = signal(false);

  constructor() {
    this.checkSavedKey();
  }

  async checkSavedKey() {
    if (typeof window !== 'undefined') {
      const hasKey = await hasSecureApiKey();
      this.hasSavedKey.set(hasKey);
      if (hasKey) {
        const saved = await getSecureApiKey();
        this.apiKey.set(saved || '');
      } else {
        this.apiKey.set('');
      }
    }
  }

  toggleShowKey() {
    this.showKey.update(v => !v);
  }

  triggerClose() {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closeModal.emit();
    }, 200);
  }

  async saveKey() {
    const trimmed = this.apiKey().trim();
    if (!trimmed) return;
    
    if (!/^[a-zA-Z0-9_\-.]+$/.test(trimmed)) {
      this.toast.error('API Key không hợp lệ. Hãy đảm bảo bạn không dán nhầm chữ tiếng Việt có dấu, khoảng trắng hay ký tự đặc biệt.');
      return;
    }

    if (typeof window !== 'undefined') {
      const success = await saveSecureApiKey(trimmed);
      if (success) {
        window.dispatchEvent(new Event('api-key-changed'));
        this.toast.success('Đã lưu cấu hình API Key cá nhân thành công!');
      } else {
        this.toast.error('Lỗi khi lưu API Key bảo mật.');
      }
    }
    this.triggerClose();
  }

  async deleteKey() {
    if (typeof window !== 'undefined') {
      await removeSecureApiKey();
      window.dispatchEvent(new Event('api-key-changed'));
      this.toast.success('Xóa API Key cá nhân thành công.');
    }
    this.triggerClose();
  }
}
