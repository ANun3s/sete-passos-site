import { revealAccountSurface, clearAccountMotion } from './account-motion.js';

export function initContact({ signal } = {}) {
  const dialog = document.querySelector('#contact-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const form = document.querySelector('#contact-form');
  const result = document.querySelector('#message-result');
  const message = document.querySelector('#prepared-message');
  const status = document.querySelector('.copy-status');
  const copy = document.querySelector('.copy-button');
  let trigger;

  document.querySelectorAll('[data-contact]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      trigger = link;
      form.reset();
      const selected = [...form.elements.interest].find(input => input.value === link.dataset.contact);
      if (selected) selected.checked = true;
      result.hidden = true;
      status.textContent = '';
      message.value = '';
      dialog.showModal();
      revealAccountSurface(dialog);
      document.body.classList.add('dialog-open');
    });
  });

  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:checked, textarea')]
      .filter(control => control.checkVisibility());
    const first = controls[0];
    const last = controls.at(-1);
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  signal?.addEventListener('abort', () => clearAccountMotion(dialog), { once: true });
  dialog.addEventListener('close', () => {
    clearAccountMotion(dialog);
    if (!dialog.isConnected) return;
    document.body.classList.remove('dialog-open');
    if (dialog.closest('[inert]')) return; // The router owns focus while changing pages.
    // A closed disclosure still has layout boxes, but cannot receive focus.
    const available = trigger?.isConnected && !trigger.closest('[inert]')
      && trigger.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    const target = available ? trigger : document.querySelector('.menu-toggle');
    target?.focus({ preventScroll: true });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const interest = new FormData(form).get('interest');
    message.value = interest === 'Ainda não sei'
      ? 'Olá! Gostaria de conhecer a Sete Passos e conversar sobre as possibilidades de atendimento. Como funciona a avaliação?'
      : `Olá! Gostaria de saber mais sobre ${String(interest).toLocaleLowerCase('pt-BR')} na Sete Passos. Como funciona a avaliação?`;
    result.hidden = false;
    status.textContent = '';
    message.focus();
  });

  copy.addEventListener('click', async () => {
    copy.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Mensagem copiada. Nenhuma mensagem foi enviada pela página.';
    } catch {
      status.textContent = 'Não foi possível copiar automaticamente. A mensagem está selecionada para você copiar manualmente.';
      message.focus();
      message.select();
    } finally {
      copy.disabled = false;
    }
  });
}
