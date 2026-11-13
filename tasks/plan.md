# Plano — front-end Sete Passos

Pedido: azul-marinho/branco, logo real no hero, botões Liquid Glass transparentes com aurora no hover, efeitos de rolagem e uso do AGENTS.md. Correção incorporada: implementar diretamente na pasta Sistema Sete Passos aberta no VS Code.

## Slices e dependências
1. Identidade e estrutura responsiva: assets locais + HTML/CSS. Aceite: logo preservada e seções navegáveis em 320–1440px. Verificação: teste de abertura/links e inspeção visual.
2. Movimento e navegação: depende de 1. Aceite: menu operável no teclado; aurora interativa; revelações/progresso/parallax com reduced-motion. Verificação: Playwright, screenshots hover/mobile e modo sem JS.
3. Contato demonstrativo: depende de 1. Aceite: diálogo acessível, seleção de área, mensagem local copiável, sem rede/coleta. Verificação: abertura, teclado/Escape, clipboard e fallback.
4. Entrega: build e auditoria axe sem violações sérias; console sem erros; código aberto no VS Code e prévia local.

## Riscos
- Dados reais da clínica ausentes: não inventar; identificar a demonstração.
- Efeitos translúcidos: preservar contraste e fallback sólido quando necessário.
- Não depender de CDNs em runtime; hospedar fontes e logo localmente.

## Aprovação
Escopo visual autorizado pelo pedido do usuário; usar a pasta aberta no VS Code, conforme correção explícita. Sem deploy.

## Ampliação: páginas e cortina
Escopo confirmado em duas perguntas: login apenas como capa; fichas de anamnese e limpeza de pele. Contrato em `tasks/pages-spec.md`.
1. Páginas: criar `login.html`, `fichas.html`, `src/portal.css`; integrar links no index; testar navegação real e modelos sem coleta.
2. Cortina: `src/page-curtain.js`, `src/curtain-effect.js`, `src/page-curtain.css`; integrar o entrypoint e o ciclo de vida dos módulos. Testar direção, ponto de troca, pending, histórico e foco.
3. Build e acabamento: entradas multipágina Vite; testes em 320/768/1024/1440, sem JS e sem View Transitions, movimento reduzido, Go Live e build estático. Documentar parâmetros e evidências.
Riscos: listeners duplicados após troca de DOM (AbortSignal e cleanup); captura causando reload no Go Live (guardar imagens em memória); login/fichas confundidos com sistema clínico (controles inativos e aviso explícito).

## Cards de cuidado e coordenação de rolagem
Escopo atualizado: quatro cards partem de uma pilha central e abrem para quatro cantos em duas colunas, com redução leve de escala, rotações opostas e reversão vinculada ao scroll. Contrato atual: `tasks/four-card-opening.md` (substitui a sequência lateral de dois cards). Ordem: quatro conteúdos existentes e fallback legível → GSAP na timeline única → foco/seleção/resize/reduced-motion → QA visual, Go Live/build e revisão. Preservar a logo principal removida, o menu discreto e o respiro entre divisórias.

## ScrollStack em escala de seções
Contrato: `tasks/scroll-stack.md`. Pedido atual substitui o trabalho interrompido no fundo magnético da logo; não implementar esse outro efeito nesta etapa. Ordem: teste de sobreposição real → adaptação HTML/CSS/JS + dependência do registro → âncoras/teclado/alturas variáveis → Go Live/build/capturas/revisão.

## Galeria de resultados na página Fichas
Contrato: `tasks/fichas-results-opening.md`. Reutilizar `care-sequence.js` e `scroll-stack.js` com um único slot na rota Fichas, sem React, OGL ou outro controlador. O FlexCarousel do anexo não reproduz o espalhamento solicitado; a descrição explícita de quatro cantos prevalece. Conteúdo real indisponível: quatro espaços claramente vazios, sem resultados ou pacientes inventados. Manter os modelos demonstrativos e oferecer atalho para eles.

## Refinamento Apple
Contrato e auditoria: `tasks/apple-refinement.md`. Ordem: materiais/feedback → molas da logo/menu → testes responsivos e de acessibilidade → evidências e documentação. Preservar todos os fluxos existentes e os limites de privacidade; não incluir fotos ainda não fornecidas.
