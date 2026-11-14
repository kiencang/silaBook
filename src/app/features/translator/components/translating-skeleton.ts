import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-translating-skeleton',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-start pt-12 min-h-[400px] h-full w-full relative overflow-hidden">
      <div class="absolute inset-0 p-6 pointer-events-none opacity-[0.15]">
        <div class="space-y-4 w-full mx-auto">
          <div class="h-3 bg-zinc-400 rounded w-3/4 animate-pulse"></div>
          <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 200ms"></div>
          <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 400ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-5/6 animate-pulse" style="animation-delay: 600ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-full animate-pulse" style="animation-delay: 800ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-2/3 animate-pulse" style="animation-delay: 1000ms"></div>
        </div>
        <div class="space-y-4 w-full mx-auto mt-8">
          <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 300ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-4/5 animate-pulse" style="animation-delay: 500ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-full animate-pulse" style="animation-delay: 700ms"></div>
          <div class="h-3 bg-zinc-400 rounded w-3/4 animate-pulse" style="animation-delay: 900ms"></div>
        </div>
        <div class="space-y-4 w-full mx-auto mt-8">
          <div class="h-3 bg-zinc-400 rounded w-1/2 animate-pulse" style="animation-delay: 400ms"></div>
        </div>
      </div>

      <div class="relative z-10 flex flex-col items-center bg-white/90 p-8 rounded-2xl shadow-sm backdrop-blur-sm border border-indigo-100 min-w-[240px]">
        <mat-icon class="animate-spin mb-4 text-indigo-600 !w-8 !h-8 !text-[32px] flex items-center justify-center">sync</mat-icon>
        <div class="text-sm font-semibold text-indigo-600 tracking-wider uppercase bg-indigo-50 px-4 py-2 rounded-full shadow-sm">
          Gemini đang dịch...
        </div>
      </div>
    </div>
  `
})
export class TranslatingSkeletonComponent {}
