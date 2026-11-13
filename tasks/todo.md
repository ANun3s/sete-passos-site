# Verificação de entrega

## Galeria em Fichas — pedido retomado
- [x] Quatro espaços de foto, sem conteúdo clínico inventado; modelos preservados.
- [x] Pilha → quatro cantos com scrub/reversão e controlador existente.
- [x] Seleção, navegação, resize, print, reduced-motion, mobile e texto ampliado: regressões automatizadas aprovadas; inspeção adicional de impressão em revisão.
- [ ] Verificação visual, regressões Vite/Go Live, check/build e revisão.
- [ ] Receber fotos reais e confirmação de autorização para uso (dependência do usuário).

## Quatro cards — abertura vinculada ao scroll
- [x] Quatro cards com conteúdos existentes, ações preservadas e fallback legível.
- [x] Pilha central com camadas visíveis → quatro cantos, escala/rotação, prioridade sobre a próxima seção e reversão contínua.
- [x] Responsividade, foco/seleção, movimento reduzido, resize e remount sem vazamentos.
- [x] Capturas da sequência, regressões Vite/Go Live e build.
- [x] Revisão independente concluída; dois problemas reproduzidos e corrigidos com testes RED/GREEN. Evidências em `tasks/four-card-opening.md`.

## ScrollStack — seções inteiras
- [ ] Teste RED/GREEN da próxima seção cobrindo a anterior e reversão da rolagem.
- [ ] Registry original/atribuição, Lenis instalado e adaptação sem React no site existente.
- [ ] Alturas variáveis, detalhes expandidos, âncoras, teclado, reduced motion e cleanup.
- [ ] Quatro larguras, Go Live/build, revisão visual, suíte e documentação.

- [x] Slice 1: logo preservada, identidade e layout responsivo.
- [x] Slice 2: menu, aurora, progressão, revelações e reduced-motion.
- [x] Slice 3: painel de contato explicitamente demonstrativo.
- [x] Testes de navegação, teclado e larguras 320/768/1024/1440.
- [x] Build e auditoria de acessibilidade.
- [x] Código aberto no VS Code; servidor e prévia funcionando.

## Páginas: escopo confirmado
- [x] Login como capa: campos desativados, aviso e link funcional para fichas. Verificado com Playwright.
- [x] Fichas de anamnese e limpeza de pele: modelos visuais expansíveis, sem preenchimento ou persistência. Verificado também sem JavaScript.
- [x] Cortina de 780ms/9°: direção por índice, troca na cobertura, bloqueio de cliques, histórico, foco e anúncio. Eventos e imagens verificados.
- [x] Fallback sem View Transitions e movimento reduzido instantâneo. Verificado em contextos dedicados.
- [x] Build multipágina, assets no Go Live, axe e 320/768/1024/1440 sem regressões. Evidências e parâmetros registrados no README.
- [x] Revisão independente: cancelamento por histórico, foco em fragmentos e fechamento do modal corrigidos após reprodução. Quatro regressões aprovadas no Vite, Go Live e build.

Entrega anterior: 49 testes da suíte aprovados, sintaxe e build aprovados, auditoria sem vulnerabilidades reportadas. Evidências em `artifacts/pages/verification.md` e `artifacts/pages/report.json`.

## Refinamento Apple
- [x] Revisão independente final: foco ao fechar o contato corrigido com testes RED/GREEN; menu validado também em 320×320. Suíte final e regressões nos três servidores aprovadas.
- [x] Materiais sem blur sobre blur, maior legibilidade e feedback imediato, sem reação em disabled.
- [x] Molas reversíveis para logo e menu; teclado, repouso e movimento reduzido preservados.
- [x] Testes completos, texto ampliado, quatro larguras, Go Live/build, capturas e documentação.
