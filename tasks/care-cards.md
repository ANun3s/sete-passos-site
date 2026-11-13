# Cards de cuidado + prioridade na rolagem

## Contrato atual
Na seção Diferentes caminhos, substituir os dois acordeões por cards de Fisioterapia e Estética avançada inspirados no TiltedCard anexado. Manter todo o conteúdo e os contatos demonstrativos por área. Preservar a abertura sem logo principal e a paleta clara. O usuário pede explicitamente que a animação principal de ScrollStack seja integrada e coordenada com a dos cards, retomando esse escopo.

## Fatias e aceite
1. **Cards reais** — duas superfícies grandes lado a lado, inicialmente agrupadas no centro, ilustrações abstratas locais (não fotos/resultados de pacientes), títulos, descrições e CTAs. Tilt com Motion em camada interna, suave e reversível; layer externo dedicado ao deslocamento de scroll. Teclado/toque sem exigir hover. Testar estrutura/conteúdo/contato antes e depois.
2. **Sequência de rolagem** — usar cinco painéis de seções no mesmo fluxo da janela. Ao fixar Cuidado, consumir um trecho de rolagem só para deslocar os cards até as bordas laterais com margens seguras; manter a posição final por um pequeno trecho. Só então Essência começa a sobrepor Cuidado e a pilha volta a avançar. Voltar o scroll desfaz toda a sequência. Nenhum preventDefault de roda/toque ou scrollbar interna.
3. **Fallback e ciclo de vida** — tamanhos reais/reflow; cards empilhados em celular estreito e sem deslocamento lateral quando não cabe. Sem pin/escala com reduced motion, texto ampliado ou viewport baixo incompatível. Preservar todas as âncoras, foco e navegação com/sem JS e pela cortina. Limpar observadores/listeners/molas/Lenis após trocar página.
4. **Verificação** — testes RED/GREEN por fatia, suíte, build, Go Live, capturas inicial/meio/final/retomada e quatro larguras, revisão independente e documentação. Nenhuma publicação.

## Integração
O site permanece HTML/CSS/JavaScript. Fonte React preservada em references/react-bits; adaptação usa Motion JS e Lenis instalado em modo de rolagem nativa. Runtime ESM local gerado reproduzivelmente para funcionar também no Go Live. Não adicionar React/shadcn nem um segundo projeto.

## Arquivos por fatia
- Cards: index.html, src/care-cards.css, src/tilted-card.js, assets SVG; testes dedicados.
- Sequência: src/scroll-stack.js + CSS, src/care-sequence.js, src/scroll-position.js; integração no main e links CSS compartilhados.
- Empacotamento: script de runtime local, package/lock; referências originais e licenças.
