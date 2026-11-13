# Cabeçalho com menos destaque nos controles

## Escopo entregue
- Links sem pílulas preenchidas, com peso 400 e a cor muted existente.
- Hover e página atual indicados por sublinhado fino e navy.
- “Vamos conversar” e botão do menu sem aurora, borda especular ou sombra própria.
- Preservados: marca, vidro do cabeçalho, CTAs do conteúdo, alvos de pelo menos 44px, foco por teclado, alto contraste e navegação móvel.
- Alteração visual concentrada em `src/interface.css`, compartilhada pelas três páginas. Nenhuma mudança no JavaScript ou no sequenciamento de scroll nesta etapa.

## Verificação executada
- RED: o teste novo identificou o fundo ice anterior nos links.
- Vite: 15 testes aprovados (`quiet-header`, `apple-interface`, `site`).
- Go Live real em 5500: 13 testes aprovados (`quiet-header`, `apple-interface`), com `PORTAL_BASE_URL` explícita.
- Menu auditado com axe em 320, 768, 1024 e 1440px; sem violações após a animação de abertura atingir repouso.
- Sem overflow horizontal ou erros JavaScript nessas verificações; foco e alvos de toque preservados.
- Capturas de desktop e celular inspecionadas em `/Users/nunes/.hermes/cache/scratch/sete-passos-quiet-header/`.
- `npm run check` e `npm run build`: aprovados.
- Suíte completa no Vite: 93 aprovados, 1 ignorado (Go Live não ativado nessa execução), 1 falha preexistente no teste da busca textual sob a pilha (`tests/stack-navigation.spec.js:26`). A falha foi reproduzida antes desta alteração e ficou fora do escopo do cabeçalho; não declarar a suíte inteira aprovada.

## Salvaguardas
- Backup anterior: `artifacts/backups/before-quiet-header-53fe021d.zip`.
- Direção visual atualizada em `AGENTS.md` e `DESIGN-SYSTEM.md`.
- Auditoria de contraste aguarda o estado visual de repouso, não apenas `aria-expanded`, para não medir um quadro intermediário de opacidade.
