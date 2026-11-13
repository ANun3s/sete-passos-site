# ScrollStack — divisórias em escala de página

## Escopo autorizado
Empilhar as seções reais da página inicial em vez de adicionar os cartões fictícios Card 1–3. Preservar abertura com marca grande e superfícies claras já aplicadas. O pedido atual toma o lugar do efeito magnético interrompido; esse efeito não faz parte desta entrega.

## Fonte e integração
- Buscar o registry exato `https://reactbits.dev/r/ScrollStack-JS-CSS.json`, preservar JSX/CSS e licença em `references/react-bits/`.
- Instalar a dependência listada `lenis@^1.3.13`. O projeto não é React/shadcn; integrar manualmente um adaptador vanilla em vez de executar um scaffold ou converter as páginas.
- Adaptar progressão de escala/pinning e cache de transforms do ScrollStack. Lenis observa a janela em modo nativo (`smoothWheel: false`, `syncTouch: false`), sem scrollbar interna nem loop de animação ocioso.
- Servir o módulo ESM da dependência localmente para Vite, Go Live e build, com cópia reproduzível a partir do pacote travado.

## Slices e aceite
1. **Pilha real**: abertura + faixa de valores, cuidado, essência, dúvidas e contato em cinco painéis opacos de largura total. Próximo painel sobe sobre o anterior, que recua levemente; voltar o scroll desfaz a animação sem salto. Teste antes da implementação com bounds e hit-test reais.
2. **Conteúdo e controles**: sem alturas fixas que cortem texto. Painéis maiores que o viewport rolam até o fim antes de prender; detalhes reabertos recalculam geometria. Navegação por âncora, Tab/Shift+Tab e contato permanecem utilizáveis mesmo se um painel estiver coberto. Header fica acima da pilha; rodapé encerra o fluxo normalmente.
3. **Fallback e entrega**: sem JS ou com movimento reduzido, fluxo normal sem pin/escala; mudanças de preferência em execução e troca de rota limpam estilos/listeners/Lenis. Testar 320/768/1024/1440, fonte 200%, toque, erros de console, Vite/Go Live/build; capturas reais nas transições e revisão independente.

## Direção visual
Branco, paper e ice; sombras leves e bordas superiores arredondadas para tornar a sobreposição perceptível. Sem blur no texto nem rotação dos painéis; sem alteração dos textos, fichas ou autenticação. Movimento acompanha diretamente a rolagem, sem scroll-jacking.
