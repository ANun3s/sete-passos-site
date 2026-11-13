import { notifyAccountChanged, operationMessage, request, safeReturnTo, session } from './account-api.js';
import { formatCPF, formatCPFInput, isValidCPF, normalizeCPF } from './cpf.js';
import { looksLikeEmailIdentifier, parseLoginIdentifier } from './login-identifier.js';

export function initAuth({ signal } = {}) {
  const root = document.querySelector('#auth-root');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const forms = { login: $('#login-form'), register: $('#register-form'), recover: $('#recover-form'), reset: $('#reset-form') };
  const status = $('#auth-status'), error = $('#auth-error');
  const googleButton = $('#google-login-button');
  const url = new URL(location.href);
  const destination = safeReturnTo(url.searchParams.get('returnTo'));
  let token = url.searchParams.get('token') || '';
  let view = ['recover', 'reset'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'login';
  let busy = false, revision = 0, recoveryEnabled = false;
  // Consume only in memory. Do not leave a reset token in browser history or referrers.
  if (url.searchParams.has('token')) { url.searchParams.delete('token'); history.replaceState(history.state, '', url.pathname + url.search + url.hash); }
  const alive = () => !signal?.aborted;
  function clearError() {
    error.hidden = true; error.textContent = '';
    root.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  }
  function report(message, field) {
    status.textContent = ''; error.textContent = message; error.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'auth-error'); field.focus(); }
    else error.focus();
  }
  function clearPasswords() {
    root.querySelectorAll('input[autocomplete$="password"]').forEach(input => { input.value = ''; input.type = 'password'; input.setCustomValidity(''); });
    root.querySelectorAll('[data-password-toggle]').forEach(button => { button.textContent = 'Mostrar senha'; button.setAttribute('aria-pressed', 'false'); });
  }
  function setBusy(value, message = '') {
    busy = value; root.setAttribute('aria-busy', String(value));
    root.querySelectorAll('button').forEach(button => { button.disabled = value; });
    googleButton?.setAttribute('aria-disabled', String(value));
    for (const [key, form] of Object.entries(forms)) form.querySelector('fieldset').disabled = value || (['recover', 'reset'].includes(key) && (!recoveryEnabled || (key === 'reset' && !token)));
    status.textContent = message;
  }
  function showForm(next, focus = true) {
    view = next; clearPasswords(); clearError(); $('#account-panel').hidden = true;
    for (const [key, form] of Object.entries(forms)) form.hidden = key !== view;
    $('#access-title').textContent = { login: 'Acesse sua conta', register: 'Crie sua conta', recover: 'Recuperar acesso', reset: 'Defina uma nova senha' }[view];
    setBusy(false);
    if (view === 'reset' && !token) report('Este link está incompleto ou já foi usado nesta página. Solicite outro link de recuperação.');
    if (focus) forms[view].querySelector('input:not(:disabled)')?.focus();
  }
  function authenticated() { clearPasswords(); notifyAccountChanged('signed-in'); location.assign(destination); }
  function message(failure, action) {
    if (failure.status === 429) return 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.';
    if (!failure.status || failure.status >= 500 || failure.status === 404) return 'Não foi possível conectar ao servidor. Verifique se o backend local está rodando e tente novamente.';
    if (failure.code === 'INVALID_CPF') return 'Informe um CPF válido.';
    if (failure.code === 'INVALID_EMAIL') return 'Informe um e-mail válido.';
    if (failure.code === 'EMAIL_SIGNUP_REQUIRES_VERIFICATION') return 'Este e-mail é reservado à conta administrativa. Entre pela opção Google da conta autorizada.';
    if (action === 'login') return 'Não foi possível entrar. Confira o CPF ou e-mail e a senha.';
    return 'Não foi possível concluir o cadastro. Confira os campos e se o cadastro local está habilitado.';
  }
  root.querySelectorAll('[data-auth-view]').forEach(button => button.addEventListener('click', () => {
    if (!busy) { revision++; showForm(button.dataset.authView); }
  }, { signal }));
  root.querySelectorAll('[data-password-toggle]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordToggle), visible = input.type === 'password';
    input.type = visible ? 'text' : 'password'; button.textContent = visible ? 'Ocultar senha' : 'Mostrar senha'; button.setAttribute('aria-pressed', String(visible));
  }, { signal }));
  const identifierDrafts = new WeakMap();
  for (const input of [$('#login-cpf'), $('#register-cpf')]) input.addEventListener('input', event => {
    const previous = identifierDrafts.get(input);
    if (input.value && looksLikeEmailIdentifier(input.value, event.data)) {
      let value = input.value;
      const insertedEmailCharacter = typeof event.data === 'string' && event.data.length === 1 && /[._+@a-z-]/iu.test(event.data);
      const cursorAtEnd = input.selectionStart === input.value.length;
      if (previous?.mode === 'cpf' && insertedEmailCharacter && cursorAtEnd && /^\d+$/u.test(previous.raw)) {
        // Undo digits inserted through the CPF mask when the customer starts
        // an email such as 1234@gmail.com, then continue with the raw text.
        value = previous.raw + event.data;
        input.value = value;
      }
      identifierDrafts.set(input, { mode: 'email', raw: value });
      input.setCustomValidity('');
      return;
    }
    if (!input.value) {
      identifierDrafts.delete(input);
      input.setCustomValidity('');
      return;
    }
    formatCPFInput(input);
    identifierDrafts.set(input, { mode: 'cpf', raw: normalizeCPF(input.value) });
    input.setCustomValidity(input === $('#register-cpf') && !isValidCPF(input.value) ? 'Informe um CPF válido.' : '');
  }, { signal });
  forms.register.addEventListener('input', () => $('#register-confirm').setCustomValidity(''), { signal });
  async function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return window.google.accounts.id;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google Identity Services indisponível'));
      document.head.append(script);
    });
    if (!window.google?.accounts?.id) throw new Error('Google Identity Services indisponível');
    return window.google.accounts.id;
  }
  async function onGoogleCredential(response) {
    if (busy || !response?.credential || !alive()) return;
    revision++; clearError(); setBusy(true, 'Verificando sua conta Google…');
    try {
      const nonce = googleNonce;
      if (!nonce) throw new Error('Nonce Google ausente');
      await request('/api/auth/sign-in/social', {
        method: 'POST', signal,
        body: { provider: 'google', idToken: { token: response.credential, nonce } },
      });
      const account = await session(signal);
      if (!account?.user) throw new Error('Sessão Google indisponível');
      if (alive()) authenticated();
    } catch (failure) {
      if (alive()) {
        setBusy(false);
        report(failure.status >= 500 ? 'Não foi possível validar sua conta Google. Tente novamente.' : 'Não foi possível entrar com esta conta Google.');
      }
    }
  }
  let googleNonce = '';
  for (const action of ['login', 'register']) {
    const form = forms[action];
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const values = Object.fromEntries(new FormData(form));
      const cpfInput = form.elements.identifier;
      const identity = parseLoginIdentifier(values.identifier);
      if (!['cpf', 'email'].includes(identity.type)) {
        const validationMessage = identity.type === 'invalid-email' ? 'Informe um e-mail válido.' : 'Informe um CPF válido.';
        cpfInput.setCustomValidity(validationMessage);
        cpfInput.reportValidity(); return;
      }
      if (action === 'register' && values.password !== values.confirmPassword) {
        $('#register-confirm').setCustomValidity('As senhas precisam ser iguais.');
        report('As senhas precisam ser iguais.', $('#register-confirm')); return;
      }
      if (!form.reportValidity()) return;
      revision++; clearError(); setBusy(true, action === 'login' ? 'Entrando…' : 'Criando conta…');
      try {
        await request(`/api/auth/${action === 'login' ? 'sign-in' : 'sign-up'}/email`, { method: 'POST', signal, body: {
          identifier: identity.value, password: values.password,
          ...(action === 'register' ? { name: values.name.trim() } : { rememberMe: true }),
        } });
        if (!alive()) return;
        if (action === 'login') {
          const account = await session(signal);
          if (!account?.user) throw new Error('Sessão indisponível');
          if (alive()) authenticated();
        } else {
          // Registration retains the existing explicit sign-in step.
          setBusy(false); showForm('login'); forms.login.elements.identifier.value = identity.type === 'cpf' ? formatCPF(identity.value) : identity.value;
          status.textContent = 'Solicitação processada. Se os dados estavam disponíveis, sua conta foi criada. Entre com o identificador escolhido e a senha.';
          forms.login.elements.password.focus();
        }
      } catch (failure) { if (alive()) { setBusy(false); report(message(failure, action)); } }
      finally { clearPasswords(); }
    }, { signal });
  }
  forms.recover.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !recoveryEnabled || !forms.recover.reportValidity()) return;
    const email = forms.recover.elements.email.value.trim(); revision++; clearError(); setBusy(true, 'Solicitando recuperação…');
    try {
      await request('/api/auth/request-password-reset', { method: 'POST', signal, body: { email, redirectTo: `${location.origin}/login.html?view=reset` } });
      if (alive()) setBusy(false, 'Solicitação processada. Se houver uma conta elegível, você receberá as instruções de recuperação. Por segurança, não confirmamos cadastros.');
    } catch (failure) { if (alive()) { setBusy(false); report(operationMessage(failure)); } }
  }, { signal });
  forms.reset.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !recoveryEnabled || !token) return;
    const { newPassword, confirmPassword } = forms.reset.elements;
    if (newPassword.value !== confirmPassword.value) return report('A confirmação precisa ser igual à nova senha.', confirmPassword);
    if (!forms.reset.reportValidity()) return;
    revision++; clearError(); setBusy(true, 'Salvando nova senha…');
    try {
      await request('/api/auth/reset-password', { method: 'POST', signal, body: { token, newPassword: newPassword.value } });
      if (alive()) { token = ''; showForm('login'); status.textContent = 'Senha atualizada. Entre com sua nova senha.'; notifyAccountChanged('signed-out'); }
    } catch (failure) { if (alive()) { setBusy(false); report(operationMessage(failure)); } }
  }, { signal });
  showForm(view, false);
  const initialRevision = revision;
  session(signal).then(result => {
    if (alive() && result?.user && view === 'login' && revision === initialRevision && !busy) authenticated();
  }).catch(() => {});
  request('/api/health', { signal }).then(async result => {
    if (!alive()) return;
    recoveryEnabled = Boolean(result.capabilities?.passwordReset);
    const googleClientId = result.googleClientId;
    const googleLoginEnabled = Boolean(result.capabilities?.googleLogin && typeof googleClientId === 'string' && googleClientId);
    googleButton.hidden = !googleLoginEnabled;
    $('#google-login-status').hidden = !googleLoginEnabled;
    if (googleLoginEnabled) {
      try {
        const googleId = await loadGoogleIdentityServices();
        if (!alive()) return;
        googleNonce = [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
        googleId.initialize({ client_id: googleClientId, nonce: googleNonce, callback: onGoogleCredential, auto_select: false });
        googleId.renderButton(googleButton, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: Math.min(400, Math.max(240, Math.floor(googleButton.getBoundingClientRect().width))), locale: 'pt_BR' });
        $('#google-login-status').textContent = 'Acesse usando uma conta Google.';
      } catch {
        googleButton.hidden = true;
        $('#google-login-status').hidden = false;
        $('#google-login-status').textContent = 'Não foi possível carregar o acesso pelo Google. Tente novamente mais tarde.';
      }
    } else $('#google-login-status').textContent = 'O acesso pelo Google ficará disponível após configurar o Client ID do Google no servidor.';
    $('#auth-email-availability').textContent = recoveryEnabled
      ? 'O link de recuperação é temporário e de uso único.'
      : 'A recuperação e a confirmação por e-mail estão indisponíveis. Cadastros com e-mail não recebem confirmação nem recuperação de senha.';
    if (!busy) {
      forms.recover.querySelector('fieldset').disabled = !recoveryEnabled;
      forms.reset.querySelector('fieldset').disabled = !recoveryEnabled || !token;
    }
  }).catch(() => {
    if (!alive()) return;
    $('#auth-email-availability').textContent = 'Não foi possível verificar o serviço de recuperação. Tente novamente quando o servidor estiver disponível.';
    googleButton.hidden = true;
    $('#google-login-status').hidden = false;
    $('#google-login-status').textContent = 'Não foi possível verificar a configuração do login Google. Tente novamente mais tarde.';
  });
  signal?.addEventListener('abort', () => { token = ''; clearPasswords(); }, { once: true });
}
