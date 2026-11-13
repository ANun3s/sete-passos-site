# Refinamento visual da página inicial — 12/11/2026

## Direção

Página institucional de serviço: fisioterapia e estética avançada. A linguagem mantém a identidade aprovada da Sete Passos — navy, branco e papel claro, DM Sans com Instrument Serif, fotografia editorial real e bastante espaço — com menos ruído de superfície para a leitura ficar calma.

## Leitura por seção

| Área | Papel | Recurso visual | Movimento |
| --- | --- | --- | --- |
| Abertura | Explicar o cuidado e convidar ao primeiro contato | Mensagem editorial e CardSwap com a marca primeiro | CardSwap existente, controles acessíveis e pausa |
| Valores | Reforçar o tom da marca | Faixa clara, quatro frases curtas | Nenhum |
| Explorar | Direcionar para Sobre, Casos e Área do cliente | Fotografia existente e três links editoriais | Crossfade GSAP já aprovado por foco, ponteiro e posição natural de rolagem |
| Nosso cuidado | Abrir cinco caminhos de cuidado | Pasta interativa com miniaturas | Abre por clique, toque ou teclado; detalhe no fluxo normal |
| Essência | Explicar os princípios da marca | Tipografia editorial em papel claro | Nenhum movimento ligado à rolagem |
| Dúvidas e contato | Responder e oferecer o próximo passo | Texto, divisórias e CTA | Feedback curto do botão; contato permanece demonstrativo |

## Decisões aplicadas

- Mantidos logo, fotos, fontes, conteúdo de saúde confirmado, CTA principal, estrutura de navegação e o título editorial protegido pelos testes de marca. A categoria aparece no eyebrow e no texto de apoio.
- Reduzidos degradês, textura, brilho e sombra para criar uma base visual mais silenciosa.
- Simplificados títulos e rótulos repetidos; removidos números decorativos que sugeriam uma sequência inexistente.
- O CTA do cabeçalho permite quebra de texto quando o usuário amplia a fonte, para evitar overflow em desktop.
- Removida a legenda sobre a fotografia da prévia; o nome da seção e os links próximos já explicam o contexto sem sobrepor texto à imagem.
- Reescrita a descrição de Casos de sucesso para deixar claro que o espaço aguarda histórias autorizadas.
- Mantidos movimentos existentes aprovados pelo projeto. Não acrescentar trilha pixelada, shader, pin, scrub, parallax, carrossel novo ou movimento contínuo.
- Botão principal responde com elevação de 1px e pressão de 2,5%; links sobem 2px. Preferência por movimento reduzido remove os deslocamentos.
- A pasta de cuidados agora mostra um contorno azul claro sobre a ilustração quando recebe foco pelo teclado.
- O selo da letra no CardSwap usa uma base navy sólida para manter o contraste do texto sobre a pilha azul.

## Referências e critério

- [[Direção visual — Sete Passos]] e [[Movimento — atualizado em 15/10/2026]] são a fonte local para composição, rolagem e redução de movimento.
- [[Cabeçalho com menos destaque nos controles]], [[Cards de cuidado + prioridade na rolagem]] e [[Mais espaço entre as divisórias]] foram consultadas para manter navegação discreta, cinco itens de cuidado e rolagem nativa.
- Awwwards orienta a leitura de hierarquia, fotografia e decisões específicas ao público; GSAP continua restrito ao crossfade existente.
- Pixelated Image Trail e cenas de shader não combinam com a experiência calma e cotidiana de um serviço de cuidado; foram tratados como referência técnica, sem copiar o efeito.

## Verificação e limites

- Capturas de página completa em 390px e 1440px; medidas responsivas da skill em 320, 390, 768, 820, 1024 e 1440px. A composição passou pela inspeção visual. O verificador de layout apontou a estrutura editorial em colunas como aviso e um excesso de 8px no hint em larguras intermediárias, sem overflow horizontal.
- `npm run check`, `npm run build` e `copy-lint` passaram; copy-lint: 0 FAIL e 0 WARN.
- A inspeção por teclado confirmou o foco na pasta, e a captura mostrou o novo contorno sobre as camadas ilustradas. Movimento reduzido mantém a pasta interativa e o cruzamento de imagens sem animação dependente da rolagem.
- O gate de design terminou em `GATE: OPEN 71` após três rodadas; o log completo ficou localmente em `.taste-skill/gate-final.txt`. A maior parte dos alertas conflita com decisões documentadas do site (composição editorial, pasta/CardSwap empilhados, superfícies intencionalmente textuais e o crossfade aprovado). A versão final do anel de foco e do contraste do selo foi ajustada após a última rodada e inspecionada visualmente; por limite de rodadas, o gate não foi reexecutado depois dessas correções.
- A suíte Playwright completa registrou 108 aprovações, 31 falhas e 1 teste ignorado. Os testes de hero, navegação e paleta passaram depois de preservar o título; a falha restante do teste de tipografia está em `/login.html` a 200% de zoom, fora da página trabalhada e com alterações locais preexistentes. A suíte também contém expectativas antigas de quatro cards e hero centralizado que contradizem a pasta de cinco caminhos e a composição aprovada.
- Graphify foi atualizado incrementalmente para 1.246 nós, 2.430 arestas e 81 comunidades; o vault Sete Passos foi exportado e preservou `ASSETS.md` e `assets_1.md`, que já existiam fora do manifesto do Graphify.
