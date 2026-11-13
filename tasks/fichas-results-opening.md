# Galeria em Fichas — abertura de quatro cards

## Contrato
- Alterar somente o workspace Sistema Sete Passos, sem deploy.
- Anexo recebido: FlexCarousel JS/CSS. Não instalar React/OGL nem capturar a roda: o pedido explícito posterior é uma pilha que se abre em quatro cantos, não um carrossel.
- Preservar a biblioteca de dois modelos visuais desativados, cabeçalho, links, marca, paleta e outras animações.
- Assets atuais contêm apenas marca e ilustrações; não há fotos de pacientes. Usar quatro estados vazios honestos, com quadro 3:2 preparado para imagem autorizada, sem alegações de resultados.

## Slices
1. **Galeria reversível** — teste de quatro figuras em Fichas, estado inicial, quatro cantos e caminho inverso. Reutilizar exatamente o coordenador e a timeline existentes. Novo CSS específico, carregado nas três entradas para navegação progressiva.
2. **Acessibilidade e ciclo de vida** — busca textual parcialmente coberta, atalho aos modelos, fallback estático sem JS/reduced/print/texto ampliado, resize e remount sem triggers duplicados. Corrigir pendência de seleção por teste RED/GREEN.
3. **QA e entrega** — imagens em 0/25/50/75/100% e inverso, 320/768/1024/1440, Vite/Go Live, suíte e build. Bug anterior de reload tratado separadamente sem persistência clínica.

## Ownership
- `.scroll-stack-card`: enquadramento pelo coordenador existente.
- `.care-card`: posição/escala/rotação pelo `createCareSequence` existente.
- `.tilted-card-inner`: tilt leve do ponteiro, módulo existente.
- Uma instância da página por vez; cleanup via AbortSignal ao navegar.

## Verificação executada
- RED: galeria inexistente (`expected 4, received 0`); GREEN: quatro espaços e composição reversível.
- RED: busca na home a 53% mantinha `opening` e cobria primeiras letras; GREEN: seleção preservada e cada caractere atingível após revelar o estado de leitura.
- RED: atalho não transferia foco; GREEN: destino `tabindex=-1`, Tab chega ao summary e Enter expande a ficha.
- RED: texto auxiliar abaixo de 12px após escala; GREEN: .9375rem nos quadros/legendas.
- 14 testes novos/focados aprovados em Go Live, incluindo quatro larguras, axe, fallback, seleção e retorno de rota.
- Suíte Vite: **136 testes aprovados**, sem pulados; regressões Go Live: **66 aprovados** com `PORTAL_BASE_URL=http://127.0.0.1:5500`.
- `npm run check` e `npm run build`: exit 0.
- 18 capturas da ida/volta em Vite e Go Live, mais mobile/tablet/print/texto 200%, em `/Users/nunes/.hermes/cache/scratch/sete-passos-fichas/`.
- Inspeção visual dos cinco estados em 1440×900 confirma pilha, ordem sequencial, quatro cantos e limites. Screenshot de print foi enviado à revisão para distinguir possível oclusão de artefato de captura.
- Reload corrigido com `overflow-anchor: none` restrito à árvore animada em `scroll-stack.css`; sem storage, novo timer ou alteração do coordenador. Seis casos (18/53/95% em home/Fichas) também reexecutados pelo agente principal no Go Live: scroll e geometria preservados, exit 0. Os mesmos casos integraram a suíte Vite de 136 e o recorte Go Live de 66 aprovados.
- Revisão independente da galeria ainda aguardada; não fechar a etapa final antes do retorno.

## Limitações
- Fotos reais e consentimento de uso ainda não fornecidos. Não considerar essa dependência concluída.
- Os modelos continuam demonstrativos; não coletam nem salvam dados.
