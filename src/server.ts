import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Allow large payloads (for PDF conversions & long chapters)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * Gemini API Server-Side Proxy endpoints
 */
app.post('/api/gemini/generate', async (req: express.Request, res: express.Response) => {
  try {
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const apiKey = (userApiKey && userApiKey.trim()) || process.env['GEMINI_API_KEY'];

    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa có Gemini API Key. Vui lòng cấu hình API Key trong ứng dụng để tiếp tục.'
      });
    }

    const { model, contents, config } = req.body || {};
    if (!model || !contents) {
      return res.status(400).json({ error: 'Thiếu thông tin model hoặc contents.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents,
      config: config || {}
    });

    return res.json({
      text: response.text || '',
      promptFeedback: response.promptFeedback || null
    });
  } catch (err: unknown) {
    console.error('Server Gemini generate error:', err);
    let errorMessage = (err as Error)?.message || String(err);
    try {
      if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
        const parsed = JSON.parse(errorMessage);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      }
    } catch {
      // keep original
    }
    return res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/gemini/count-tokens', async (req: express.Request, res: express.Response) => {
  try {
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const apiKey = (userApiKey && userApiKey.trim()) || process.env['GEMINI_API_KEY'];

    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa có Gemini API Key. Vui lòng cấu hình API Key trong ứng dụng để tiếp tục.'
      });
    }

    const { model, contents } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.countTokens({
      model: model || 'gemini-flash-lite-latest',
      contents: contents || []
    });

    return res.json({ totalTokens: response.totalTokens || 0 });
  } catch (err: unknown) {
    console.error('Server Gemini countTokens error:', err);
    let errorMessage = (err as Error)?.message || String(err);
    try {
      if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
        const parsed = JSON.parse(errorMessage);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      }
    } catch {
      // keep original
    }
    return res.status(500).json({ error: errorMessage });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  angularApp
    .handle(req)
    .then((response: unknown) =>
      response ? writeResponseToNodeResponse(response as Response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI dev server and during build.
 */
export const reqHandler = createNodeRequestHandler(app);
