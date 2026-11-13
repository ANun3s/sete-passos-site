# Refinamento sequencial dos quatro cards

## Escopo e evidência
- Trabalhar somente em Sistema Sete Passos. Não publicar nem alterar o projeto elo.
- Preservar literalmente HTML, conteúdo, imagens, links, paleta, cabeçalho e demais animações.
- Referência local: `/Users/nunes/Desktop/Gravação de Tela 2026-10-06 às 22.11.16.mov`.
- Quadros inspecionados em 0,8 / 3,3 / 4,1 / 5,8 / 8,3 segundos. Tempos são localizadores do vídeo, não durações da animação.
- Evidências e backup fora do workspace: `/Users/nunes/.hermes/cache/scratch/sete-passos-sequential/`.

## Contrato visual e técnico
- Pilha compacta central; primeiro card horizontal, maior e à frente; camadas seguintes sobem e avançam para a direita, com redução discreta.
- Saídas sequenciais e sobrepostas: superior esquerda, superior direita, inferior esquerda, inferior direita. Não abrir os quatro simultaneamente.
- Um mestre exclusivo para os cards, com scrub curto e progresso reversível; manter o coordenador existente de enquadramento das seções imediato para não introduzir atraso em outras animações. Nunca aplicar dois controladores ao transform de um card.
- `.scroll-stack-card` continua sendo a seção; `.care-card` é o wrapper de movimento já existente; `.tilted-card-inner` conserva somente o tilt. Sem alterar a estrutura ou o conteúdo HTML.
- Base em grid/fluxo normal. Posicionamento absoluto e centralização percentual somente no modo deck.
- Medir dimensões não transformadas; reservar a caixa rotacionada, título, rodapé, padding e gaps. Não encolher conteúdo excessivamente nem cortar para fazê-lo caber.
- Ativar por matchMedia e geometria real. Fallback integral para celular, pouca altura, texto ampliado, impressão e movimento reduzido.
- Foco/seleção revelam a composição antes de permitir conteúdo encoberto. Sem inert persistente, aria-hidden com foco, z-index animado ou novo smooth-scroll.
- Contextos, media queries, eventos e observers devem ser limpos com a rota. Resize/refresh preservam o progresso normalizado quando o deck permanece ativo.

## Etapas verificáveis
- [x] Ler implementação, skills GSAP oficiais e quadros da gravação.
- [ ] RED/GREEN da saída sequencial e pilha inicial.
- [ ] Scrub acomodado, reversão e acessibilidade sem foco coberto.
- [ ] Resize/retorno de rota/restauração do scroll e fallbacks.
- [ ] Inspeção visual 0/25/50/75/100% e percurso inverso; comparar referência.
- [ ] Vite + Go Live, suíte completa, build e revisão independente.

## Decisão de integração
A fixação da seção existente já é calculada pelo coordenador de scroll nativo. Não acrescentar pin/sticky a essa mesma camada. Se o scrub dos cards for separado, remover seus tweens do mestre de seções e dar a eles um único ScrollTrigger identificado, mantendo os triggers das demais seções intactos.

## Validação
Pendente. Não declarar concluído com base apenas no build.
