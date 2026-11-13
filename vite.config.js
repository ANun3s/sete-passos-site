import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';

const apiTarget = 'http://127.0.0.1:3007';
const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

const githubPagesBuild = process.env.GITHUB_PAGES === 'true';
const siteBase = githubPagesBuild ? '/sete-passos-site/' : '/';

function githubPagesLinks() {
  return {
    name: 'sete-passos-github-pages-links',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!githubPagesBuild) return html;
        const pagesWithAssets = html.replace(/(["'=])\/(assets|fonts)\//gi, (_match, prefix, folder) => `${prefix}${siteBase}${folder}/`);
        return pagesWithAssets.replace(/(["'=])\/(index|sobre|historias|equipe|login|perfil|admin|fichas)\.html(?=[?#"'\s)])/gi, (_match, prefix, page) => `${prefix}${siteBase}${page}.html`);
      },
    },
  };
}
function inlineHomepageStylesheet() {
  return {
    name: 'sete-passos-inline-homepage-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      const homeCss = Object.entries(bundle).find(([file, asset]) =>
        file.startsWith('assets/inicio-') && file.endsWith('.css') && asset.type === 'asset');
      if (!homeCss) return;
      const [file, asset] = homeCss;
      const htmlSource = Buffer.from(html.source).toString('utf8');
      const cssSource = Buffer.from(asset.source).toString('utf8');
      const link = `<link rel="stylesheet" crossorigin href="/${file}">`;
      if (!htmlSource.includes(link)) return;
      // Keep the homepage's base styles ahead of Vite's shared stylesheet.
      // The shared bundle contains later overrides (for example interface.css);
      // inlining the base sheet after it changes desktop layouts in production.
      const htmlWithoutHomeCss = htmlSource.replace(link, '');
      const sharedStylesheet = /<link rel="stylesheet" crossorigin href="\/assets\/[^\"]+\.css">/;
      const firstSharedStylesheet = htmlWithoutHomeCss.match(sharedStylesheet)?.[0];
      if (!firstSharedStylesheet) return;
      html.source = htmlWithoutHomeCss.replace(
        firstSharedStylesheet,
        `<style>${cssSource}</style>${firstSharedStylesheet}`,
      );
      delete bundle[file];
    },
  };
}

// Vite can serve the same file through HTML fallback, /@fs, decoded paths,
// and case-insensitive filesystems. Match the filename, not just a URL spelling.
function isProfileHtml(rawUrl) {
  let pathname = rawUrl.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 8; depth++) {
    const normalized = posix.normalize(pathname.replaceAll('\\', '/'));
    if (/(?:^|\/)perfil(?:\.html)?\/*$/i.test(normalized)) return true;
    const decoded = decodeURIComponent(pathname).split(/[?#]/, 1)[0];
    if (decoded === pathname) return false;
    pathname = decoded;
  }
  // Do not hand ambiguous, excessively encoded paths to another URL parser.
  throw new URIError('Too many path encodings');
}

// Authorize before Vite transforms/serves the HTML (also works with built assets).
// Go Live can only serve an empty shell; private data is still guarded by the API.
export function profileGate(target = apiTarget) {
  return async (req, res, next) => {
    try {
      if (!isProfileHtml(req.url)) return next();
    } catch {
      res.statusCode = 400;
      res.setHeader('Cache-Control', 'no-store');
      return res.end('Invalid request path');
    }
    // Vite's HTML sender replaces Cache-Control after this middleware runs.
    // Keep the privacy headers authoritative, only for guarded responses.
    const setHeader = res.setHeader;
    res.setHeader = function (name, value) {
      const lowerName = name.toLowerCase();
      if (lowerName === 'cache-control') value = 'no-store';
      if (lowerName === 'referrer-policy') value = 'no-referrer';
      return setHeader.call(this, name, value);
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const response = await fetch(`${target}/api/me`, { headers: { Cookie: req.headers.cookie || '' }, signal: AbortSignal.timeout(5000) });
      if (response.status === 401) {
        res.statusCode = 303; res.setHeader('Location', '/login.html?returnTo=%2Fperfil.html'); return res.end();
      }
      if (!response.ok) throw new Error('Session service unavailable');
      const account = await response.json();
      if (!account?.user) throw new Error('Session unavailable');
      next();
    } catch {
      res.statusCode = 503; res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Perfil indisponível — Sete Passos</title><main><h1>Não foi possível verificar sua sessão</h1><p>O servidor de acesso está indisponível. Nenhum dado pessoal foi carregado.</p><a href="/perfil.html">Tentar novamente</a> · <a href="/login.html">Voltar ao login</a></main></html>');
    }
  };
}

function isAdminHtml(rawUrl) {
  let pathname = rawUrl.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 8; depth++) {
    const normalized = posix.normalize(pathname.replaceAll('\\', '/'));
    if (/(?:^|\/)admin(?:\.html)?\/*$/i.test(normalized)) return true;
    const decoded = decodeURIComponent(pathname).split(/[?#]/, 1)[0];
    if (decoded === pathname) return false;
    pathname = decoded;
  }
  throw new URIError('Too many path encodings');
}

export function adminGate(target = apiTarget) {
  return async (req, res, next) => {
    try { if (!isAdminHtml(req.url)) return next(); }
    catch { res.statusCode = 400; res.setHeader('Cache-Control', 'no-store'); return res.end('Invalid request path'); }
    const setHeader = res.setHeader;
    res.setHeader = function (name, value) {
      if (name.toLowerCase() === 'cache-control') value = 'no-store';
      if (name.toLowerCase() === 'referrer-policy') value = 'no-referrer';
      return setHeader.call(this, name, value);
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const response = await fetch(`${target}/api/admin/access`, { headers: { Cookie: req.headers.cookie || '' }, signal: AbortSignal.timeout(5000) });
      if (response.status === 401) { res.statusCode = 303; res.setHeader('Location', '/login.html?returnTo=%2Fadmin.html'); return res.end(); }
      if (response.status === 403) { res.statusCode = 303; res.setHeader('Location', '/index.html'); return res.end(); }
      if (!response.ok || (await response.json()).authorized !== true) throw new Error('Admin access check unavailable');
      next();
    } catch {
      res.statusCode = 503; res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Administração indisponível — Sete Passos</title><main><h1>Não foi possível verificar seu acesso</h1><p>Nenhum conteúdo administrativo foi carregado.</p><a href="/admin.html">Tentar novamente</a> · <a href="/index.html">Voltar ao site</a></main></html>');
    }
  };
}

export default defineConfig({
  base: siteBase,
  plugins: [githubPagesLinks(), inlineHomepageStylesheet(), {
    name: 'sete-passos-private-pages',
    configureServer(server) { server.middlewares.use(profileGate()); server.middlewares.use(adminGate()); },
    configurePreviewServer(server) { server.middlewares.use(profileGate()); server.middlewares.use(adminGate()); },
  }],
  server: { proxy },
  preview: { proxy },
  build: {
    rolldownOptions: {
      input: {
        inicio: fileURLToPath(new URL('./index.html', import.meta.url)),
        sobre: fileURLToPath(new URL('./sobre.html', import.meta.url)),
        historias: fileURLToPath(new URL('./historias.html', import.meta.url)),
        equipe: fileURLToPath(new URL('./equipe.html', import.meta.url)),
        login: fileURLToPath(new URL('./login.html', import.meta.url)),
        fichas: fileURLToPath(new URL('./fichas.html', import.meta.url)),
        perfil: fileURLToPath(new URL('./perfil.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
});
