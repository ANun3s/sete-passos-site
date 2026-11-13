# Refinamento — centralização, logo interativa e rodapé

## Pedido atual
Centralizar mais o conteúdo e a logo; acrescentar movimento/profundidade e borda que acompanha o mouse na logo; adaptar o rodapé do site oficial do Hermes. O anexo de Aura é referência de vidro, profundidade e composição central, não troca de marca, conteúdo clínico, stack ou backend.

## Superfície e contrato visual
Landing page de apresentação/Decide-Learn. Manter branco, azul-marinho, logo original, DM Sans/Instrument Serif e todos os fluxos existentes. Hero com eixo central: título, texto, ações e marca. Títulos de seção centralizados, áreas de leitura com largura controlada; listas/FAQ mantêm alinhamento interno legível. Evitar centralizar parágrafos longos em colunas muito largas.

## Evidência de referência
Página oficial `https://hermes-agent.nousresearch.com/` inspecionada no navegador. Existem dois footers: um claro com lettering Hermes e outro global azul com imagem monumental, marca ampla e navegação em colunas. A adaptação usa a composição final global, não apenas o primeiro elemento footer. Não copiar a arte, logos Nous/Hermes, fonte proprietária, links comerciais ou identidade cromática elétrica.

## Etapas e aceite
- [x] Layout: centros do hero, logo e cabeçalhos de seção alinhados ao centro do viewport em 320/768/1024/1440px, sem overflow.
- [x] Logo: tilt 3D limitado, profundidade em camada separada e borda com destaque seguindo posição/ângulo do ponteiro; mouseleave/pointercancel/blur restauram repouso; reduced-motion/touch não exigem hover nem animam tilt.
- [x] Footer: composição ampla azul-marinho, assinatura tipográfica Sete Passos, colunas úteis e links reais internos; nenhum contato ou dado clínico inventado.
- [x] Verificação: 25 testes passando, incluindo a instância real do Go Live, geometria/ponteiro/fallback e axe; check e build concluídos. Auditoria npm sem vulnerabilidades reportadas.

## Preservação
Snapshot da versão anterior criado e validado em `artifacts/backups/`. Sem alterações em outros projetos ou configurações globais do VS Code. O backend continua fora do escopo.

## Correção solicitada no Go Live
O Live Server em 5500 retornava 404 para `/assets/logo-sete-passos.webp`, enquanto `/public/assets/logo-sete-passos.webp` retornava 200. O mesmo desencontro afetava as fontes. A configuração local `.vscode/settings.json` agora monta `/assets` e `/fonts` a partir das pastas correspondentes em `public`, sem mudar os caminhos utilizados no Vite. O servidor foi reiniciado pelo controle de status do VS Code e a logo passou a responder 200; o teste real verificou carregamento, fontes, hover 3D e contato.

## Revisão
Logo e rodapé em módulos próprios, sem novas dependências. Conteúdo e navegação preservados, sem contatos inventados ou transmissão de dados. Parallax e inclinação em camadas distintas, frames limitados e ausência de loops contínuos. Centralização e vidro são decisões explícitas do pedido; acordeões permanecem legíveis e não foram substituídos por cards genéricos. A âncora de retorno fica no início estático do documento para funcionar com o header sticky.
