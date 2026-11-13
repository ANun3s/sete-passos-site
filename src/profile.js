import { initProfilePresentation } from './profile-presentation.js';
import { ACCOUNT_EVENT, loginDestination, notifyAccountChanged, operationMessage, request, setAvatar, validateProfile } from './account-api.js';
import { formatCPF, formatCPFInput, isValidCPF, normalizeCPF } from './cpf.js';

export function initProfile({ signal } = {}) {
  const root = document.querySelector('#profile-root');
  if (!root) return () => {};
  const $ = selector => root.querySelector(selector);
  const content = $('#profile-content');
  const loading = $('#profile-loading');
  const loadError = $('#profile-load-error');
  const status = $('#profile-status');
  const errorBox = $('#profile-error');
  let data = null, file = null, previewURL = null, busy = false, disposed = false, redirecting = false, revision = 0;
  const alive = () => !disposed && !signal?.aborted;
  const forms = [...root.querySelectorAll('form')];

  const presentation = initProfilePresentation(root, { signal, selectFile: chooseAvatar, clearSelection: clearPreview, isBusy: () => busy });

  function feedback(message = '', error = false, field) {
    status.textContent = error ? '' : message;
    errorBox.textContent = error ? message : ''; errorBox.hidden = !error;
    root.querySelectorAll('[aria-invalid="true"]').forEach(input => { input.removeAttribute('aria-invalid'); });
    const inDialog = $('#avatar-dialog').open;
    $('#avatar-dialog-status').textContent = inDialog && !error ? message : '';
    $('#avatar-dialog-error').textContent = inDialog && error ? message : '';
    $('#avatar-dialog-error').hidden = !inDialog || !error;
    if (error && field) {
      field.setAttribute('aria-invalid', 'true');
      const ids = new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      ids.add(inDialog ? 'avatar-dialog-error' : 'profile-error'); field.setAttribute('aria-describedby', [...ids].join(' '));
      field.focus();
    } else if (error) (inDialog ? $('#avatar-dialog-error') : errorBox).focus();
  }
  function clearPreview() {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null; file = null;
    $('#avatar-file').value = ''; $('#avatar-preview').hidden = true;
    $('[data-avatar-preview]').removeAttribute('src');
  }
  function clearPasswords(form) {
    form?.querySelectorAll('input[autocomplete$="password"]').forEach(input => { input.value = ''; input.type = 'password'; });
    form?.querySelectorAll('[data-profile-password-toggle]').forEach(button => { button.textContent = 'Mostrar senha'; button.setAttribute('aria-pressed', 'false'); });
  }
  function closeEditor(form) { const details = form?.closest('details'); if (details) { details.open = false; details.querySelector('summary')?.focus(); } }
  function conceal() {
    presentation.reset(); revision++; content.hidden = true; loading.hidden = false; data = null;
    clearPreview(); forms.forEach(form => { form.reset(); delete form.dataset.dirty; clearPasswords(form); });
    $('#profile-name').textContent = ''; $('#profile-cpf').textContent = '';
    root.querySelectorAll('[data-profile-avatar]').forEach(image => setAvatar(image, null));
  }
  function expired() { if (redirecting || !alive()) return; redirecting = true; conceal(); location.replace(loginDestination()); }
  function render(result) {
    const changedAccount = data && result.user.name !== data.user.name;
    if (changedAccount) { presentation.reset(); forms.forEach(form => { form.reset(); delete form.dataset.dirty; clearPasswords(form); }); clearPreview(); }
    data = result;
    $('#profile-name').textContent = result.user.name;
    $('#profile-cpf').textContent = result.user.cpf ? formatCPF(result.user.cpf) : 'CPF ainda não vinculado';
    root.querySelectorAll('[data-profile-avatar]').forEach(image => setAvatar(image, result.user.image));
    if (!$('#profile-name-form').dataset.dirty) $('#profile-name-input').value = result.user.name;
    $('#profile-cpf-fields').disabled = !result.capabilities.cpfChange || Boolean(result.user.cpf);
    $('#profile-cpf-input').value = result.user.cpf ? formatCPF(result.user.cpf) : '';
    $('#profile-cpf-form').hidden = Boolean(result.user.cpf);
    $('#avatar-remove').hidden = !result.user.image;
    $('#avatar-remove').disabled = !result.user.image;
    $('#recovery-availability').textContent = result.capabilities.passwordReset
      ? 'Você também pode solicitar um link de recuperação de acesso.'
      : 'A recuperação por e-mail está indisponível neste ambiente. Nenhum e-mail será enviado.';
    $('#password-state').textContent = result.security.hasPassword ? 'Senha definida' : 'Esta conta não tem senha local definida.';
    const passwordForm = $('#profile-password-form');
    passwordForm.querySelectorAll('input, button').forEach(control => { control.disabled = !result.security.hasPassword; });
    const min = result.security.minPasswordLength, max = result.security.maxPasswordLength;
    $('#password-policy').textContent = `Use entre ${min} e ${max} caracteres. As outras sessões serão encerradas ao salvar.`;
    for (const input of passwordForm.querySelectorAll('input[autocomplete="new-password"]')) { input.minLength = min; input.maxLength = max; }
    loading.hidden = true; loadError.hidden = true; content.hidden = false; root.setAttribute('aria-busy', 'false');
    presentation.reveal();
  }
  async function load({ propagate = false } = {}) {
    const current = ++revision;
    try {
      const result = validateProfile(await request('/api/profile', { signal }));
      if (alive() && current === revision) render(result);
      return result;
    } catch (error) {
      if (!alive() || current !== revision) return;
      if (error.status === 401) return expired();
      if (propagate) throw error;
      loading.hidden = true; content.hidden = true; loadError.hidden = false; root.setAttribute('aria-busy', 'false');
    }
  }
  async function mutate(path, body, message, form, fieldForError) {
    if (busy || !data) return;
    const uploadedFile = path === '/api/profile/avatar' ? file : null;
    busy = true; feedback('Salvando…');
    const controls = [...root.querySelectorAll('button, input')].map(element => [element, element.disabled]);
    controls.forEach(([element]) => { element.disabled = true; });
    form?.setAttribute('aria-busy', 'true');
    try {
      await request(path, { method: 'POST', body, signal });
      if (!alive()) return;
      if (form) { delete form.dataset.dirty; clearPasswords(form); }
      if (path.includes('/avatar')) clearPreview();
      await load({ propagate: true });
      if (!alive() || !data) return;
      if (uploadedFile) presentation.remember(uploadedFile);
      feedback(message); notifyAccountChanged();
      if (form && !path.endsWith('/email')) closeEditor(form);
    } catch (error) {
      if (!alive()) return;
      if (error.status === 401 && !['INVALID_CURRENT_PASSWORD', 'INVALID_PASSWORD'].includes(error.code)) return expired();
      feedback(operationMessage(error), true, fieldForError?.(error));
    } finally {
      controls.forEach(([element, disabled]) => { element.disabled = disabled; });
      form?.removeAttribute('aria-busy'); busy = false;
      if (data) $('#avatar-remove').disabled = !data.user.image;
      if (!errorBox.hidden) form?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }

  forms.forEach(form => form.addEventListener('input', () => { form.dataset.dirty = 'true'; }, { signal }));
  $('[data-profile-retry]').addEventListener('click', () => { loadError.hidden = true; loading.hidden = false; load(); }, { signal });
  $('#profile-name-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget, input = $('#profile-name-input');
    if (form.reportValidity()) mutate('/api/profile/name', { name: input.value }, 'Nome atualizado.', form, () => input);
  }, { signal });
  $('[data-cancel-name]').addEventListener('click', () => {
    if (!data) return; const form = $('#profile-name-form'); delete form.dataset.dirty;
    $('#profile-name-input').value = data.user.name; feedback(); closeEditor(form);
  }, { signal });
  $('#profile-cpf-input').addEventListener('input', event => {
    const input = event.currentTarget;
    formatCPFInput(input);
    input.setCustomValidity(input.value && !isValidCPF(input.value) ? 'Informe um CPF válido.' : '');
  }, { signal });
  $('#profile-cpf-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    const input = form.elements.cpf;
    if (!data?.capabilities.cpfChange || !isValidCPF(input.value) || !form.reportValidity()) return;
    mutate('/api/profile/cpf', { cpf: normalizeCPF(input.value) }, 'CPF vinculado à conta.', form, () => input);
  }, { signal });
  $('#profile-password-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    const { currentPassword, newPassword, confirmPassword } = form.elements;
    if (newPassword.value !== confirmPassword.value) return feedback('A confirmação precisa ser igual à nova senha.', true, confirmPassword);
    if (!form.reportValidity()) return;
    mutate('/api/profile/password', { currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value }, 'Senha alterada. As outras sessões foram encerradas.', form, error => /CURRENT|INVALID_PASSWORD/u.test(error.code || '') ? currentPassword : newPassword);
  }, { signal });
  $('[data-cancel-password]').addEventListener('click', () => { clearPasswords($('#profile-password-form')); feedback(); closeEditor($('#profile-password-form')); }, { signal });
  root.querySelectorAll('[data-profile-password-toggle]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.profilePasswordToggle);
    const visible = input.type === 'password'; input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible)); button.textContent = visible ? 'Ocultar senha' : 'Mostrar senha';
  }, { signal }));
  root.querySelectorAll('details').forEach(details => {
    details.addEventListener('keydown', event => {
      if (event.key === 'Escape' && details.open && !busy) {
        event.preventDefault(); const form = details.querySelector('form');
        if (form?.id === 'profile-name-form') $('[data-cancel-name]').click();
        if (form?.id === 'profile-password-form') $('[data-cancel-password]').click();
      }
    }, { signal });
  });
  function chooseAvatar(selected) {
    if (busy) return;
    clearPreview(); feedback(); if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) return feedback('Escolha uma imagem de até 5 MB.', true, $('#avatar-file'));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || !/\.(jpe?g|png|webp)$/iu.test(selected.name)) return feedback('Use uma imagem JPEG, PNG ou WebP. SVG não é aceito.', true, $('#avatar-file'));
    file = selected; previewURL = URL.createObjectURL(file);
    const preview = $('[data-avatar-preview]');
    preview.onerror = () => { if (alive()) { clearPreview(); feedback('Não foi possível abrir essa imagem. Escolha outro arquivo.', true); } };
    preview.src = previewURL; $('#avatar-preview').hidden = false; $('#avatar-save').focus();
  }
  $('#avatar-file').addEventListener('change', event => chooseAvatar(event.target.files[0]), { signal });
  $('#avatar-cancel').addEventListener('click', () => { clearPreview(); feedback(); $('#avatar-file').focus(); }, { signal });
  $('#avatar-form').addEventListener('submit', event => {
    event.preventDefault(); if (!file) return;
    const body = new FormData(); body.append('photo', file);
    mutate('/api/profile/avatar', body, 'Foto atualizada.', event.currentTarget);
  }, { signal });
  $('#avatar-remove').addEventListener('click', () => mutate('/api/profile/avatar/remove', {}, 'Foto removida. O ícone padrão está ativo.'), { signal });
  $('#profile-logout').addEventListener('click', async event => {
    if (busy) return; busy = true; event.currentTarget.disabled = true;
    try { await request('/api/auth/sign-out', { method: 'POST', body: {}, signal }); if (alive()) { notifyAccountChanged('signed-out'); expired(); } }
    catch (error) { if (alive()) feedback(operationMessage(error), true); }
    finally { busy = false; $('#profile-logout').disabled = false; }
  }, { signal });
  function changed(event) {
    const kind = event.detail?.kind || event.data?.kind;
    if (kind === 'signed-out') expired();
    else if (kind === 'signed-in') { conceal(); load(); }
    else if (!busy) load();
  }
  window.addEventListener(ACCOUNT_EVENT, changed, { signal });
  window.addEventListener('focus', () => { if (!busy) load(); }, { signal });
  window.addEventListener('pageshow', event => { if (event.persisted) { conceal(); load(); } }, { signal });
  window.addEventListener('pagehide', conceal, { signal });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) load(); }, { signal });
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sete-passos-account') : null;
  channel?.addEventListener('message', changed);
  const timer = setInterval(() => { if (!busy && !document.hidden) load(); }, 60000);
  load();
  return () => { disposed = true; presentation.destroy(); revision++; clearInterval(timer); channel?.close(); clearPreview(); forms.forEach(clearPasswords); };
}
