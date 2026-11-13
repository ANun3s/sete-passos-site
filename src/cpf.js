export function normalizeCPF(value) {
  return typeof value === 'string' ? value.replace(/\D/gu, '') : '';
}

export function formatCPF(value) {
  const digits = normalizeCPF(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/u, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/u, '$1.$2.$3')
    .replace(/(\.\d{3})(\d{1,2})$/u, '$1-$2');
}

export function formatCPFInput(input) {
  const formatted = formatCPF(input.value);
  input.value = formatted;
  const end = formatted.length;
  input.setSelectionRange?.(end, end);
}

export function isValidCPF(value) {
  const cpf = normalizeCPF(value);
  if (!/^\d{11}$/u.test(cpf) || /^(\d)\1{10}$/u.test(cpf)) return false;
  const digit = (length, factor) => {
    let total = 0;
    for (let index = 0; index < length; index++) total += Number(cpf[index]) * (factor - index);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9, 10) === Number(cpf[9]) && digit(10, 11) === Number(cpf[10]);
}
