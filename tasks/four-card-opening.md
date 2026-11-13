# Quatro cards — contrato de abertura

## Conteúdo e limites
Reutilizar as duas áreas existentes (Fisioterapia e Estética avançada) e os princípios “Escutar antes de tudo” e “Respeitar o seu ritmo”, sem anunciar novos tratamentos. Preservar os textos de avaliação individual, contatos demonstrativos, identidade, respiro entre divisórias e menu discreto.

## Slices
1. **Conteúdo/fallback:** quatro artigos em grade legível de duas colunas, uma coluna estreita; serviços abrem os interesses corretos, princípios levam à Essência. Verificar sem JS e movimento reduzido.
2. **Abertura:** mesma timeline GSAP das seções, sem um segundo relógio de scroll. Camada externa controla x/y/escala/rotação; Motion só controla tilt interno. Pilha central com deslocamentos crescentes para cima/direita; destinos superior esquerdo/direito e inferior esquerdo/direito. Leve escala final e rotações opostas. Nada reinicia ou salta ao inverter o scroll. Próxima seção aguarda a abertura.
3. **Acesso/ciclo de vida:** dimensionamento real, sem recortar textos. Sem espaço útil, usar layout estático. Foco ou busca por texto encoberto deve revelar o card; reduced motion dinâmico, redimensionamento e troca de página limpam transforms, listeners e metadados.
4. **QA:** posições inicial/intermediária/final/reversa, visibilidade das quatro ações, 320/768/1024/1440, texto 200%, Go Live, build e regressões. Revisão independente somente leitura após implementação.

## Arquitetura
- `care-sequence.js` mede e registra a sequência no coordenador existente.
- Estilos de composição compacta só quando o deck pode ser animado; fallback não esconde conteúdo.
- Espaço de layout dos quatro cantos é calculado antes de construir a timeline; `context.revert()` remove apenas a camada GSAP.
- Usar o scroll nativo, sem interceptar roda/toque nem adicionar dependências.
- Preservar os intervalos editoriais adicionados em `scroll-stack.css`.

## Aprovação
Comportamento autorizado no pedido atual. Conteúdo extra é reutilização editorial do próprio site, não um serviço novo.

## Implementação e verificação
- Conteúdo: Fisioterapia, Estética avançada, Escutar antes de tudo e Respeitar o seu ritmo. Artes abstratas locais, sem fotos ou promessas clínicas.
- GSAP: escala final .92, rotações -4°/+4°, offsets iniciais em passos de 12px; estágio medido pela maior altura real e pelas dimensões rotacionadas. Reserva de rolagem separada do respiro editorial.
- Navegação: ações focadas abrem o deck; seeks instantâneos sincronizam a timeline no mesmo frame. Seleção de texto encoberto revela o capítulo sem apagar a seleção e não interfere no arrasto do ponteiro.
- `GO_LIVE_URL=http://127.0.0.1:5500 PORTAL_BASE_URL=http://127.0.0.1:5177 npm test`: última suíte completa com 110 aprovados, sem testes pulados.
- `GO_LIVE_URL=http://127.0.0.1:5500 PORTAL_BASE_URL=http://127.0.0.1:5500 npm test -- tests/care-cards.spec.js tests/care-sequence.spec.js tests/four-card-opening.spec.js tests/stack-fallbacks.spec.js tests/stack-navigation.spec.js tests/gsap-scroll.spec.js tests/scroll-stack.spec.js tests/section-spacing.spec.js tests/quiet-header.spec.js tests/go-live.spec.js`: 40 aprovados.
- Abertura e navegação repetidas cinco vezes: 30 execuções aprovadas.
- `npm run check`, `npm run build` e `npm audit --audit-level=high`: exit 0; auditoria sem vulnerabilidades reportadas.
- Probe visual nos dois servidores: 41 posições de ida e volta, erro máximo de retorno 0px, quatro ações alcançáveis, nenhum pageerror. Capturas de pilha/meio/abertura e mobile inspecionadas. Dados e script em `/Users/nunes/.hermes/cache/scratch/sete-passos-four-cards/`.
- Axe, larguras 320/768/1024/1440, texto a 200%, ausência de JS, reduced motion dinâmico, resize, âncoras e remount cobertos na suíte. Verificações automatizadas executadas no Chromium; Safari/Firefox e Cmd+F nativo não foram validados. A recuperação de busca foi testada com `window.find()`.
- Revisão independente `deleg_1881ec9d` concluída: dois achados médios reproduzidos com testes falhando e corrigidos. A reserva vertical agora inclui título, rodapé, padding e todos os intervalos; o deck continua ativo em 1440×900 com título abaixo do cabeçalho. A impressão desmonta a timeline e a grade sobreposta; retornar à tela recria uma única timeline.
- Inspeção visual de impressão identificou também o cabeçalho fixo sobre o conteúdo: navegação e skip link agora ficam ocultos somente em print. Após esse ajuste final, os cinco testes de abertura passaram novamente no Vite e os cinco no Go Live; sintaxe e build novamente aprovados.
- Evidências finais: `5500-open-900-fixed.png`, `5500-print-fixed.png` e `review-fixes.json` no diretório de capturas. Título medido em y=161.05px, abaixo do cabeçalho em y=105px; os quatro cards de impressão não se intersectam.
- Observação de QA: uma execução anterior do teste nativo sem JavaScript falhou no retorno ao início; passou em cinco repetições e na última suíte completa, sem mudança no código desse fluxo. Não foi reproduzida nas verificações finais.
