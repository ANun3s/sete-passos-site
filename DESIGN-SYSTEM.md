# Direção visual — Sete Passos

## Superfície
Apresentação / Decide-Learn. Objetivo: reconhecer a marca, explorar as duas áreas da logo e conhecer o caminho de contato. CTA: “Dar o primeiro passo”.

## Composição
Abertura editorial em duas colunas: texto e ações à esquerda, pilha CardSwap à direita. O emblema PNG transparente original `public/assets/sete-passos-mockup-transparente.png` aparece como primeira lâmina; as seguintes apresentam imagens ilustrativas da fisioterapia e da estética. A marca também permanece no cabeçalho e no rodapé. Depois da faixa de valores, divisórias em linhas editoriais antecipam os links do menu: Sobre, Casos de sucesso e Área do cliente. Em telas compactas, hero e divisórias passam para uma coluna; não reduzir leitura para manter a pilha ao lado do texto. Cabeçalhos de seção e CTA preservam o eixo editorial; acordeões continuam alinhados à esquerda. Respiro branco, tipografia expressiva e linhas finas. Rodapé monumental claro (paper), com texto azul-marinho, símbolo decorativo, lettering amplo e navegação em colunas. Sem avaliações falsas ou números decorativos.

## Tokens
- Navy/ink: #071e3c; navy profundo: #05162e.
- Surface: #ffffff; paper: #f6f8fb; ice: #e8f1f8.
- Muted: #52657b; muted sobre navy: #c0cede.
- Aurora principal azul/ciano: #89c8ee, #b2e6ed, #a6bce8. Acentos de apoio: lavanda #b9a8f4, rosa #f2b0b3, menta #a8dfd0 e âmbar #eac77e; usar em lavagens de fundo e reflexos, sem substituir a identidade azul da logo ou reduzir o contraste dos textos.
- DM Sans (corpo e controles) + Instrument Serif (ênfase editorial); fontes locais, licença OFL.
- Espaçamento base 4px; container máximo 1120px; áreas de leitura de até 768px e margens móveis de 24px. As divisórias da página inicial se encontram sem margem externa; o respiro é o padding interno de cada seção. Nenhuma seção reserva distância extra de rolagem. O mesmo encaixe vale sem JavaScript e com movimento reduzido.
- Raios: 12px para caixas técnicas, 20px nos cards de conteúdo, pílula para ações. A logo não tem plano visível, borda, fundo, moldura ou raio.

## Movimento — atualizado em 15/10/2026
A rolagem das âncoras segue nativa e instantânea. Na seção “Nosso cuidado”, a pasta React Bits abre cinco miniaturas por clique, toque ou teclado. Selecionar uma miniatura mostra o card ampliado dentro do fluxo normal da seção, sem modal, popup, overlay ou rolagem controlada. A abertura usa o movimento do componente; movimento reduzido mantém a interação sem animação automática. Sem JavaScript, os cinco cards ficam em grade estática. Na página “Sobre”, as fotografias começam visíveis e recebem uma única animação suave ao entrar na área de leitura, sem fixação, deslizamento de página ou conteúdo essencial oculto. Movimento reduzido mantém ambas estáticas. Na prévia do menu da página inicial, uma fotografia ilustrativa acompanha o item de navegação que cruza o centro da tela por meio de crossfade GSAP; a imagem da esquerda permanece sticky apenas em telas largas, enquanto três links mantêm espaço generoso entre si. Foco e ponteiro também selecionam a imagem. Movimento reduzido desliga a troca por rolagem e remove o crossfade. A fotografia de fisioterapia associada a “Casos de sucesso” é ilustrativa e não implica depoimento nem resultado de paciente. Sem JavaScript, links e texto continuam funcionais.

GSAP Core anima o menu móvel em 220ms e as superfícies da conta/contato em 250ms, usando transform e opacidade, sem bloquear o foco. O CardSwap da abertura adapta o visual de pilha do React Bits ao GSAP local: cartões grandes em azul-marinho, com título acima da imagem, perspectiva e leve inclinação. Avança sozinho a cada 4,3s; também responde ao arraste horizontal, aos controles anterior/próxima/pausa e à navegação por foco. Suspende fora da tela, pausa enquanto há foco de teclado e desativa autoplay com movimento reduzido. Interrupção, desmontagem e movimento reduzido encerram os tweens. ScrollTrigger anima somente a entrada das fotografias da página “Sobre”, com limpeza ao trocar de rota. Tilt de marca e cards permanece limitado ao ponteiro e não interfere na posição das seções.
Na prévia das páginas do menu, ScrollTrigger troca a fotografia de acordo com o item que cruza a zona central da viewport, e o GSAP faz a transição em opacidade e escala. Ponteiro e teclado também mudam a imagem. Os efeitos e gatilhos são removidos ao trocar de página; com movimento reduzido, a seleção é instantânea e a rolagem não troca a imagem.

Em 15/10/2026, DitherVeil foi incluído ao lado do título de “Sobre”, com retícula Floyd–Steinberg azul e branca, imagem colorida revelada pelo cursor e texto editorial abaixo do conjunto. Usa a implementação e os shaders do registro React Bits adaptados ao JavaScript sem React já usado pelo projeto; `ogl` é carregado apenas por esse módulo. A imagem remota solicitada tem fallback local. Movimento reduzido pula a animação de introdução e desliga a deriva autônoma; o efeito continua limitado à abertura desta página.

### Hierarquia e leitura
Seções usam padding entre 3.5rem e 6rem, sem espaços externos. Cards têm descrições de 1rem, legendas de .875rem e ações sempre visíveis. Textos auxiliares relevantes têm ao menos .75rem. Essência e dúvidas usam duas colunas a partir de 1000px e fluxo vertical nas telas menores. Navegação e rodapés compartilham a mesma escala. Todas as rotas carregam as mesmas folhas de estilo na mesma ordem para manter o visual após navegação interna.

## Materiais e leitura
O header mantém os links discretos. Por solicitação de 2026-10-13, o menu flutuante da conta usa seu próprio material Liquid Glass; os links do cabeçalho continuam sem superfície individual. Navegação discreta: rótulos com peso 400, cor muted, sem fundos de pílula, bordas ou sombras nos controles; hover/página atual usam sublinhado fino e navy. “Vamos conversar” acompanha a leveza dos demais links. Preservar alvos de 44px, foco visível e contornos quando o usuário pede alto contraste. Pressão de botão responde em 80ms, antes do clique, e disabled não anima ícones/aurora. O menu abre a partir do canto do botão e pode ser revertido durante a animação; fechado, sai da ordem de foco. A cortina entre documentos preserva o contrato de navegação existente; não é ligada à rolagem.
Em 15/10/2026, o usuário pediu uma paleta mais variada e bordas brilhantes que acompanham o mouse. Acentos lavanda, rosa e menta agora complementam o azul/ciano nas faixas, superfícies editoriais e marcadores dos cuidados. Botões translúcidos, cartões de cuidado e molduras das imagens recebem um contorno prismático discreto que segue o ponteiro; teclado mostra o realce, toque não depende dele, movimento reduzido evita rastreamento e alto contraste usa contorno sólido.
Fichas usam uma superfície branca agrupada sobre paper, com miniaturas apenas onde há espaço. No celular estreito o aviso ocupa uma coluna, e a etiqueta fica abaixo do texto. Textos auxiliares relevantes usam .875rem; campos visuais usam 1rem. Reflow é validado a 200%, incluindo fichas abertas e menu em tela baixa.
Redução de transparência e alto contraste são tratados separadamente de movimento reduzido. Nesses modos, materiais sólidos e limites contrastantes substituem blur e auroras; a identidade mantém suas cores e fontes.

## Conteúdo e limites
Somente nome, segmento e logo confirmados. Textos são propostas, sem promessas terapêuticas. Não há endereço, WhatsApp ou horários confirmados. O painel de contato permite preparar/copiar uma mensagem local; informa que nada é enviado.
“Casos de sucesso” é uma rota editorial pública, acessível pelo cabeçalho e rodapé. Enquanto não houver relatos reais aprovados para publicação, exibe um estado transparente de preparação. Nunca preencher com pacientes, depoimentos, imagens ou resultados clínicos inventados; qualquer relato futuro exige autorização e contexto.

## Portal e transição entre páginas
Login editorial em duas colunas: formulário de acesso e painel azul-marinho da marca; em telas pequenas, empilhamento sem forçar “de” numa linha isolada do título. A conta usa autenticação do backend.
Administração é concedida no backend a um único e-mail configurado em `SETE_PASSOS_ADMIN_EMAIL`, no arquivo privado `supabase.env`. O menu só mostra o atalho para a sessão autorizada. A biblioteca de fichas e suas prévias são buscadas por endpoints protegidos, com os arquivos armazenados fora da raiz pública. `fichas.html` é somente um redirecionamento legado. Não há autorização baseada apenas em ocultar links no navegador.
Biblioteca com documentos em linhas editoriais, miniaturas de papel e modelos expansíveis nativos. Os campos são exemplos visuais inativos, não um questionário/protocolo clínico validado. Nenhum paciente, dado ou métrica inventada.
Na Administração, a lista de perfis mostra nome, e-mail e quantidade de fichas. O nome abre o detalhe do cliente, com informações da conta e respostas agrupadas pelos mesmos títulos dos modelos. A profissional pode preencher avaliação fisioterapêutica, proposta de tratamento ou outra ficha em grupos recolhíveis, revisar e salvar. Dados pessoais e respostas permanecem na API autenticada e não entram na URL; em armazenamento indisponível, não oferecer o formulário.
Na página inicial, os cinco conteúdos de cuidado ficam disponíveis na pasta interativa; a grade correspondente aparece como fallback sem JavaScript.
Cortina full-screen azul-marinho com título branco em Instrument Serif. Ângulo 9°, duração nominal 780ms e easing cubic-bezier(.76,0,.24,1). Direção por índice da rota; troca somente sob cobertura completa. Movimento reduzido instantâneo. Sem novas bibliotecas e sem alterar as proporções da logo.


## Menu da conta — 2026-10-13
Após o login, o avatar com seta ocupa o final da navegação, depois de “Vamos conversar”. O nome fica dentro do menu, com “Meu perfil” e “Sair” em linhas de pelo menos 44px. No desktop, o painel desce a partir do avatar ao passar o mouse; clique e teclado também abrem. A seta para baixo transfere foco ao perfil, Escape fecha e devolve foco ao avatar, e sair do grupo ou clicar fora fecha. No celular, o submenu expande dentro da navegação para evitar cortes. Abertura GSAP de 250ms, com deslocamento de 7px e escala de .96 a 1; removida com movimento reduzido. Preservar o login público quando não houver sessão.


## Perfil, vidro e seletor de imagem — 2026-10-13
- Menus da conta e do lápis: material branco/azul translúcido, blur de 24px, saturação discreta, borda clara e sombra azul-marinho. Fundo sólido em redução de transparência, alto contraste ou ausência de backdrop-filter.
- Informações do perfil: superfície branca com luz interna e sombras em camadas; entrada GSAP de 500ms com deslocamento de 16px. Campos permanecem estáveis, sem inclinação ao editar.
- O lápis sobre o avatar tem área de 44px e abre um menu compacto com “Editar imagem”. Essa ação abre o dialog “Selecione uma imagem”, inspirado na referência fornecida, sem opção de GIF.
- Upload JPEG/PNG/WebP de até 5 MB mantém prévia, confirmação por “Salvar foto”, cancelamento e remoção existentes. Avatares recentes são até seis uploads confirmados nesta visita, mantidos só em memória, limpos ao sair, trocar de conta ou desmontar a página.
- Dialog nativo com nome acessível, Tab contido, Escape, clique externo e botão de fechar; foco retorna ao lápis. Salvamento em andamento bloqueia fechamento para preservar o envio.
- Conteúdo e autenticação continuam usando as APIs existentes. Nenhum histórico de fotos foi adicionado ao banco.
# Atualização da página inicial — 12/11/2026

- O hero editorial continua em duas colunas no desktop, com a marca primeiro no CardSwap e texto acessível ao lado; no celular, fica empilhado e segue o fluxo nativo.
- A identidade existente permanece: navy e azul da marca, superfícies brancas/papel, DM Sans e Instrument Serif, logo original e fotografias editoriais existentes.
- A faixa de valores usa ice sólido; essência usa paper e contato ice. Sombras e bordas da fotografia de prévia e do CardSwap ficam mais leves.
- A prévia de navegação mantém somente o crossfade GSAP existente. Não adicionar pin, scrub, parallax, scroll suave programático, trilha pixelada ou shader na página de serviço.
- Botões e links têm retorno breve de pressão/elevação; `prefers-reduced-motion` remove deslocamentos.
- “Casos de sucesso” segue um espaço para histórias autorizadas e não deve receber depoimentos ou resultados inventados.
- O título do hero permanece “Um cuidado que respeita o seu tempo.”, protegido pelas verificações de marca existentes; a categoria e o segmento aparecem imediatamente no eyebrow e no texto de apoio.
- A pasta interativa desenha um anel de foco azul claro sobre suas camadas quando acessada pelo teclado.
- O selo da letra no CardSwap usa navy sólido para sustentar o contraste sobre as cartas azuis.
- Registro detalhado: `tasks/home-visual-refinement.md`.
