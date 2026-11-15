import { Injectable } from '@angular/core';
import {
  GenerateContentConfig,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
  ThinkingConfig,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { getSecureApiKey } from './crypto-storage.util';

export function isQuotaError(e: unknown): boolean {
  const msg = (e as Error)?.message || e?.toString() || '';
  const lowerMsg = msg.toLowerCase();
  return lowerMsg.includes('quota') || lowerMsg.includes('429') || lowerMsg.includes('resource_exhausted');
}

export function parseGeminiError(e: unknown): string {
  const msg = (e as Error)?.message || e?.toString() || '';
  if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('429')) {
    return 'Lỗi: Đã vượt quá giới hạn API miễn phí (Quota exceeded). Vui lòng thử lại vào ngày mai hoặc đăng nhập tài khoản khác còn API miễn phí.';
  }
  if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('permission_denied')) {
    return 'Lỗi: Thao tác bị từ chối do API Key không hợp lệ hoặc thiếu quyền hạn (Permission Denied). Đợi một lúc rồi thử lại có thể giải quyết được vấn đề này.';
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch failed')) {
    return 'Lỗi: Bị gián đoạn mạng. Vui lòng kiểm tra lại kết nối internet.';
  }
  if (msg.toLowerCase().includes('timeout')) {
    return 'Lỗi: Quá thời gian chờ (Timeout).';
  }
  if (msg.toLowerCase().includes('bytestring') || msg.toLowerCase().includes('failed to construct \'headers\'')) {
    return 'Lỗi định dạng API Key: API Key cá nhân bạn nhập chứa ký tự không hợp lệ (như dấu cách, tiếng Việt có dấu). Vui lòng vào Cài đặt để kiểm tra lại.';
  }
  if (msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('503')) {
    return 'Lỗi: Máy chủ cung cấp AI đang quá tải, vui lòng thử lại sau một chút.';
  }
  
  // Try to parse json from msg if it's a raw google error
  try {
     let str = msg;
     if (str.includes('{')) {
       str = str.substring(str.indexOf('{'));
       const obj = JSON.parse(str);
       if (obj?.error?.message) {
         return `Lỗi từ AI: ${obj.error.message}`;
       }
     }
  } catch {
    // ignore parse error
  }

  return msg ? msg : `Lỗi không xác định trong quá trình xử lý, vui lòng thử lại.`;
}

const DEFAULT_SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

@Injectable({ providedIn: 'root' })
export class GeminiClient {
  private async getApiKey(): Promise<string> {
    if (typeof window !== 'undefined') {
      const userKey = await getSecureApiKey();
      if (userKey && userKey.trim()) {
        return userKey.trim();
      }
    }
    return GEMINI_API_KEY;
  }

  private resolveApiVersion(model?: string): 'v1' | 'v1beta' {
    const normalized = (model || '').toLowerCase();
    if (
      normalized.includes('-latest') ||
      normalized.includes('-preview') ||
      normalized.includes('-exp')
    ) {
      return 'v1beta';
    }
    return 'v1';
  }

  private async getAi(model?: string): Promise<GoogleGenAI> {
    const key = await this.getApiKey();
    return new GoogleGenAI({ 
      apiKey: key,
      apiVersion: this.resolveApiVersion(model),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  private promptCache = new Map<string, Promise<string>>();

  private requirePromptText(url: string, label: string): Promise<string> {
    const cached = this.promptCache.get(url);
    if (cached) {
      return cached;
    }

    const fetchPromise = (async () => {
      const defaultOpts: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      };

      const retryDelaysMs = [300, 700];
      let lastError: unknown;

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
          const res = await fetch(`${url}?t=${Date.now()}`, defaultOpts);
          if (res.ok) {
            const text = await res.text();
            if (text.trim().length > 0) {
              return text;
            }
            lastError = new Error(`Tệp cấu hình rỗng (${res.status})`);
          } else {
            lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
          }
        } catch (e) {
          lastError = e;
        }

        if (attempt < retryDelaysMs.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt]));
        }
      }

      this.promptCache.delete(url);
      console.error(`Failed to load ${url} after retries`, lastError);
      throw new Error(
        `Không thể tải cấu hình hướng dẫn AI (${label}: ${url}). Vui lòng kiểm tra kết nối mạng và thử lại.`
      );
    })();

    this.promptCache.set(url, fetchPromise);
    return fetchPromise;
  }

  private buildThinkingConfig(
    model: string,
    desiredLevel: ThinkingLevel = ThinkingLevel.HIGH
  ): ThinkingConfig | undefined {
    const normalized = model.toLowerCase();
    // thinkingLevel applies to Gemini 3, Gemini 4, and *-latest aliases; skip on Gemini 1.x / 2.x
    if (normalized.includes('gemini-1.') || normalized.includes('gemini-2.')) {
      return undefined;
    }
    // XHIGH is only supported on gemini-4-hydrogen; MINIMAL is not supported on Gemini 4
    if (desiredLevel === ThinkingLevel.XHIGH && !normalized.includes('gemini-4-hydrogen')) {
      return { thinkingLevel: ThinkingLevel.HIGH };
    }
    if (desiredLevel === ThinkingLevel.MINIMAL && normalized.includes('gemini-4-')) {
      return { thinkingLevel: ThinkingLevel.LOW };
    }
    return { thinkingLevel: desiredLevel };
  }

  private buildMaxOutputTokens(model: string): number {
    return model.toLowerCase().includes('gemini-4-hydrogen') ? 100000 : 65536;
  }

  private buildConfig(
    model: string,
    overrides: Partial<GenerateContentConfig> = {},
    desiredThinkingLevel: ThinkingLevel = ThinkingLevel.HIGH
  ): GenerateContentConfig {
    const thinkingConfig = this.buildThinkingConfig(model, desiredThinkingLevel);
    return {
      ...(thinkingConfig ? { thinkingConfig } : {}),
      maxOutputTokens: this.buildMaxOutputTokens(model),
      safetySettings: DEFAULT_SAFETY_SETTINGS,
      ...overrides,
    };
  }

  async countTokens(base64Data: string, mimeType = 'application/pdf', model = 'gemini-flash-lite-latest'): Promise<number> {
    try {
      const ai = await this.getAi(model);
      const response = await ai.models.countTokens({
        model: model,
        contents: [
          { inlineData: { data: base64Data, mimeType } }
        ]
      });
      return response.totalTokens || 0;
    } catch (e) {
      console.error('Failed to count tokens', e);
      return 0;
    }
  }

  async convertPdfToMarkdown(base64Data: string, model = 'gemini-flash-lite-latest'): Promise<string> {
    const [pdfSI, textPrompt] = await Promise.all([
      this.requirePromptText('/prompts/pdf_to_md_system_instruction.md', 'Chuyển PDF System Instruction'),
      this.requirePromptText('/prompts/pdf_to_md_prompt.md', 'Chuyển PDF Prompt'),
    ]);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction: pdfSI,
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      config: configArgs,
      contents: [
        { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
        { text: textPrompt }
      ]
    });
    
    let result = (response.text || '').trim();
    if (/^```(?:markdown|md)?[ \t]*\r?\n/i.test(result) && /\r?\n```[ \t]*$/.test(result)) {
      result = result.replace(/^```(?:markdown|md)?[ \t]*\r?\n/i, '').replace(/\r?\n```[ \t]*$/, '');
    }
    
    return result;
  }

  async filterGlossary(text: string, glossaryTable: string): Promise<{ text: string; usedCount: number; totalCount: number }> {
    const lines = glossaryTable.split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length <= 2) return { text: glossaryTable, usedCount: 0, totalCount: 0 };

    const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
    if (headers.length < 4 || headers[0] !== 'Tiếng Anh') return { text: glossaryTable, usedCount: 0, totalCount: 0 };

    const fullGlossary: { english: string; pos: string; vietnamese: string; notes: string }[] = [];
    const compactList: { english: string; pos: string }[] = [];

    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').map(c => c.trim());
      if (cells.length >= 5) {
        const english = cells[1];
        const pos = cells[2];
        const vietnamese = cells[3];
        const notes = cells[4];
        fullGlossary.push({ english, pos, vietnamese, notes });
        compactList.push({ english, pos });
      }
    }

    if (compactList.length <= 100) return { text: glossaryTable, usedCount: compactList.length, totalCount: compactList.length };

    const [si, promptTemplate] = await Promise.all([
      this.requirePromptText('/prompts/filter_glossary_system_instruction.md', 'Lọc thuật ngữ System Instruction'),
      this.requirePromptText('/prompts/filter_glossary_prompt.md', 'Lọc thuật ngữ Prompt'),
    ]);

    let prompt = promptTemplate;
    prompt = prompt.replace('{{danh sách thuật ngữ}}', () => JSON.stringify(compactList));
    prompt = prompt.replace('{{nội dung cần dịch}}', () => text);

    const filterModel = 'gemini-flash-lite-latest';
    const filterConfig: GenerateContentConfig = this.buildConfig(filterModel, {
      systemInstruction: si,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            pos: { type: Type.STRING }
          },
          required: ["english", "pos"]
        }
      }
    });

    const response = await (await this.getAi(filterModel)).models.generateContent({
      model: filterModel,
      contents: [ { text: prompt } ],
      config: filterConfig
    });

    const resultText = response.text || '[]';
    let matchedItems: unknown;
    try {
      matchedItems = JSON.parse(resultText);
    } catch (e) {
      console.warn('Failed to parse filterGlossary JSON', e, resultText);
      throw new Error('Không thể đọc dữ liệu lọc thuật ngữ từ AI. Vui lòng thử lại sau vài giây.');
    }

    if (!Array.isArray(matchedItems) || matchedItems.length === 0) {
      return { text: '', usedCount: 0, totalCount: fullGlossary.length };
    }

    const matchedSet = new Set(
      matchedItems.map((item: { english: string; pos: string }) => `${item.english}_${item.pos}`.toLowerCase())
    );
    const filteredGlossary = fullGlossary.filter(item => matchedSet.has(`${item.english}_${item.pos}`.toLowerCase()));

    if (filteredGlossary.length === 0) return { text: '', usedCount: 0, totalCount: fullGlossary.length };

    let resultTable = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
    for (const item of filteredGlossary) {
      resultTable += `| ${item.english} | ${item.pos} | ${item.vietnamese} | ${item.notes} |\n`;
    }

    return { text: resultTable, usedCount: filteredGlossary.length, totalCount: fullGlossary.length };
  }

  async normalizePronouns(text: string, rawPronounTable: string, model: string, bookTitle: string, author: string): Promise<string> {
    if (!rawPronounTable.trim()) return '';

    const [si, promptTemplate] = await Promise.all([
      this.requirePromptText('/prompts/normalize_pronouns_system_instructions.md', 'Chuẩn hóa đại từ System Instruction'),
      this.requirePromptText('/prompts/normalize_pronouns_prompt.md', 'Chuẩn hóa đại từ Prompt'),
    ]);

    let prompt = promptTemplate;
    prompt = prompt.replace('{{tên sách}}', () => bookTitle || 'Không rõ');
    prompt = prompt.replace('{{tên tác giả}}', () => author || 'Vô danh');
    prompt = prompt.replace('{{bảng đại từ}}', () => rawPronounTable);
    prompt = prompt.replace('{{nội dung}}', () => text);

    const filterConfig: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction: si,
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [ { text: prompt } ],
      config: filterConfig
    });

    let result = response.text || '';
    if (result.startsWith('```markdown')) {
      result = result.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (result.startsWith('```')) {
      result = result.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    return result;
  }

  async translateChapter(text: string, model: string, bookTitle = '', author = '', pronounTable = '', usePronouns = false, glossaryTable = '', useGlossary = false, shouldFilterGlossary = true, contextSummary?: string, customInstructions?: string, translationMode: 'standard' | 'scientific' = 'standard'): Promise<{text: string, customGlossary?: string, glossaryStatus?: 'none' | 'full' | 'filtered', glossaryRatio?: number}> {
    
    let activeGlossary = '';
    let glossaryStatus: 'none' | 'full' | 'filtered' = 'none';
    let glossaryRatio: number | undefined = undefined;

    if (useGlossary && glossaryTable) {
        if (shouldFilterGlossary) {
            const filterRes = await this.filterGlossary(text, glossaryTable);
            activeGlossary = filterRes.text;
            glossaryStatus = activeGlossary === glossaryTable ? 'full' : 'filtered';
            if (filterRes.totalCount > 0) {
              glossaryRatio = Math.round((filterRes.usedCount / filterRes.totalCount) * 100);
            }
        } else {
            activeGlossary = glossaryTable;
            glossaryStatus = 'full';
            glossaryRatio = 100;
        }
    }
    
    const siFileName = translationMode === 'scientific' ? '/prompts/scientific_system_instructions.md' : '/prompts/multi_system_instructions.md';
    const promptFileName = translationMode === 'scientific' ? '/prompts/scientific_prompt.md' : '/prompts/multi_prompt.md';
    
    const [systemInstruction, promptTemplate] = await Promise.all([
      this.requirePromptText(siFileName, 'Dịch chương System Instruction'),
      this.requirePromptText(promptFileName, 'Dịch chương Prompt'),
    ]);

    let finalPrompt = promptTemplate;
    finalPrompt = finalPrompt.replace('{{tên sách}}', () => bookTitle || 'Không rõ');
    finalPrompt = finalPrompt.replace('{{tên tác giả}}', () => author || 'Vô danh');

    if (usePronouns && pronounTable) {
      const pronounBlock = `<pronouns_rules>\n**Bảng đại từ nhân xưng:**\n${pronounTable}\n\n*LƯU Ý: Ở trên là Bảng đại từ nhân xưng tham chiếu. Bạn BẮT BUỘC phải sử dụng cấu trúc xưng hô này cho cách người kể chuyện gọi nhân vật (ngôi thứ 3) và trong các cuộc hội thoại thông thường. TUY NHIÊN, bạn được phép điều chỉnh linh hoạt cách xưng hô (ngôi thứ 1 & 2) nếu bối cảnh cảm xúc của câu chuyện thực sự đòi hỏi sự chuyển đổi.*\n</pronouns_rules>`;
      finalPrompt = finalPrompt.replace('{{đại từ nhân xưng}}', () => pronounBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{đại từ nhân xưng}}', '');
    }

    if (activeGlossary) {
      const glossaryBlock = `<glossary_rules>\n**Bảng thuật ngữ / Từ khó:**\n${activeGlossary}\n\n*LƯU Ý: Bảng thuật ngữ trên đây là một DANH SÁCH THAM KHẢO quan trọng, NHƯNG bạn hãy áp dụng LINH HOẠT các thuật ngữ này vào bản dịch để đảm bảo tính thống nhất chuyên môn/từ ngữ toàn cục của cuốn sách. Điều cần ghi nhớ là đừng ép buộc áp dụng một cách cứng nhắc nếu ngữ cảnh cụ thể của đoạn văn hoàn toàn khác.*\n</glossary_rules>`;
      finalPrompt = finalPrompt.replace('{{thuật ngữ}}', () => glossaryBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{thuật ngữ}}', '');
    }

    if (contextSummary) {
      const contextBlock = `<previous_chunk_handoff>\n**Tóm tắt bối cảnh từ phần trước để tham khảo:**\n${contextSummary}\n\n*LƯU Ý: Đây là thông tin nối tiếp từ khối văn bản trước (diễn biến sự kiện, trạng thái nhân vật, hoặc luồng logic/lập luận, **cùng với sắc thái/giọng điệu chung**). Hãy dùng nó để nắm bắt ngữ cảnh nhằm đảm bảo tính liền mạch cho bản dịch, đặc biệt là duy trì đúng giọng điệu và cảm xúc. TUYỆT ĐỐI KHÔNG lặp lại nội dung tóm tắt này vào phần bản dịch.*\n</previous_chunk_handoff>`;
      finalPrompt = finalPrompt.replace('{{tóm tắt bối cảnh}}', () => contextBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{tóm tắt bối cảnh}}', '');
    }

    if (customInstructions) {
      const instructionsBlock = `<custom_instructions>\n**Chỉ thị bổ sung khi dịch:**\n${customInstructions}\n</custom_instructions>`;
      finalPrompt = finalPrompt.replace('{{chỉ thị bổ sung}}', () => instructionsBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{chỉ thị bổ sung}}', '');
    }

    // Clean up multiple newlines that might arise from empty optional blocks before inserting source text
    finalPrompt = finalPrompt.replace(/\n\s*\n\s*\n/g, '\n\n');
    finalPrompt = finalPrompt.replace('{{nội dung cần dịch}}', () => '\n' + text);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction,
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [
        { text: finalPrompt }
      ],
      config: configArgs
    });
    
    let result = response.text || '';
    
    // Remove formatting tokens if AI happens to return them wrapping the content
    if (result.startsWith('```markdown')) {
      result = result.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (result.startsWith('```')) {
      result = result.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    return { text: result, customGlossary: activeGlossary || undefined, glossaryStatus, glossaryRatio };
  }

  async generatePronounsRaw(text: string, model: string, bookTitle = '', author = ''): Promise<{ originalName?: string; gender?: string; ageGroup?: string; role?: string; translatedTitles?: string; narratorPronoun?: string; dialoguePronouns?: string; reasoning?: string; notes?: string; }[]> {
    const [psi, pp] = await Promise.all([
      this.requirePromptText('/prompts/pronouns_system_instructions.md', 'Tạo đại từ System Instruction'),
      this.requirePromptText('/prompts/pronouns_prompt.md', 'Tạo đại từ Prompt'),
    ]);

    let finalPrompt = pp;
    finalPrompt = finalPrompt.replace('{{tên sách}}', () => bookTitle || 'Không rõ');
    finalPrompt = finalPrompt.replace('{{tên tác giả}}', () => author || 'Vô danh');
    finalPrompt = finalPrompt.replace('{{nội dung}}', () => text);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction: psi,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalName: { type: Type.STRING },
            gender: { type: Type.STRING },
            ageGroup: { type: Type.STRING },
            role: { type: Type.STRING },
            translatedTitles: { type: Type.STRING },
            narratorPronoun: { type: Type.STRING },
            dialoguePronouns: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: [
            'originalName',
            'gender',
            'ageGroup',
            'role',
            'translatedTitles',
            'narratorPronoun',
            'dialoguePronouns',
            'reasoning',
            'notes'
          ]
        }
      }
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [{ text: finalPrompt }],
      config: configArgs
    });

    if (response.promptFeedback?.blockReason) {
      throw new Error(`Nội dung bị chặn bởi bộ lọc an toàn của Google: ${response.promptFeedback.blockReason}`);
    }

    let result = response.text || '';
    const match = result.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Lỗi phân tích Đại từ. Toàn bộ response object:', JSON.stringify(response, null, 2));
      console.error('Kết quả trả về từ AI (dạng text):', result);
      throw new Error(`Lỗi phân tích AI: Không tìm thấy mảng JSON. Text trả về: "${result.substring(0, 50)}..."`);
    }
    result = match[0];

    try {
      const arr = JSON.parse(result);
      if (Array.isArray(arr)) {
        return arr;
      }
      throw new Error('Dữ liệu không phải là mảng');
    } catch (e) {
      console.warn('Failed to parse generatePronounsRaw JSON', e, result);
      throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
    }
  }

  async generatePronouns(text: string, model: string, bookTitle = '', author = ''): Promise<string> {
    const arr = await this.generatePronounsRaw(text, model, bookTitle, author);
    if (arr.length > 0) {
      const cleanCell = (v?: string) => (v || '').replace(/\|/g, '/').replace(/\r?\n/g, '<br>');
      let md = '| Nhân vật (Original) | Giới tính | Ước lượng độ tuổi | Đặc điểm & Vai trò | Xưng hô / Tước vị (Dịch) | Ngôi thứ 3 (Narrator) | Xưng - Hô (Với người khác) | Lý do | Ghi chú |\n|---|---|---|---|---|---|---|---|---|\n';
      for (const pt of arr) {
        md += `| ${cleanCell(pt.originalName)} | ${cleanCell(pt.gender)} | ${cleanCell(pt.ageGroup)} | ${cleanCell(pt.role)} | ${cleanCell(pt.translatedTitles)} | ${cleanCell(pt.narratorPronoun)} | ${cleanCell(pt.dialoguePronouns)} | ${cleanCell(pt.reasoning)} | ${cleanCell(pt.notes)} |\n`;
      }
      return md;
    }
    return '';
  }

  async generateGlossaryRaw(text: string, model: string, bookTitle = '', author = ''): Promise<{ english?: string; pos?: string; vietnamese?: string; contextNotes?: string; }[]> {
    const [gsi, gp] = await Promise.all([
      this.requirePromptText('/prompts/glossary_system_instructions.md', 'Tạo thuật ngữ System Instruction'),
      this.requirePromptText('/prompts/glossary_prompt.md', 'Tạo thuật ngữ Prompt'),
    ]);

    let finalPrompt = gp;
    finalPrompt = finalPrompt.replace('{{tên sách}}', () => bookTitle || 'Không rõ');
    finalPrompt = finalPrompt.replace('{{tên tác giả}}', () => author || 'Vô danh');
    finalPrompt = finalPrompt.replace('{{nội dung}}', () => text);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction: gsi,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            vietnamese: { type: Type.STRING },
            pos: { type: Type.STRING },
            contextNotes: { type: Type.STRING }
          },
          required: ['english', 'vietnamese', 'pos', 'contextNotes']
        }
      }
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [{ text: finalPrompt }],
      config: configArgs
    });

    if (response.promptFeedback?.blockReason) {
      throw new Error(`Nội dung bị chặn bởi bộ lọc an toàn của Google: ${response.promptFeedback.blockReason}`);
    }

    let result = response.text || '';
    const match = result.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Lỗi phân tích Từ khó. Toàn bộ response object:', JSON.stringify(response, null, 2));
      console.error('Kết quả trả về từ AI (dạng text):', result);
      throw new Error(`Lỗi phân tích AI: Không tìm thấy mảng JSON. Text trả về: "${result.substring(0, 50)}..."`);
    }
    result = match[0];

    try {
      const arr = JSON.parse(result);
      if (Array.isArray(arr)) {
        return arr;
      }
      throw new Error('Dữ liệu không phải là mảng');
    } catch (e) {
      console.warn('Failed to parse generateGlossaryRaw JSON', e, result);
      throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
    }
  }

  async generateGlossary(text: string, model: string, bookTitle = '', author = ''): Promise<string> {
    const arr = await this.generateGlossaryRaw(text, model, bookTitle, author);
    if (arr.length > 0) {
      const cleanCell = (v?: string) => (v || '').replace(/\|/g, '/').replace(/\r?\n/g, '<br>');
      let md = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
      for (const pt of arr) {
        md += `| ${cleanCell(pt.english)} | ${cleanCell(pt.pos)} | ${cleanCell(pt.vietnamese)} | ${cleanCell(pt.contextNotes)} |\n`;
      }
      return md;
    }
    return '';
  }

  async analyzeBook(text: string, model: string, bookTitle = '', author = ''): Promise<string> {
    const [si, p] = await Promise.all([
      this.requirePromptText('/prompts/book_analysis_system_instructions.md', 'Phân tích sách System Instruction'),
      this.requirePromptText('/prompts/book_analysis_prompt.md', 'Phân tích sách Prompt'),
    ]);

    let finalPrompt = p;
    finalPrompt = finalPrompt.replace('{{tên sách}}', () => bookTitle || 'Không rõ');
    finalPrompt = finalPrompt.replace('{{tên tác giả}}', () => author || 'Vô danh');
    finalPrompt = finalPrompt.replace('{{nội dung}}', () => text);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction: si,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          splitOptions: {
            type: Type.OBJECT,
            properties: {
              recommendedOption: {
                type: Type.STRING,
                enum: ['keyword', 'heading', 'standalone']
              },
              recommendedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendedHeading: {
                type: Type.STRING,
                enum: ['h2', 'h3', 'none']
              },
              reason: { type: Type.STRING }
            },
            required: ['recommendedOption', 'recommendedKeywords', 'recommendedHeading', 'reason']
          }
        },
        required: ['splitOptions']
      }
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [{ text: finalPrompt }],
      config: configArgs
    });

    let result = response.text || '';
    if (result.startsWith('```json')) {
      result = result.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (result.startsWith('```')) {
      result = result.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    return result.trim();
  }

  async summarizeTranslation(translatedText: string, model: string, translationMode: 'standard' | 'scientific' = 'standard'): Promise<string> {
    if (!translatedText.trim()) return '';

    const siPath = translationMode === 'scientific'
      ? '/prompts/summary_scientific_system_instruction.md'
      : '/prompts/summary_multi_system_instruction.md';
    const pPath = translationMode === 'scientific'
      ? '/prompts/summary_scientific_prompt.md'
      : '/prompts/summary_multi_prompt.md';

    const [systemInstruction, promptTemplate] = await Promise.all([
      this.requirePromptText(siPath, 'Tóm tắt ngữ cảnh System Instruction'),
      this.requirePromptText(pPath, 'Tóm tắt ngữ cảnh Prompt'),
    ]);

    const finalPrompt = promptTemplate.replace('{{nội dung}}', () => translatedText);

    const configArgs: GenerateContentConfig = this.buildConfig(model, {
      systemInstruction,
    });

    const response = await (await this.getAi(model)).models.generateContent({
      model: model,
      contents: [ { text: finalPrompt } ],
      config: configArgs
    });

    return (response.text || '').trim();
  }
}
