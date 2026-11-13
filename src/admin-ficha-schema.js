export const FICHA_TYPES = Object.freeze({
  'avaliacao-fisioterapeutica': 'Avaliação fisioterapêutica',
  'proposta-tratamento': 'Proposta de tratamento',
  outro: 'Outra ficha',
});

const field = (id, label, type = 'text', options = {}) => ({ id, label, type, ...options });
const area = (id, label, rows = 3, options = {}) => field(id, label, 'textarea', { rows, ...options });
const group = (title, fields) => ({ title, fields });

export function fichaGroups(type, user = {}, profile = {}) {
  const value = (key, fallback = '') => profile[key] || fallback;
  if (type === 'avaliacao-fisioterapeutica') return [
    group('Identificação do paciente', [
      field('patientName', 'Nome completo', 'text', { value: value('name', user.name || ''), required: true }),
      field('patientEmail', 'E-mail da conta', 'email', { value: user.email || '', readOnly: true }),
      field('birthDate', 'Data de nascimento', 'date', { value: value('birthDate') }), field('age', 'Idade', 'number', { min: 0, max: 125, value: value('age') }),
      field('sex', 'Sexo', 'select', { options: ['Feminino', 'Masculino', 'Outro', 'Prefere não informar'], value: value('sex') }),
      field('cpf', 'CPF', 'text', { value: value('cpf') }), field('phone', 'Telefone', 'tel', { value: value('phone') }), field('profession', 'Profissão', 'text', { value: value('profession') }),
      field('address', 'Endereço', 'text', { wide: true, value: value('address') }), field('neighborhood', 'Bairro', 'text', { value: value('neighborhood') }), field('postalCode', 'CEP', 'text', { value: value('postalCode') }),
    ]),
    group('Queixa e evolução dos sintomas', [
      area('mainComplaint', 'Queixa principal', 3, { required: true }),
      area('symptomEvolution', 'Evolução dos sintomas'),
      area('onsetDescription', 'Como começou?'),
      field('onsetDate', 'Quando começou?', 'text', { hint: 'Data ou período aproximado' }),
    ]),
    group('Dor e localização', [
      field('painScale', 'Escala numérica da dor (0 a 10)', 'select', { options: Array.from({ length: 11 }, (_, index) => String(index)) }),
      area('painLocation', 'Extensão e localização da dor (mapa dos pés)', 3),
      field('painCharacteristics', 'Características da dor', 'checks', { options: ['Dor referida', 'Dor visceral', 'Dor ligamentar', 'Dor muscular', 'Dor neural'] }),
      field('painOther', 'Outra característica da dor'),
      area('painFrequency', 'Frequência da dor'),
      area('painAggravatingFactors', 'O que piora a dor?'),
      area('painRelievingFactors', 'O que melhora a dor?'),
    ]),
    group('Histórico de saúde', [
      area('previousTreatments', 'Tratamentos anteriores'),
      area('medications', 'Medicação (uso atual ou recente)'),
      area('surgeries', 'Cirurgias'), area('traumas', 'Traumas'), area('imagingExams', 'Exames de imagem'),
      area('generalConditions', 'Condições gerais e observações'),
      field('sleepPosition', 'Posição para dormir'), area('nutrition', 'Alimentação', 2),
      area('physicalActivity', 'Atividade física', 2), area('emotionalHealth', 'Emocional (estresse/ansiedade)', 2),
      area('visceralQuestions', 'Questões viscerais'), area('contraindications', 'Contraindicação e observações da profissional'),
    ]),
    group('Plano e encerramento', [
      field('treatmentPlan', 'Plano de tratamento', 'checks', { options: [
        'Laserterapia', 'Liberação da fáscia muscular', 'Eletroestimulação', 'Haihua e acupuntura',
        'Ganho de mobilidade', 'Ganho de ADM', 'Ganho de força', 'Criolipólise', 'Ventosoterapia', 'Ultrassom para alívio da dor',
      ] }),
      area('treatmentObjective', 'Objetivo individualizado do tratamento', 4),
      field('evaluationDate', 'Data da avaliação', 'date'), field('evaluationNumber', 'Avaliação nº'),
      field('professionalName', 'Profissional responsável'), field('professionalRegistration', 'Registro profissional'),
      field('patientAcknowledgement', 'Nome do cliente para registro de ciência'),
      field('professionalAcknowledgement', 'Nome da profissional para registro'),
    ]),
  ];

  if (type === 'proposta-tratamento') return [
    group('Identificação das partes', [
      field('clientName', 'Cliente', 'text', { value: value('name', user.name || ''), required: true }),
      field('clientEmail', 'E-mail da conta', 'email', { value: user.email || '', readOnly: true }),
      field('clientCpf', 'CPF', 'text', { value: value('cpf') }), field('clientPhone', 'Telefone', 'tel', { value: value('phone') }), field('clientAddress', 'Endereço', 'text', { wide: true, value: value('address') }),
      field('providerName', 'Prestador / razão social'), field('providerDocument', 'CPF / CNPJ do prestador'),
      field('professionalName', 'Profissional responsável'), field('professionalRegistration', 'Registro profissional'),
      field('proposalDate', 'Data da proposta', 'date'), field('proposalNumber', 'Proposta nº'),
      field('providerContact', 'Contato e endereço do prestador', 'text', { wide: true }),
    ]),
    group('Objetivos e plano de tratamento', [
      area('objectives', 'Objetivos individualizados', 4),
      field('treatments', 'Tratamentos / recursos previstos', 'checks', { options: ['Tratamento 1', 'Tratamento 2', 'Tratamento 3'] }),
      area('treatmentDetails', 'Descrição complementar dos tratamentos', 4),
      area('otherTreatmentOptions', 'Outras opções de tratamento / exercícios', 3),
      field('frequency', 'Frequência dos atendimentos'), field('sessionDuration', 'Duração estimada por sessão'),
      field('plannedStart', 'Início previsto', 'date'), field('plannedEnd', 'Término previsto', 'date'),
      area('sessionNotes', 'Observações sobre sessões e recursos'),
    ]),
    group('Investimento e condições', [
      field('cashTotal', 'Valor total à vista (R$)', 'text', { inputMode: 'decimal' }),
      field('installmentTotal', 'Valor total a prazo (R$)', 'text', { inputMode: 'decimal' }),
      field('installments', 'Número de parcelas', 'number', { min: 1, max: 120 }),
      field('installmentValue', 'Valor por parcela (R$)', 'text', { inputMode: 'decimal' }),
      area('paymentConditions', 'Condições de pagamento', 3),
      field('proposalValidity', 'Validade da proposta', 'date'),
      field('chosenOption', 'Opção escolhida pelo cliente', 'select', { options: ['À vista', 'A prazo', 'Ainda não definida'] }),
      area('appointmentConditions', 'Condições do atendimento', 4),
    ]),
    group('Aceite da proposta', [
      field('acceptancePlaceDate', 'Local e data do aceite'), field('responsibleName', 'Nome do responsável, se aplicável'),
      field('proposalAccepted', 'Aceite registrado', 'select', { options: ['Pendente', 'Aceita', 'Não aceita'] }),
    ]),
  ];

  return [group('Informações da ficha', [
    field('clientName', 'Nome do cliente', 'text', { value: value('name', user.name || ''), required: true }),
    field('clientEmail', 'E-mail da conta', 'email', { value: user.email || '', readOnly: true }),
    field('date', 'Data do atendimento', 'date'), area('notes', 'Informações registradas pela profissional', 6, { required: true }),
  ])];
}

export function fichaFieldLabels(type) {
  return new Map(fichaGroups(type).flatMap(section => section.fields.map(item => [item.id, item.label])));
}
