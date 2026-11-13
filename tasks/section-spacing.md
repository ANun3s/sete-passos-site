# Mais espaço entre as divisórias

## Entrega
- Adicionado `--section-gap: clamp(3rem, 6vw, 6rem)` entre os cinco painéis da página inicial, em `src/scroll-stack.css`.
- Margem editorial separada do `padding-bottom` que o GSAP usa para reservar a sequência dos cards.
- Espaço preservado no celular, com movimento reduzido e sem JavaScript; removido na impressão.
- Mantidos o cabeçalho discreto, os dois cards existentes, os textos, o empilhamento e a animação atual. O pedido interrompido de quatro cards não foi implementado.
- Direção visual registrada em `DESIGN-SYSTEM.md`.

## Verificação
- RED inicial: distância entre divisórias era zero. GREEN após o ajuste.
- 21 testes focados aprovados no Go Live real (`PORTAL_BASE_URL=http://127.0.0.1:5500`): espaçamento, fallback, responsividade, menu, GSAP e sequência dos cards.
- Larguras 320, 768, 1024 e 1440 verificadas; sem overflow ou erros JavaScript nas verificações do espaçamento.
- Capturas de desktop e celular inspecionadas em `/Users/nunes/.hermes/cache/scratch/sete-passos-section-spacing/`.
- Sintaxe e build aprovados.
- Suíte completa: 104 aprovados, 1 falha preexistente na busca textual sob a pilha (`tests/stack-navigation.spec.js:26`), sem alterações nessa pendência. Log em `/Users/nunes/.hermes/cache/scratch/sete-passos-section-spacing/full-suite.log`.
- Backup: `artifacts/backups/before-section-spacing-5ad2347a.zip`.
