import { gsap } from './vendor/gsap.mjs';
import { adminAccess, apiURL, request } from './account-api.js';
import { FICHA_TYPES, fichaFieldLabels, fichaGroups } from './admin-ficha-schema.js';
import { downloadFichaPdf } from './admin-ficha-pdf.js';
import { formatCPF } from './cpf.js';

const PERSONAL_FIELDS = [
  ['birthDate', 'Data de nascimento', ['birthDate']], ['age', 'Idade', ['age']], ['sex', 'Sexo', ['sex']],
  ['cpf', 'CPF', ['cpf', 'clientCpf']], ['phone', 'Telefone', ['phone', 'clientPhone']],
  ['profession', 'Profissão', ['profession']], ['address', 'Endereço', ['address', 'clientAddress']],
  ['neighborhood', 'Bairro', ['neighborhood']], ['postalCode', 'CEP', ['postalCode']],
];

function clientProfile(user) {
  const records = [...(user.fichas || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const profile = { name: user.name || '' };
  const keys = new Set(PERSONAL_FIELDS.flatMap(([, , aliases]) => aliases));
  for (const ficha of records) {
    const answers = ficha.answers && typeof ficha.answers === 'object' && !Array.isArray(ficha.answers) ? ficha.answers : {};
    for (const key of keys) {
      if (profile[key]) continue;
      const value = answers[key];
      if (typeof value === 'string' && value.trim()) profile[key] = value.trim();
    }
  }
  for (const [canonical, , aliases] of PERSONAL_FIELDS) profile[canonical] ||= aliases.map(alias => profile[alias]).find(Boolean) || '';
  return profile;
}

function fieldInput(spec, index) {
  if (spec.type === 'checks') {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'admin-form-field admin-form-fieldset';
    const legend = document.createElement('legend'); legend.textContent = spec.label; fieldset.append(legend);
    const options = document.createElement('div'); options.className = 'admin-check-options';
    for (const option of spec.options) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.name = spec.id; input.value = option;
      label.append(input, document.createTextNode(option)); options.append(label);
    }
    fieldset.append(options); return fieldset;
  }
  const label = document.createElement('label');
  label.className = `admin-form-field${spec.wide ? ' is-wide' : ''}`;
  label.append(document.createTextNode(spec.label));
  let input;
  if (spec.type === 'textarea') {
    input = document.createElement('textarea'); input.rows = spec.rows || 3; input.maxLength = 4000;
  } else if (spec.type === 'select') {
    input = document.createElement('select');
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecione'; input.append(placeholder);
    for (const option of spec.options || []) { const item = document.createElement('option'); item.value = option; item.textContent = option; input.append(item); }
  } else {
    input = document.createElement('input'); input.type = spec.type || 'text';
    if (spec.min !== undefined) input.min = String(spec.min);
    if (spec.max !== undefined) input.max = String(spec.max);
    if (spec.inputMode) input.inputMode = spec.inputMode;
    if (spec.readOnly) input.readOnly = true;
  }
  input.name = spec.id; input.id = `admin-ficha-${index}-${spec.id}`;
  if (spec.required) input.required = true;
  if (spec.value) input.value = spec.value;
  if (spec.hint) input.placeholder = spec.hint;
  label.htmlFor = input.id; label.append(input); return label;
}

function renderAnswerList(ficha) {
  const content = document.createElement('div'); content.className = 'admin-ficha-answers';
  const answers = ficha.answers && typeof ficha.answers === 'object' && !Array.isArray(ficha.answers) ? ficha.answers : {};
  const type = fichaType(ficha);
  const labels = fichaFieldLabels(type);
  let answerCount = 0;
  const appendSection = (title, fields) => {
    const section = document.createElement('section'); section.className = 'admin-ficha-answer-group';
    const heading = document.createElement('h6'); heading.textContent = title;
    const list = document.createElement('dl'); list.className = 'admin-ficha-answers';
    for (const spec of fields) {
      const raw = answers[spec.id];
      if (raw === undefined) continue;
      const value = Array.isArray(raw) ? raw.filter(item => typeof item === 'string').join(' · ') : String(raw ?? '');
      if (!value.trim()) continue;
      const item = document.createElement('div'); item.className = 'admin-ficha-answer';
      const term = document.createElement('dt'); term.textContent = spec.label;
      const description = document.createElement('dd'); description.textContent = value;
      item.append(term, description); list.append(item); answerCount++;
    }
    if (list.childElementCount) { section.append(heading, list); content.append(section); }
  };
  for (const section of fichaGroups(type)) appendSection(section.title, section.fields);
  const extraFields = Object.keys(answers)
    .filter(key => !labels.has(key) && !key.startsWith('_'))
    .map(key => ({ id: key, label: key.replace(/([A-Z])/g, ' $1').replace(/^./u, letter => letter.toLocaleUpperCase('pt-BR')) }));
  if (extraFields.length) appendSection('Outras informações', extraFields);
  if (answerCount) return content;
  for (const [key, raw] of Object.entries(answers)) {
    if (key.startsWith('_')) continue;
    const value = Array.isArray(raw) ? raw.filter(item => typeof item === 'string').join(' · ') : String(raw ?? '');
    if (!value.trim()) continue;
    const item = document.createElement('div'); item.className = 'admin-ficha-answer';
    const term = document.createElement('dt'); term.textContent = labels.get(key) || key;
    const description = document.createElement('dd'); description.textContent = value;
    item.append(term, description); content.append(item); answerCount++;
  }
  if (answerCount) return content;
  if (content.childElementCount) return content;
  const legacy = document.createElement('p'); legacy.className = 'admin-ficha-content'; legacy.textContent = ficha.content || 'Nenhuma resposta preenchida.';
  return legacy;
}

function fichaType(ficha) {
  return ficha.answers?._formType || ficha.type;
}

export function initAdmin({ signal } = {}) {
  const page = document.querySelector('#page-content[data-page="admin"]');
  if (!page) return () => {};
  let disposed = false;
  const abort = new AbortController();
  signal?.addEventListener('abort', () => abort.abort(), { once: true });
  const main = page.querySelector('.admin-main');

  function fail(message) {
    if (disposed || abort.signal.aborted) return;
    main.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'admin-error'; notice.setAttribute('role', 'alert'); notice.textContent = message;
    main.append(notice); main.setAttribute('aria-busy', 'false');
  }

  async function start() {
    try {
      const access = await adminAccess(abort.signal);
      if (disposed || abort.signal.aborted) return;
      if (access.authorized !== true || typeof access.user?.name !== 'string') {
        location.replace('/index.html'); return;
      }
      main.innerHTML = `<div class="admin-workspace" data-admin-workspace>
        <aside class="admin-sidebar" aria-label="Seções administrativas">
          <p class="admin-sidebar-label">ÁREA DE ADMINISTRAÇÃO</p>
          <nav class="admin-sections" aria-label="Navegação administrativa">
            <a href="#admin-overview" data-admin-section="overview">Visão geral</a>
            <a href="#admin-people" data-admin-section="people">Pessoas e acessos</a>
            <a href="#admin-fichas" data-admin-section="fichas">Fichas</a>
          </nav>
        </aside>
        <div class="admin-content">
          <header class="admin-welcome"><p class="section-label">ESPAÇO RESERVADO</p><h1>Olá, <em></em></h1><p>Este espaço reúne os recursos administrativos disponíveis para sua conta.</p></header>
          <section class="admin-overview" id="admin-overview" aria-labelledby="admin-overview-title">
            <h2 id="admin-overview-title" tabindex="-1">Tudo em um só lugar.</h2><p>Consulte os acessos, os perfis e as fichas vinculadas a cada pessoa.</p>
            <div class="admin-overview-card"><span>Pessoas e acessos</span><a href="#admin-people" data-admin-section="people">Ver perfis <span aria-hidden="true">↗</span></a></div>
            <div class="admin-overview-card"><span>Biblioteca de modelos</span><a href="#admin-fichas" data-admin-section="fichas">Acessar modelos <span aria-hidden="true">↗</span></a></div>
          </section>
          <section class="admin-people" id="admin-people" aria-labelledby="admin-people-title" hidden>
            <header class="admin-section-heading"><p class="section-label">CONTAS E PRONTUÁRIOS</p><h2 id="admin-people-title" tabindex="-1">Pessoas e fichas</h2><p>As sessões ativas refletem sessões válidas no momento da consulta.</p></header>
            <div class="admin-ficha-storage-notice" data-admin-storage-notice hidden role="status"></div>
            <div class="admin-people-toolbar"><p data-admin-people-count aria-live="polite">Carregando perfis…</p><label>Buscar perfil<input type="search" data-admin-user-search placeholder="Nome ou e-mail" autocomplete="off"></label></div>
            <div class="admin-user-list" data-admin-user-list></div>
          </section>
          <section class="admin-records" id="admin-fichas" aria-labelledby="admin-fichas-title" hidden>
            <header class="admin-section-heading admin-fichas-heading"><p class="section-label">ATENDIMENTO INDIVIDUAL</p><h2 id="admin-fichas-title" tabindex="-1">Fichas</h2><p>Escolha um perfil para preencher uma ficha vinculada ao cliente. Os modelos abaixo servem como referência visual.</p><a class="admin-open-person" href="#admin-people" data-admin-section="people">Abrir perfis e preencher uma ficha</a></header>
            <div data-admin-fichas-content aria-live="polite"></div>
          </section>
        </div>
      </div>`;
      main.querySelector('.admin-welcome h1 em').textContent = access.user.name;
      main.setAttribute('aria-busy', 'false');
      const navLinks = [...main.querySelectorAll('[data-admin-section]')];
      const overview = main.querySelector('#admin-overview');
      const people = main.querySelector('#admin-people');
      const records = main.querySelector('#admin-fichas');
      const recordsContent = main.querySelector('[data-admin-fichas-content]');
      const usersList = main.querySelector('[data-admin-user-list]');
      const usersCount = main.querySelector('[data-admin-people-count]');
      const toolbar = main.querySelector('.admin-people-toolbar');
      const storageNotice = main.querySelector('[data-admin-storage-notice]');
      const search = main.querySelector('[data-admin-user-search]');
      let loadedRecords = false;
      let loadedUsers = false;
      let userRows = [];
      let activeUser = null;
      let fichaFormIndex = 0;
      const fichaTypes = FICHA_TYPES;
      const dateLabel = value => {
        const date = new Date(value);
        return Number.isNaN(date.valueOf()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      };
      function renderUsers() {
        toolbar.hidden = Boolean(activeUser);
        if (activeUser) { renderPerson(activeUser); return; }
        const term = search.value.trim().toLocaleLowerCase('pt-BR');
        const visible = userRows.filter(user => `${user.name} ${user.cpf || ''}`.toLocaleLowerCase('pt-BR').includes(term));
        usersCount.textContent = `${visible.length} ${visible.length === 1 ? 'perfil' : 'perfis'}`;
        if (!visible.length) { usersList.textContent = term ? 'Nenhum perfil corresponde à busca.' : 'Ainda não há perfis cadastrados.'; return; }
        const cards = visible.map(user => {
          const article = document.createElement('article'); article.className = 'admin-user-card';
          const heading = document.createElement('header'); heading.className = 'admin-user-heading';
          const identity = document.createElement('div');
          const name = document.createElement('button'); name.type = 'button'; name.className = 'admin-user-name'; name.textContent = user.name; name.setAttribute('aria-label', `Abrir perfil e fichas de ${user.name}`);
          name.addEventListener('click', () => { activeUser = user; renderUsers(); }, { signal: abort.signal });
          const cpf = document.createElement('p'); cpf.className = 'admin-user-email'; cpf.textContent = user.cpf ? formatCPF(user.cpf) : 'CPF pendente de vínculo';
          identity.append(name, cpf);
          const status = document.createElement('span'); status.className = `admin-session-status${user.activeSessions ? ' is-active' : ''}`;
          status.textContent = user.activeSessions ? `${user.activeSessions} ${user.activeSessions === 1 ? 'sessão ativa' : 'sessões ativas'}` : 'Sem sessão ativa';
          heading.append(identity, status); article.append(heading);
          const meta = document.createElement('p'); meta.className = 'admin-user-meta'; meta.textContent = `Perfil criado ${dateLabel(user.createdAt)}`; article.append(meta);
          const recordTitle = document.createElement('h4'); recordTitle.className = 'admin-user-fichas-title'; recordTitle.textContent = `Fichas vinculadas · ${user.fichas.length}`; article.append(recordTitle);
          if (user.fichas.length) {
            const fichas = document.createElement('div'); fichas.className = 'admin-user-fichas';
            for (const ficha of user.fichas) {
              const record = document.createElement('section'); record.className = 'admin-personal-ficha';
              const title = document.createElement('h5'); title.textContent = ficha.title;
              const category = document.createElement('p'); category.className = 'admin-ficha-meta'; category.textContent = `${fichaTypes[fichaType(ficha)] || 'Ficha'} · ${dateLabel(ficha.createdAt)}`;
              const content = document.createElement('p'); content.className = 'admin-ficha-content'; content.textContent = ficha.content;
              record.append(title, category, content); fichas.append(record);
            }
            article.append(fichas);
          } else {
            const empty = document.createElement('p'); empty.className = 'admin-user-empty'; empty.textContent = userRows.storageAvailable === false ? 'As fichas ficarão disponíveis após ativar o armazenamento.' : 'Nenhuma ficha individual cadastrada.'; article.append(empty);
          }
          const open = document.createElement('button'); open.type = 'button'; open.className = 'admin-open-person'; open.textContent = 'Abrir perfil e fichas';
          open.addEventListener('click', () => { activeUser = user; renderUsers(); }, { signal: abort.signal });
          article.append(open); return article;
        });
        usersList.replaceChildren(...cards);
      }
      function renderPerson(user) {
        const panel = document.createElement('div'); panel.className = 'admin-client-detail';
        const back = document.createElement('button'); back.type = 'button'; back.className = 'admin-client-back'; back.textContent = '← Voltar para perfis';
        back.addEventListener('click', () => { activeUser = null; renderUsers(); search.focus(); }, { signal: abort.signal });
        const header = document.createElement('header'); header.className = 'admin-client-header';
        const eyebrow = document.createElement('p'); eyebrow.className = 'section-label'; eyebrow.textContent = 'PERFIL DO CLIENTE';
        const title = document.createElement('h3'); title.tabIndex = -1; title.textContent = user.name;
        const cpf = document.createElement('p'); cpf.textContent = user.cpf ? formatCPF(user.cpf) : 'CPF pendente de vínculo';
        header.append(eyebrow, title, cpf);
        const profile = clientProfile(user);
        const personal = document.createElement('section'); personal.className = 'admin-client-account admin-client-personal';
        const personalTitle = document.createElement('h4'); personalTitle.textContent = 'Informações pessoais'; personal.append(personalTitle);
        const personalList = document.createElement('dl'); personalList.className = 'admin-ficha-answers';
        const personalValues = [['Nome completo', user.name], ['CPF', user.cpf ? formatCPF(user.cpf) : ''], ...PERSONAL_FIELDS.map(([key, label]) => [label, profile[key]])].filter(([, value]) => typeof value === 'string' && value.trim());
        for (const [labelText, valueText] of personalValues) { const item = document.createElement('div'); item.className = 'admin-ficha-answer'; const term = document.createElement('dt'); term.textContent = labelText; const desc = document.createElement('dd'); desc.textContent = valueText; item.append(term, desc); personalList.append(item); }
        personal.append(personalList);
        const account = document.createElement('section'); account.className = 'admin-client-account';
        const accountTitle = document.createElement('h4'); accountTitle.textContent = 'Informações da conta'; account.append(accountTitle);
        const accountList = document.createElement('dl'); accountList.className = 'admin-ficha-answers';
        const accountValues = [
          ['CPF', user.cpf ? formatCPF(user.cpf) : 'Pendente de vínculo'],
          ['Perfil criado', dateLabel(user.createdAt)], ['Acessos ativos', `${user.activeSessions} ${user.activeSessions === 1 ? 'sessão ativa' : 'sessões ativas'}`],
        ];
        for (const [labelText, valueText] of accountValues) { const item = document.createElement('div'); item.className = 'admin-ficha-answer'; const term = document.createElement('dt'); term.textContent = labelText; const desc = document.createElement('dd'); desc.textContent = valueText; item.append(term, desc); accountList.append(item); }
        account.append(accountList);
        const recordsHeading = document.createElement('header'); recordsHeading.className = 'admin-client-records-heading';
        const recordsTitle = document.createElement('h4'); recordsTitle.textContent = `Fichas preenchidas · ${user.fichas.length}`; recordsHeading.append(recordsTitle);
        const records = document.createElement('section'); records.className = 'admin-client-records'; records.setAttribute('aria-label', 'Fichas do cliente');
        if (user.fichas.length) {
          user.fichas.forEach(ficha => {
            const record = document.createElement('article'); record.className = 'admin-personal-ficha';
            const recordTitle = document.createElement('h5'); recordTitle.textContent = ficha.title;
            const meta = document.createElement('p'); meta.className = 'admin-ficha-meta'; meta.textContent = `${fichaTypes[fichaType(ficha)] || 'Ficha'} · ${dateLabel(ficha.createdAt)}`;
            const actions = document.createElement('div'); actions.className = 'admin-ficha-actions';
            const download = document.createElement('button'); download.type = 'button'; download.className = 'admin-ficha-download'; download.textContent = 'Baixar PDF';
            download.setAttribute('aria-label', `Baixar ${ficha.title} de ${user.name} em PDF`);
            download.addEventListener('click', () => downloadFichaPdf(ficha, user), { signal: abort.signal });
            actions.append(download);
            record.append(recordTitle, meta, actions, renderAnswerList(ficha)); records.append(record);
          });
        } else {
          const empty = document.createElement('p'); empty.className = 'admin-user-empty'; empty.textContent = userRows.storageAvailable === false ? 'O armazenamento de fichas precisa ser ativado para registrar informações.' : 'Este perfil ainda não tem fichas preenchidas.'; records.append(empty);
        }
        const formDisclosure = document.createElement('details'); formDisclosure.className = 'admin-add-ficha';
        const summary = document.createElement('summary'); summary.textContent = 'Preencher ficha com o cliente'; formDisclosure.append(summary);
        const form = document.createElement('form'); form.className = 'admin-ficha-form admin-clinical-form';
        const typeField = document.createElement('label'); typeField.className = 'admin-form-field'; typeField.append(document.createTextNode('Modelo de ficha'));
        const typeSelect = document.createElement('select'); typeSelect.name = 'type'; typeSelect.required = true;
        for (const typeName of Object.keys(fichaTypes)) { const option = document.createElement('option'); option.value = typeName; option.textContent = fichaTypes[typeName]; typeSelect.append(option); }
        typeField.append(typeSelect);
        const titleField = document.createElement('label'); titleField.className = 'admin-form-field'; titleField.append(document.createTextNode('Nome desta ficha'));
        const titleInput = document.createElement('input'); titleInput.name = 'title'; titleInput.required = true; titleInput.maxLength = 160; titleInput.value = fichaTypes[typeSelect.value]; titleField.append(titleInput);
        const sections = document.createElement('div'); sections.className = 'admin-ficha-sections';
        const privacy = document.createElement('p'); privacy.className = 'admin-ficha-privacy'; privacy.textContent = 'Revise as respostas com o cliente antes de salvar. O acesso a estas informações fica restrito à administração.';
        const feedback = document.createElement('p'); feedback.className = 'admin-ficha-feedback'; feedback.setAttribute('role', 'status');
        const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Salvar ficha preenchida';
        const buildFields = () => {
          titleInput.value = fichaTypes[typeSelect.value];
          sections.replaceChildren(...fichaGroups(typeSelect.value, user, profile).map((section, sectionIndex) => {
            const disclosure = document.createElement('details'); disclosure.className = 'admin-ficha-form-section'; disclosure.open = sectionIndex === 0;
            const sectionTitle = document.createElement('summary'); sectionTitle.textContent = section.title; disclosure.append(sectionTitle);
            const grid = document.createElement('div'); grid.className = 'admin-form-grid';
            section.fields.forEach(spec => grid.append(fieldInput(spec, fichaFormIndex++)));
            disclosure.append(grid); return disclosure;
          }));
        };
        typeSelect.addEventListener('change', buildFields, { signal: abort.signal });
        buildFields();
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const invalid = form.querySelector(':invalid');
          if (invalid) {
            const disclosure = invalid.closest('.admin-ficha-form-section');
            if (disclosure) disclosure.open = true;
            invalid.focus(); invalid.reportValidity(); return;
          }
          submit.disabled = true; feedback.textContent = 'Salvando ficha…';
          const fields = {};
          for (const input of form.querySelectorAll('[name]')) {
            if (input.name === 'type' || input.name === 'title') continue;
            if (input.type === 'checkbox') { (fields[input.name] ||= []); if (input.checked) fields[input.name].push(input.value); }
            else fields[input.name] = input.value;
          }
          let saved = false;
          try {
            await request('/api/admin/fichas', { method: 'POST', signal: abort.signal, body: { userId: user.id, type: typeSelect.value, title: titleInput.value, content: titleInput.value, fields } });
            saved = true;
            const result = await request('/api/admin/users', { signal: abort.signal });
            userRows = result.users; userRows.storageAvailable = result.fichasStorageAvailable;
            activeUser = userRows.find(item => item.id === user.id) || null;
            if (activeUser) renderUsers(); else feedback.textContent = 'A ficha foi salva, mas o perfil não apareceu na lista atualizada. Atualize para conferir.';
          } catch (error) {
            feedback.textContent = saved ? 'A ficha foi salva, mas a lista não atualizou. Atualize a página para conferir.' : error.code === 'ADMIN_FICHA_STORAGE_UNAVAILABLE' ? 'O armazenamento ainda precisa ser ativado no banco.' : error.code === 'USER_NOT_FOUND' ? 'Este perfil não está mais disponível.' : 'Não foi possível salvar. Revise os campos e tente novamente.';
            submit.disabled = false;
          }
        }, { signal: abort.signal });
        form.append(typeField, titleField, sections, privacy, feedback, submit);
        if (userRows.storageAvailable === false) formDisclosure.hidden = true;
        panel.append(back, header, personal, account, recordsHeading, records, formDisclosure);
        usersList.replaceChildren(panel);
        title.focus({ preventScroll: true });
      }
      async function loadUsers() {
        usersCount.textContent = 'Carregando perfis…';
        try {
          const result = await request('/api/admin/users', { signal: abort.signal });
          if (disposed || abort.signal.aborted) return;
          userRows = result.users; userRows.storageAvailable = result.fichasStorageAvailable;
          storageNotice.hidden = result.fichasStorageAvailable;
          if (!result.fichasStorageAvailable) storageNotice.textContent = 'O armazenamento de fichas ainda não foi ativado. Os perfis continuam disponíveis para consulta.';
          loadedUsers = true; renderUsers();
        } catch {
          usersList.textContent = 'Não foi possível carregar os perfis. Tente novamente.'; usersCount.textContent = '';
        }
      }
      search.addEventListener('input', renderUsers, { signal: abort.signal });
      async function showSection(section, focus = false) {
        const selected = ['fichas', 'people'].includes(section) ? section : 'overview';
        overview.hidden = selected !== 'overview'; records.hidden = selected !== 'fichas'; people.hidden = selected !== 'people';
        navLinks.forEach(item => item.setAttribute('aria-current', item.dataset.adminSection === selected ? 'page' : 'false'));
        if (selected === 'people' && !loadedUsers) await loadUsers();
        if (selected === 'fichas' && !loadedRecords) {
          recordsContent.textContent = 'Carregando os modelos…';
          try {
            const result = await request('/api/admin/fichas', { signal: abort.signal });
            if (disposed || abort.signal.aborted) return;
            const parsed = new DOMParser().parseFromString(`<main>${result.html}</main>`, 'text/html');
            if (!parsed.querySelector('.records-library .record-card')) throw new Error('Conteúdo inválido');
            const fragment = document.createDocumentFragment();
            [...parsed.body.querySelector('main').childNodes].forEach(node => fragment.append(document.importNode(node, true)));
            const wrapper = document.createElement('div'); wrapper.append(fragment);
            wrapper.querySelectorAll('[src], [href]').forEach(element => {
              for (const attribute of ['src', 'href']) {
                const value = element.getAttribute(attribute);
                if (value?.startsWith('/api/admin/mockups/')) element.setAttribute(attribute, apiURL(value));
              }
            });
            recordsContent.replaceChildren(...wrapper.childNodes);
            loadedRecords = true;
          } catch {
            if (!disposed && !abort.signal.aborted) recordsContent.textContent = 'Não foi possível carregar os modelos. Tente novamente.';
          }
        }
        if (focus) (selected === 'fichas' ? records.querySelector('h2') : selected === 'people' ? people.querySelector('h2') : overview.querySelector('h2'))?.focus({ preventScroll: true });
      }
      main.addEventListener('click', event => {
        const link = event.target.closest('[data-admin-section]');
        if (!link) return;
        event.preventDefault();
        const section = link.dataset.adminSection;
        history.replaceState(history.state, '', `${location.pathname}?section=${section}`);
        void showSection(section, true);
      }, { signal: abort.signal });
      await showSection(new URLSearchParams(location.search).get('section'));
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !abort.signal.aborted) {
        gsap.fromTo('[data-admin-workspace]', { y: 9, opacity: 0 }, { y: 0, opacity: 1, duration: .38, ease: 'power2.out', clearProps: 'transform,opacity' });
      }
    } catch (error) {
      if (disposed || abort.signal.aborted) return;
      if (error.status === 401) {
        location.replace(`/login.html?returnTo=${encodeURIComponent('/admin.html')}`); return;
      }
      if (error.status === 403) { location.replace('/index.html'); return; }
      fail('Não foi possível confirmar seu acesso agora. Atualize a página para tentar novamente.');
    }
  }
  void start();
  return () => { disposed = true; abort.abort(); gsap.killTweensOf('[data-admin-workspace]'); };
}
