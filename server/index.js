import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateScene as generateOpenAIScene } from './openai-provider.js';
import {
  cloudflareConfigured,
  cloudflareModel,
  generateScene as generateCloudflareScene,
} from './cloudflare-provider.js';
import {
  analyzeRefinement,
  analyzeUniversalLayout,
  visionModel,
} from './vision-provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8000);
const MAX_BODY = 20 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function providerState(env = process.env) {
  const preferred = String(env.IMAGE_PROVIDER || 'cloudflare').trim().toLowerCase();
  const cloudflare = cloudflareConfigured(env);
  const openai = Boolean(env.OPENAI_API_KEY);

  if (preferred === 'openai' && openai) {
    return { provider: 'openai', configured: true, preferred, cloudflare, openai };
  }
  if (preferred === 'cloudflare' && cloudflare) {
    return { provider: 'cloudflare', configured: true, preferred, cloudflare, openai };
  }
  if (cloudflare) return { provider: 'cloudflare', configured: true, preferred, cloudflare, openai };
  if (openai) return { provider: 'openai', configured: true, preferred, cloudflare, openai };
  return { provider: null, configured: false, preferred, cloudflare, openai };
}

async function generateWithConfiguredProvider(body) {
  const state = providerState();
  if (state.provider === 'cloudflare') return generateCloudflareScene(body);
  if (state.provider === 'openai') return generateOpenAIScene(body);

  const error = new Error(
    'Nenhum gerador configurado. Para o modo gratuito, defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.'
  );
  error.statusCode = 503;
  throw error;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('Payload muito grande. Reduza o número/tamanho das referências.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch {
    const error = new Error('JSON inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function safeFilePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relative = pathname === '/' ? 'photo.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) return null;
  return resolved;
}

function injectStudioHelpers(filePath, data) {
  if (path.basename(filePath) !== 'photo.html') return data;
  let html = data.toString('utf8');
  const scripts = [
    '<script src="studio-api-monitor.js"></script>',
    '<script type="module" src="studio-ux.js"></script>',
    '<script type="module" src="studio-universal.js"></script>',
  ];
  for (const script of scripts) {
    const src = script.match(/src="([^"]+)"/)?.[1];
    if (src && !html.includes(src)) html = html.replace('</body>', `${script}\n</body>`);
  }
  return Buffer.from(html);
}

async function serveStatic(req, res) {
  let filePath = safeFilePath(req.url || '/');
  if (!filePath) return sendJson(res, 403, { error: 'Caminho inválido.' });

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
    let data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') data = injectStudioHelpers(filePath, data);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || ext === '.js' ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT') return sendJson(res, 404, { error: 'Arquivo não encontrado.' });
    console.error(error);
    sendJson(res, 500, { error: 'Falha ao servir arquivo.' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url?.startsWith('/api/health')) {
      const state = providerState();
      return sendJson(res, 200, {
        ok: true,
        generatorConfigured: state.configured,
        provider: state.provider,
        preferredProvider: state.preferred,
        providers: {
          cloudflare: state.cloudflare,
          openai: state.openai,
        },
        model: state.provider === 'cloudflare' ? cloudflareModel() : null,
        vision: {
          configured: state.cloudflare,
          model: state.cloudflare ? visionModel() : null,
          capabilities: ['generic-slot-detection', 'brand-safe-refinement-plan'],
        },
      });
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/generate-scene')) {
      const body = await readJson(req);
      const result = await generateWithConfiguredProvider(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/analyze-layout')) {
      const body = await readJson(req);
      const result = await analyzeUniversalLayout(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/refine-plan')) {
      const body = await readJson(req);
      const result = await analyzeRefinement(body);
      return sendJson(res, 200, result);
    }

    if (!['GET', 'HEAD'].includes(req.method || '')) {
      return sendJson(res, 405, { error: 'Método não permitido.' });
    }

    return serveStatic(req, res);
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) console.error(error);
    return sendJson(res, status, { error: error?.message || 'Erro interno.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const state = providerState();
  console.log(`Mockup Vision Studio em http://localhost:${PORT}`);
  if (state.provider === 'cloudflare') {
    console.log(`Gerador Cloudflare configurado (${cloudflareModel()}).`);
    console.log(`Visão universal configurada (${visionModel()}).`);
  } else if (state.provider === 'openai') {
    console.log('Gerador OpenAI configurado como fallback.');
  } else {
    console.log('Gerador não configurado. Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.');
  }
});
