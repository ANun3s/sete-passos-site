# Páginas e cortina — especificação

## Escopo aprovado
O usuário esclareceu que o login será apenas uma capa e que as fichas serão de anamnese e limpeza de pele. Manter HTML/CSS/JS, Vite, Go Live, marca e arquivos no workspace atual. Sem backend, autenticação, preenchimento de dados clínicos, persistência ou publicação.

## Mapa de capacidades e ordem
1. `portal-pages`: Início existente → Login (`login.html`) → Fichas (`fichas.html`). Biblioteca com dois modelos visuais expansíveis. Login com campos desativados e um link explícito para visualizar fichas.
2. `page-curtain`: depende das páginas; links reais, aprimorados com fetch local e troca do conteúdo no ponto de cobertura total. Navegação por histórico, foco e anúncios. Sem React ou novas dependências.
3. `verification`: depende dos anteriores; Go Live, Vite, build multipágina, acessibilidade e regressão.

## Contrato visual
Preservar logo, azul-marinho/branco e fontes locais. Login editorial dividido entre painel de acesso e painel da marca. Fichas como biblioteca de dois documentos, sem pacientes ou métricas fictícias. Hierarquia e ações reais: abrir modelo, voltar ao início, navegar entre páginas. Campos desativados: apenas composição visual sujeita à validação da clínica.

## Aceite
- Três documentos reais abrem por URL e navegam também sem JS.
- Login não autentica, não aceita senhas e não sugere proteção inexistente.
- Fichas apresentam anamnese e limpeza de pele, com modelos visuais sem envio ou armazenamento; não constituem prontuários ou protocolos validados.
- Cortina diagonal de 9°, azul-marinho/branco, 780ms nominal, título do destino. Direção pura por índice; bloqueio de transições sobrepostas; conteúdo troca sob cobertura completa.
- View Transitions API quando disponível, fallback nativo sem a API, movimento reduzido instantâneo.
- Foco no h1, anúncio polite, aria-current=page, navegação rotulada, teclado e histórico.
- Sem regressão da logo, contato, rodapé ou Go Live. Sem overflow em 320/768/1024/1440; axe e console limpos.

## Comandos e estrutura
`npm test`, `npm run check`, `npm run build`; `GO_LIVE_URL=http://127.0.0.1:5500 npm test`; `npm run dev`.
Páginas na raiz; módulos/CSS em `src`; testes Playwright em `tests`; documentação em `tasks` e `README.md`.
Estilo: módulos ES, funções pequenas, eventos com AbortSignal ao montar/desmontar página. Exemplo: `export function pageCurtainDirection(current, next) { return next > current ? 'left' : 'right'; }`.
Sempre: testar antes de implementar, preservar assets e validar a instância real.
Perguntar antes: serviços, dados reais, dependências e publicação.
Nunca: armazenar senhas/dados clínicos ou fingir autenticação.
