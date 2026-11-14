import { Component, inject, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BookStore } from '../../../core/book.store';

@Component({
  selector: 'app-token-estimation',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 mb-8">
      <button 
        (click)="isExpanded.set(!isExpanded())" 
        class="w-full flex items-center justify-between outline-none group text-left"
      >
          <h3 class="text-sm font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-2 group-hover:text-indigo-700 transition-colors">
            <mat-icon class="!w-5 !h-5 !text-[20px] flex items-center justify-center">analytics</mat-icon>
            <span class="mt-0.5">Ước tính từ vựng & Token</span>
          </h3>
          <mat-icon class="text-indigo-500 transition-transform duration-300" [class.rotate-180]="isExpanded()">expand_more</mat-icon>
      </button>
      
      @if (isExpanded()) {
        <div class="mt-4 pt-4 border-t border-indigo-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div class="grid grid-cols-3 gap-4 text-sm mb-3">
              <div class="font-medium text-zinc-400 pb-2 border-b border-indigo-100"></div>
              <div class="font-semibold text-zinc-800 pb-2 border-b border-indigo-100 flex items-center gap-2">Tiếng Anh</div>
              <div class="font-semibold text-zinc-800 pb-2 border-b border-indigo-100 flex items-center gap-2">Tiếng Việt</div>
              
              <div class="font-medium text-zinc-600 py-1">Số từ ước tính</div>
              <div class="font-bold text-zinc-900 py-1">{{ formatNumber(store.estimatedEnglishWords()) }}</div>
              <div class="font-bold text-zinc-900 py-1">{{ formatNumber(store.estimatedVietnameseWords()) }}</div>
              
              <div class="font-medium text-zinc-600 py-1">Token ước tính</div>
              <div class="font-bold text-indigo-700 py-1">{{ formatNumber(store.estimatedEnglishTokens()) }}</div>
              <div class="font-bold text-indigo-700 py-1">{{ formatNumber(store.estimatedVietnameseTokens()) }}</div>
          </div>
          <div class="text-[11px] text-indigo-500 italic mt-2">* Đây là dự đoán, con số thực tế có thể cao hoặc thấp hơn.</div>
          @if (hasGutenbergSkipped()) {
            <div class="text-[11px] text-zinc-500 italic mt-1">Đã loại bỏ phần thông tin bản quyền Gutenberg khỏi tính toán, do phần này được giữ nguyên, không cần dịch.</div>
          }
          <div class="mt-3 pt-3 border-t border-indigo-100 text-xs text-zinc-600 leading-relaxed space-y-2">
            <p>
              Các con số trên là chỉ tính riêng cho cuốn sách. Nếu bạn áp dụng tất cả các bước, bao gồm <code class="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-800 font-mono text-[11px]">Đại từ</code>, <code class="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-800 font-mono text-[11px]">Từ khó</code> và <code class="px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-800 font-mono text-[11px]">Tạo bản tóm tắt cho khối dịch kế tiếp</code> thì tổng lượng token input/output thực tế được dùng sẽ cao hơn đáng kể.
            </p>
            <div>
              <p class="font-medium text-zinc-700 mb-1">Ước tính:</p>
              <ul class="list-disc pl-5 space-y-1">
                <li>Token đầu vào sẽ gấp 6 tới 7 lần token ước tính cho phần tiếng Anh;</li>
                <li>Token đầu ra sẽ gấp 1,5 tới 2 lần token ước tính cho phần tiếng Việt;</li>
              </ul>
            </div>
            <p>
              Chi phí API thực tế có thể xem tại: <a href="https://aistudio.google.com/spend" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 hover:text-indigo-800 underline transition-colors">https://aistudio.google.com/spend</a> (khu vực này cũng được dùng để thiết lập chi tiêu tối đa hàng tháng để bạn tránh sử dụng API quá khả năng thanh toán).
            </p>
          </div>
        </div>
      }
    </div>
  `
})
export class TokenEstimationComponent {
  store = inject(BookStore);
  isExpanded = signal(false);

  hasGutenbergSkipped = computed(() => this.store.chapters().some(c => c.excludeFromTranslation));

  formatNumber(val: number): string {
    if (val === 0) return '0';
    if (val < 1000) return Math.round(val).toString();
    return (val / 1000).toFixed(1) + 'K';
  }
}
