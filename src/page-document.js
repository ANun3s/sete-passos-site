function normalizedHref(value, base) {
  try {
    const url = new URL(value, base);
    return url.origin === location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function stylesheetIsLoaded(href, seen = new Set()) {
  for (const sheet of document.styleSheets) {
    if (includesStylesheet(sheet, href, seen)) return true;
  }
  return false;
}

function includesStylesheet(sheet, href, seen) {
  if (!sheet || seen.has(sheet)) return false;
  seen.add(sheet);
  if (sheet.href && normalizedHref(sheet.href, location.href) === href) return true;
  let rules;
  try { rules = sheet.cssRules; } catch { return false; }
  for (const rule of rules) {
    if (rule.styleSheet && includesStylesheet(rule.styleSheet, href, seen)) return true;
  }
  return false;
}

function existingLink(href) {
  return [...document.head.querySelectorAll('link[rel~="stylesheet"][href]')]
    .find(link => normalizedHref(link.href, location.href) === href && !link.disabled);
}

function existingInlineStyle(cssText) {
  return [...document.head.querySelectorAll('style')]
    .find(style => !style.disabled && style.textContent === cssText);
}

async function loadRouteStyles(html, baseUrl, signal) {
  // Vite inlines the homepage stylesheet in production, so include inline
  // <style> nodes as well as linked stylesheets and keep their document order.
  const routeStyles = [...html.head.children]
    .filter(source => source.tagName === 'STYLE'
      || (source.tagName === 'LINK' && source.relList.contains('stylesheet') && source.hasAttribute('href')))
    .filter(source => !source.disabled && !source.relList?.contains('alternate'))
    .map(source => source.tagName === 'STYLE'
      ? { source, cssText: source.textContent, media: source.getAttribute('media') || '', node: existingInlineStyle(source.textContent) }
      : { source, href: normalizedHref(source.getAttribute('href'), baseUrl), media: source.getAttribute('media') || '' })
    .filter(style => style.cssText?.trim() || style.href);
  const additions = [];
  const linksByHref = new Map();
  const inlineByText = new Map();

  for (const style of routeStyles) {
    if (style.href) {
      if (stylesheetIsLoaded(style.href)) {
        style.node ||= existingLink(style.href);
        continue;
      }
      if (linksByHref.has(style.href)) {
        style.node = linksByHref.get(style.href);
        continue;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = style.href;
      link.media = 'not all';
      for (const name of ['type', 'title', 'crossorigin', 'integrity', 'referrerpolicy', 'nonce']) {
        const value = style.source.getAttribute(name);
        if (value !== null) link.setAttribute(name, value);
      }
      style.node = link;
      linksByHref.set(style.href, link);
      additions.push({ node: link, media: style.media, href: style.href });
      continue;
    }

    if (style.node) continue;
    if (inlineByText.has(style.cssText)) {
      style.node = inlineByText.get(style.cssText);
      continue;
    }
    const node = document.createElement('style');
    node.media = 'not all';
    node.textContent = style.cssText;
    for (const name of ['type', 'title', 'nonce']) {
      const value = style.source.getAttribute(name);
      if (value !== null) node.setAttribute(name, value);
    }
    style.node = node;
    inlineByText.set(style.cssText, node);
    additions.push({ node, media: style.media });
  }

  // Insert every staged style before starting any network requests. This
  // preserves the original cascade order even when several route sheets load.
  routeStyles.forEach((style, index) => {
    const { node } = style;
    if (!node || node.isConnected) return;
    const nextNode = routeStyles.slice(index + 1).map(item => item.node).find(item => item?.isConnected);
    const previousNode = [...routeStyles.slice(0, index)].reverse().map(item => item.node).find(item => item?.isConnected);
    if (nextNode) document.head.insertBefore(node, nextNode);
    else if (previousNode) previousNode.after(node);
    else document.head.append(node);
  });

  const styleController = new AbortController();
  const abortStyles = () => styleController.abort();
  if (signal?.aborted) abortStyles();
  else signal?.addEventListener('abort', abortStyles, { once: true });
  const loads = additions.filter(item => item.href).map(({ node: link, href }) => new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error(`Tempo excedido ao carregar estilo: ${href}`)), 8000);
    const onAbort = () => finish(new DOMException('Navegação cancelada', 'AbortError'));
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      styleController.signal.removeEventListener('abort', onAbort);
      link.removeEventListener('load', onLoad);
      link.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error(`Não foi possível carregar estilo: ${href}`));
    link.addEventListener('load', onLoad, { once: true });
    link.addEventListener('error', onError, { once: true });
    styleController.signal.addEventListener('abort', onAbort, { once: true });
    if (styleController.signal.aborted) onAbort();
  }));

  try {
    try {
      await Promise.all(loads);
    } catch (error) {
      styleController.abort();
      await Promise.allSettled(loads);
      throw error;
    }
  } catch (error) {
    additions.forEach(({ node }) => node.remove());
    throw error;
  } finally {
    signal?.removeEventListener('abort', abortStyles);
  }

  let activated = false;
  return {
    activate() {
      if (activated) return;
      activated = true;
      additions.forEach(({ node, media }) => {
        if (media) node.media = media;
        else node.removeAttribute('media');
      });
    },
    cleanup() {
      if (!activated) additions.forEach(({ node }) => node.remove());
    },
  };
}

/** Load an allowlisted local document and its local styles; never execute its scripts. */
export async function loadPageDocument(route, href, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(href, { signal: controller.signal, headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Página indisponível');
    if (new URL(response.url).origin !== location.origin) throw new Error('Origem inesperada');
    if (['perfil', 'admin'].includes(route.key) && new URL(response.url).pathname === '/login.html') {
      location.assign(`${new URL(response.url).pathname}${new URL(response.url).search}`);
      throw new Error('Sessão expirada. Entre novamente.');
    }
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const content = html.querySelector('#page-content');
    if (content?.dataset.page !== route.key || !content.querySelector('main h1')) throw new Error('Documento inesperado');
    content.querySelectorAll('script').forEach(script => script.remove());
    const styles = await loadRouteStyles(html, response.url, controller.signal);
    return {
      content: document.importNode(content, true),
      title: html.title,
      description: html.querySelector('meta[name="description"]')?.content || '',
      activateStyles: styles.activate,
      cleanupStyles: styles.cleanup,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
