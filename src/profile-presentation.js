import { gsap } from './vendor/gsap.mjs';
import { revealAccountSurface, clearAccountMotion } from './account-motion.js';

export function initProfilePresentation(root, { signal, selectFile, clearSelection, isBusy }) {
  const $ = selector => root.querySelector(selector);
  const editor = $('.profile-avatar-editor');
  const pencil = $('#avatar-pencil');
  const menu = $('#avatar-edit-menu');
  const dialog = $('#avatar-dialog');
  const recentList = $('#avatar-recents');
  const details = $('.profile-details');
  const events = { signal };
  const recent = [];
  let revealed = false;
  let lockedBody = false;

  function setMenu(open) {
    menu.hidden = !open;
    menu.inert = !open;
    pencil.setAttribute('aria-expanded', String(open));
    if (open) revealAccountSurface(menu); else clearAccountMotion(menu);
  }
  function finishClose() {
    clearAccountMotion(dialog);
    clearSelection();
    if (lockedBody) document.body.classList.remove('dialog-open');
    lockedBody = false;
    if (pencil.isConnected && !root.hidden) pencil.focus({ preventScroll: true });
  }
  function close() {
    if (isBusy()) return;
    dialog.close();
  }
  pencil.addEventListener('click', () => setMenu(menu.hidden), events);
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault(); event.stopPropagation(); setMenu(false); pencil.focus();
    } else if (event.target === pencil && event.key === 'ArrowDown') {
      event.preventDefault(); setMenu(true); $('#avatar-edit').focus();
    }
  }, events);
  editor.addEventListener('focusout', event => { if (!editor.contains(event.relatedTarget)) setMenu(false); }, events);
  document.addEventListener('pointerdown', event => { if (!editor.contains(event.target)) setMenu(false); }, events);
  $('#avatar-edit').addEventListener('click', () => {
    setMenu(false);
    $('#avatar-dialog-status').textContent = '';
    $('#avatar-dialog-error').textContent = ''; $('#avatar-dialog-error').hidden = true;
    dialog.showModal();
    lockedBody = !document.body.classList.contains('dialog-open');
    document.body.classList.add('dialog-open');
    revealAccountSurface(dialog);
    $('#avatar-file').focus({ preventScroll: true });
  }, events);
  $('#avatar-dialog-close').addEventListener('click', close, events);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, events);
  dialog.addEventListener('close', finishClose, events);
  // Keep the focus cycle inside the modal, including at the browser-chrome boundary.
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); return; }
    const current = controls.indexOf(document.activeElement);
    const step = event.shiftKey ? -1 : 1;
    const next = current < 0
      ? (event.shiftKey ? controls.length - 1 : 0)
      : (current + step + controls.length) % controls.length;
    // Explicit stepping also covers Safari's file-input focus boundary.
    event.preventDefault(); controls[next].focus();
  }, events);
  // showModal makes the page behind the selector inert.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }, events);

  function renderRecent() {
    recentList.replaceChildren();
    $('#avatar-recents-empty').hidden = recent.length > 0;
    for (const [index, item] of recent.entries()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'avatar-recent';
      button.setAttribute('aria-label', `Selecionar imagem recente ${index + 1}`);
      const image = document.createElement('img');
      image.src = item.url; image.alt = ''; image.width = 56; image.height = 56;
      button.append(image);
      button.addEventListener('click', () => { if (!isBusy()) selectFile(item.file); });
      recentList.append(button);
    }
  }
  function reset() {
    if (dialog.open) dialog.close();
    setMenu(false);
    recent.splice(0).forEach(item => URL.revokeObjectURL(item.url));
    renderRecent();
  }
  return {
    reveal() {
      if (revealed) return;
      revealed = true;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(details,
        { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'power2.out', clearProps: 'transform,opacity' });
    },
    remember(file) {
      const existing = recent.findIndex(item => item.file === file);
      if (existing >= 0) recent.unshift(...recent.splice(existing, 1));
      else recent.unshift({ file, url: URL.createObjectURL(file) });
      while (recent.length > 6) URL.revokeObjectURL(recent.pop().url);
      renderRecent();
    },
    reset,
    destroy() {
      reset(); clearAccountMotion(menu); clearAccountMotion(dialog); clearAccountMotion(details);
      if (lockedBody) document.body.classList.remove('dialog-open');
    },
  };
}
