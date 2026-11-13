import { fichaGroups } from './admin-ficha-schema.js';

const encoder = new TextEncoder();
const winAnsi = new Map([
  ['€', 0x80], ['‚', 0x82], ['ƒ', 0x83], ['„', 0x84], ['…', 0x85], ['†', 0x86], ['‡', 0x87], ['ˆ', 0x88], ['‰', 0x89], ['Š', 0x8a], ['‹', 0x8b], ['Œ', 0x8c], ['Ž', 0x8e],
  ['‘', 0x91], ['’', 0x92], ['“', 0x93], ['”', 0x94], ['•', 0x95], ['–', 0x96], ['—', 0x97], ['˜', 0x98], ['™', 0x99], ['š', 0x9a], ['›', 0x9b], ['œ', 0x9c], ['ž', 0x9e], ['Ÿ', 0x9f],
]);

function pdfText(value) {
  return Array.from(String(value ?? '')).map(character => {
    const code = character.codePointAt(0);
    const byte = code <= 0xff ? code : winAnsi.get(character);
    if (byte === undefined || byte < 0x20) return ' ';
    return byte < 0x80 && byte >= 0x20 ? character.replace(/[()\\]/gu, '\\$&') : `\\${byte.toString(8).padStart(3, '0')}`;
  }).join('');
}

function wrap(value, max = 94) {
  const words = String(value ?? '').replace(/\s+/gu, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return ['—'];
  const lines = [];
  let line = '';
  for (const word of words) {
    const parts = word.length > max ? word.match(new RegExp(`.{1,${max}}`, 'gu')) : [word];
    for (const part of parts || []) {
      if (line && `${line} ${part}`.length > max) { lines.push(line); line = part; }
      else line = line ? `${line} ${part}` : part;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function visibleAnswers(ficha) {
  const answers = ficha.answers && typeof ficha.answers === 'object' && !Array.isArray(ficha.answers) ? ficha.answers : {};
  const sections = fichaGroups(answers._formType || ficha.type).map(section => ({
    title: section.title,
    items: section.fields.flatMap(spec => {
      const value = answers[spec.id];
      const text = Array.isArray(value) ? value.filter(item => typeof item === 'string').join(' · ') : String(value ?? '');
      return text.trim() ? [[spec.label, text]] : [];
    }),
  })).filter(section => section.items.length);
  const known = new Set(fichaGroups(answers._formType || ficha.type).flatMap(section => section.fields.map(spec => spec.id)));
  const extra = Object.entries(answers).filter(([key, value]) => !known.has(key) && !key.startsWith('_') && value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => [key.replace(/([A-Z])/gu, ' $1').replace(/^./u, letter => letter.toLocaleUpperCase('pt-BR')), Array.isArray(value) ? value.join(' · ') : String(value)]);
  if (extra.length) sections.push({ title: 'Outras informações', items: extra });
  if (!sections.length && ficha.content) sections.push({ title: 'Informações registradas', items: [['Registro', ficha.content]] });
  return sections;
}

function makePages(ficha, user) {
  const created = new Date(ficha.createdAt);
  const createdLabel = Number.isNaN(created.valueOf()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(created);
  const type = ficha.answers?._formType === 'proposta-tratamento' || ficha.type === 'proposta-tratamento' ? 'Proposta de tratamento' : ficha.type === 'avaliacao-fisioterapeutica' ? 'Avaliação fisioterapêutica' : 'Ficha de atendimento';
  const pages = [[]];
  let y = 748;
  const nextPage = () => { pages.push([]); y = 748; };
  const addLine = (text, { font = 'F1', size = 10, indent = 0, gap = 14 } = {}) => {
    if (y < 60) nextPage();
    pages[pages.length - 1].push(`BT /${font} ${size} Tf 1 0 0 1 ${48 + indent} ${y} Tm (${pdfText(text)}) Tj ET`);
    y -= gap;
  };

  addLine('SETE PASSOS  |  FISIOTERAPIA', { font: 'F2', size: 9, gap: 23 });
  addLine(ficha.title || type, { font: 'F2', size: 18, gap: 26 });
  addLine(`${type}  ·  ${createdLabel}`, { size: 9, gap: 21 });
  addLine('DADOS DO CLIENTE', { font: 'F2', size: 11, gap: 17 });
  addLine(`Nome: ${user.name || 'Não informado'}`, { size: 10, gap: 14 });
  addLine(`E-mail: ${user.email || 'Não informado'}`, { size: 10, gap: 14 });
  addLine('RESPOSTAS DA FICHA', { font: 'F2', size: 11, gap: 20 });

  const sections = visibleAnswers(ficha);
  for (const section of sections) {
    if (y < 95) nextPage();
    addLine(section.title.toLocaleUpperCase('pt-BR'), { font: 'F2', size: 10, gap: 16 });
    for (const [label, value] of section.items) {
      const lines = wrap(`${label}: ${value}`, 94);
      lines.forEach((line, index) => addLine(line, { size: 9, indent: index ? 10 : 0, gap: 13 }));
      y -= 4;
    }
    y -= 6;
  }
  pages.forEach((lines, index) => {
    lines.push(`BT /F1 8 Tf 1 0 0 1 48 34 Tm (${pdfText(`Documento confidencial  ·  Página ${index + 1} de ${pages.length}`)}) Tj ET`);
  });
  return pages;
}

export function createFichaPdf(ficha, user) {
  const pages = makePages(ficha, user);
  const objects = [];
  const addObject = value => { objects.push(value); return objects.length; };
  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = pages.map(lines => {
    const stream = encoder.encode(`${lines.join('\n')}\n`);
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${new TextDecoder().decode(stream)}endstream`);
    return addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n%----\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadFichaPdf(ficha, user) {
  const blob = createFichaPdf(ficha, user);
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  const safeName = (user.name || 'cliente').normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[^a-zA-Z0-9-]+/gu, '-').replace(/^-|-$/gu, '').toLocaleLowerCase('en');
  const safeTitle = (ficha.title || 'ficha').normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[^a-zA-Z0-9-]+/gu, '-').replace(/^-|-$/gu, '').toLocaleLowerCase('en');
  link.href = objectUrl;
  link.download = `${safeName || 'cliente'}-${safeTitle || 'ficha'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
