# Abertura com a marca em primeiro plano

Pedido: Sete Passos maior e dominante ao entrar; texto abaixo menor.

- Ampliar a logo original, sem redesenhar, recortar ou distorcer o arquivo.
- Reservar mais largura para a marca e reduzir o título editorial abaixo. Encurtar o parágrafo de apoio, preservando os botões e a identidade.
- Alterações somente no hero de Início; não mudar Login, Fichas, navegação ou efeitos existentes.
- Aceite: a imagem ocupa mais de 60% da largura do hero e pelo menos duas vezes a altura do título nos tamanhos testados. Título até 36px em desktop e proporção original da imagem mantida.
- Validar 320/768/1024/1440, texto ampliado, teclado, Go Live e build. Inspecionar capturas reais antes de encerrar.

## Resultado verificado
- Logo ampliada de até 30rem para 48rem, preservando arquivo e proporções. Menos margem interna em telas pequenas para ampliar também a arte, não apenas a caixa.
- Título editorial reduzido e parágrafo resumido; sem alterar Login/Fichas ou seus tamanhos de texto.
- 69 testes da suíte aprovados; 24 regressões aprovadas em cada servidor (Vite, Go Live e build). Sintaxe e build aprovados.
- Quatro testes de hierarquia falharam antes e passaram depois da mudança.
- Capturas e relatório: `artifacts/apple/brand-focus/`.

