# Refinamento Apple — contrato de implementação

## Objetivo e limites
Aplicar a skill apple-design fornecida pelo usuário ao site atual, sem trocar a marca, criar backend ou importar identidade Apple. Preservar a logo, o azul-marinho/branco, a ênfase Instrument Serif e as fontes locais como parte da identidade existente. A tarefa anterior de galeria não autoriza fotos fictícias nem exposição de pacientes: não há fotos fornecidas, então nenhum resultado clínico ou carrossel com pessoas será inventado.

## Auditoria focada
- Materiais: header e CTA acumulam backdrop-filter; faltam alternativas para transparência reduzida e maior contraste.
- Feedback: pressão de botão herda transição de 300ms; campos/ações desativados ainda recebem eventos decorativos.
- Logo: mudanças do ponteiro dependem de uma transição CSS de 550ms. Introduzir molas X/Y independentes, preservando valores e velocidades ao redirecionar; manter reset imediato nos sinais de cancelamento/acessibilidade.
- Navegação móvel: display none/flex interrompe a continuidade. Introduzir abertura/fechamento a partir do valor apresentado, mantendo Escape, foco, links nativos e ausência de bloqueio durante reversão.
- Legibilidade: textos auxiliares e campos do portal são pequenos; ampliar o conteúdo útil, rever alvos de toque e validar ampliação de texto.

## Slices e aceite
1. Materiais/feedback: CSS compartilhado, superfície agrupada de fichas, estados de pressão e disabled, redução de transparência e alto contraste. Testes: estilos computados e preferências reais em Chromium.
2. Movimento: pequeno integrador analítico de mola criticamente amortecida, usado na logo e no menu. Nenhuma nova dependência. Testes de reversão, preservação de velocidade, repouso, cancelamento e reduced motion.
3. Verificação: responsividade, teclado, texto ampliado, axe, regressões existentes e Go Live/build. Capturas antes/depois e documentação.

## Decisões
- Aplicar feedback e molas somente onde comunicam estado; sem loops, som ou vibração decorativa.
- Não transformar a rolagem nativa nem adicionar gestos de arrastar sem finalidade.
- O menu e a logo podem ser redirecionados durante o movimento. A cortina entre documentos mantém a troca atômica e o bloqueio de cliques duplicados expressamente solicitado anteriormente; o histórico permanece cancelável.
- Honrar movimento reduzido também quando a preferência muda durante uma animação. Transparência reduzida e alto contraste tornam materiais sólidos; ausência de backdrop-filter também tem fallback.

## Verificação
`GO_LIVE_URL=http://127.0.0.1:5500 npm test`, `npm run check`, `npm run build`, `node scripts/verify-pages.mjs` e capturas do refinamento.
