import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateScene as generateOpenAIScene } from './openai-provider.js';
import {
  cloudflareConfigured,
  cloudflareModel,
  cloudflareReferenceModel,
  generateScene as generateCloudflareScene,
} from './cloudflare-provider.js';
import {
  analyzeRefinement,
  analyzeSingleApplication,
  visionModel,
} from './vision-provider.js';
import { analyzeUniversalLayout } from './layout-provider.js';
import {
  mockupEditModel,
  renderMockupWithAI,
} from './mockup-edit-provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8000);
const MAX_BODY = 20 * 1024 * 1024;
const AI_RATE_LIMIT_PER_HOUR = Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_HOUR || 60));
const RATE_WINDOW_MS = 60 * 60 * 1000;
const requestBuckets = new Map();

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

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function basicAuthConfigured(env = process.env) {
  return Boolean(env.STUDIO_BASIC_USER && env.STUDIO_BASIC_PASS);
}

function requestAuthorized(req, env = process.env) {
  if (!basicAuthConfigured(env)) return true;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);
    return secureEqual(user, env.STUDIO_BASIC_USER) && secureEqual(pass, env.STUDIO_BASIC_PASS);
  } catch {
    return false;
  }
}

function requireAuthorization(req, res) {
  if (requestAuthorized(req)) return true;
  sendJson(res, 401, { error: 'Acesso restrito ao Mockup Vision Studio.' }, {
    'WWW-Authenticate': 'Basic realm="Mockup Vision Studio", charset="UTF-8"',
  });
  return false;
}

function clientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function consumeAiQuota(req) {
  const now = Date.now();
  const key = clientAddress(req);
  const previous = requestBuckets.get(key);
  const bucket = !previous || now - previous.startedAt >= RATE_WINDOW_MS
    ? { startedAt: now, count: 0 }
    : previous;
  bucket.count += 1;
  requestBuckets.set(key, bucket);

  if (requestBuckets.size > 500) {
    for (const [address, value] of requestBuckets) {
      if (now - value.startedAt >= RATE_WINDOW_MS) requestBuckets.delete(address);
    }
  }

  return {
    allowed: bucket.count <= AI_RATE_LIMIT_PER_HOUR,
    limit: AI_RATE_LIMIT_PER_HOUR,
    remaining: Math.max(0, AI_RATE_LIMIT_PER_HOUR - bucket.count),
    resetAt: bucket.startedAt + RATE_WINDOW_MS,
  };
}

function enforceAiRateLimit(req, res) {
  const quota = consumeAiQuota(req);
  if (quota.allowed) return true;
  const retryAfter = Math.max(1, Math.ceil((quota.resetAt - Date.now()) / 1000));
  sendJson(res, 429, {
    error: 'Limite temporário desta versão de teste atingido. Tente novamente mais tarde.',
  }, {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(quota.limit),
    'X-RateLimit-Remaining': '0',
  });
  return false;
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
    '<script type="module" src="studio-enhancements.js"></script>',
    '<script type="module" src="studio-reference-support.js"></script>',
    '<script type="module" src="studio-artwork-editor.js"></script>',
    '<script type="module" src="studio-artwork-editor-apply.js"></script>',
    '<script type="module" src="studio-fidelity-guard.js"></script>',
    '<script type="module" src="studio-universal.js"></script>',
    '<script type="module" src="studio-product-polish.js"></script>',
    '<script type="module" src="studio-workspace.js"></script>',
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
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT') return sendJson(res, 404, { error: 'Arquivo não encontrado.' });
    console.error(error);
    sendJson(res, 500, { error: 'Falha ao servir arquivo.' });
  }
}

function localNetworkUrls(port) {
  const urls = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }
  return [...new Set(urls)];
}

const server = http.createServer(async (req, res) => {
  try {
    if (['GET', 'HEAD'].includes(req.method || '') && req.url?.startsWith('/healthz')) {
      return sendJson(res, 200, { ok: true });
    }

    if (!requireAuthorization(req, res)) return;

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
        sceneReferences: {
          configured: state.cloudflare,
          model: state.cloudflare ? cloudflareReferenceModel() : null,
          maxImages: 4,
        },
        directMockupEdit: {
          configured: state.cloudflare,
          model: state.cloudflare ? mockupEditModel() : null,
          capabilities: [
            'two-image-reference-edit',
            'single-art-direct-render',
            'fidelity-profiles',
            'aspect-ratio-preservation',
            'deformation-limits',
            'deterministic-exact-guard',
            'original-pixel-rendering',
          ],
        },
        vision: {
          configured: state.cloudflare,
          model: state.cloudflare ? visionModel() : null,
          capabilities: [
            'single-art-application-plan',
            'generic-slot-detection',
            'whole-composition-surface-inventory',
            'duplicate-surface-rejection',
            'multi-surface-candidate-recovery',
            'brand-safe-refinement-plan',
          ],
        },
      });
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/')) {
      if (!enforceAiRateLimit(req, res)) return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/generate-scene')) {
      const body = await readJson(req);
      const result = await generateWithConfiguredProvider(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/render-mockup')) {
      const body = await readJson(req);
      const result = await renderMockupWithAI(body);
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && req.url?.startsWith('/api/apply-plan')) {
      const body = await readJson(req);
      const result = await analyzeSingleApplication(body);
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
  console.log('\nMockup Vision Studio');
  console.log(`Local: http://localhost:${PORT}`);
  const networkUrls = localNetworkUrls(PORT);
  if (networkUrls.length) networkUrls.forEach((url) => console.log(`Rede:  ${url}`));
  else console.log('Rede:  nenhum endereço IPv4 externo encontrado neste ambiente.');
  if (basicAuthConfigured()) console.log('Acesso público protegido por autenticação básica.');
  console.log(`Limite de API: ${AI_RATE_LIMIT_PER_HOUR} chamadas por IP/hora.`);

  if (state.provider === 'cloudflare') {
    console.log(`\nCloudflare configurado (${cloudflareModel()}).`);
    console.log(`Referências de cena: ${cloudflareReferenceModel()}.`);
    console.log(`Editor de mockup: ${mockupEditModel()}.`);
    console.log(`Visão universal: ${visionModel()}.`);
  } else if (state.provider === 'openai') {
    console.log('\nProvider alternativo configurado.');
  } else {
    console.log('\nRenderização não configurada. Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.');
  }
});
