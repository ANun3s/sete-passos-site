# Sete Passos — diretrizes de implementação

## Contexto
- Front-end institucional de Sete Passos — Físio e Estética Avançada, com capa de login e biblioteca visual de fichas.
- Escopo atualizado: login e criar conta reais via Better Auth e PostgreSQL privado no Supabase; SQLite isolado permanece disponível nos testes. A área administrativa só é permitida à conta identificada pela variável privada `SETE_PASSOS_ADMIN_EMAIL`; o servidor valida cada sessão e protege documentos e APIs. A página pública de modelos foi movida para a administração. Fichas individuais estruturadas são preenchidas pela profissional na área de administração, associadas ao perfil selecionado e exibidas ao abrir o nome do cliente. Os valores usam o campo JSON privado já existente na tabela, com RLS e acesso de servidor; nunca expor fichas, credenciais ou IDs ao público, nem confiar no estado do navegador. Modelos demonstrativos seguem separados dos registros individuais.
- Trabalhar nesta pasta, já aberta no VS Code do usuário. Não alterar os outros projetos.
- A logo fornecida pelo usuário é a fonte de identidade. Preservar proporções e cores, mantendo o original em public/assets. Na abertura, usar o PNG transparente como primeira imagem da pilha CardSwap, sem deformar. Os cartões devem ser amplos, com títulos acima das imagens, avanço automático e arraste horizontal; incluir controles acessíveis, suspender fora da tela e desativar autoplay com movimento reduzido. Não interromper o autoplay apenas por hover.
- Diretrizes gerais adaptadas de `/Users/nunes/Documents/ChatGPT/site isp_ apple/AGENTS.md`. A marca elo e seu conteúdo não pertencem a este projeto.

## UI/UX
- Todas as páginas institucionais, exceto Login/Criar conta, devem usar o rodapé completo da página inicial, com o mesmo visual/conteúdo e links adaptados à rota. Por pedido explícito em 18/10/2026, Login/Criar conta usa uma única superfície de formulário centralizada, sem rodapé e sem painel azul lateral. A área administrativa usa rodapé compacto próprio. Preservar contato demonstrativo funcional e fallback sem JavaScript.
- Composição editorial de apresentação (Decide/Learn), branco e azul-marinho; serifada pontual para acolhimento e sans legível nos controles.
- Liquid Glass nas ações principais do conteúdo: transparência real, borda especular e aurora azul/ciano que acompanha o ponteiro. No cabeçalho, manter links discretos sem pílulas preenchidas, contornos ou brilho; indicar hover/página atual por sublinhado fino. Preservar foco visível e alto contraste.
- Por pedido explícito em 14/10/2026, manter rolagem nativa sem animações de scroll: não usar pin, scrub, parallax ou rolagem suave programada. Na seção “Nosso cuidado” da página inicial, a pasta React Bits abre cinco miniaturas por toque, clique ou teclado; a escolha amplia o card dentro do fluxo da seção, sem modal nem overlay. Não ligar a pasta à rolagem. Em movimento reduzido, manter a interação sem animação automática; fallback sem JavaScript continua em grade estática. Na página “Sobre”, animar somente a entrada das duas fotografias editoriais quando entrarem na área visível, sem pin ou scrub. O DitherVeil é autorizado na abertura da página “Sobre”, ao lado do título, com interação do cursor; em movimento reduzido, não animar a introdução automática nem ativar movimento autônomo. Incluir fallback estático e não levar o efeito a outras páginas. Por pedido explícito em 15/10/2026, a prévia das páginas do menu pode manter uma imagem editorial no desktop e trocar a foto com um crossfade GSAP quando cada item entrar na zona central da tela; ampliar o espaçamento vertical dos itens. Sem pin, scrub ou parallax nessa prévia. Em movimento reduzido, desativar a troca ligada à rolagem; foco/ponteiro pode trocar a imagem instantaneamente. No celular, não fixar o bloco. Imagens de casos são ilustrativas e não podem representar depoimentos ou resultados clínicos. Usar GSAP com escopo, limpeza e propriedades eficientes.
- Mobile, teclado, foco visível, alvos de pelo menos 44px e reduced motion são obrigatórios.
- A paleta pode ampliar azul/ciano com acentos discretos em lavanda, rosa, menta e âmbar. Aplicar como cor de apoio e luz de borda, mantendo texto com contraste alto e sem alterar a logo. Contornos com brilho seguem o ponteiro apenas em superfícies selecionadas e dispositivos com mouse; foco por teclado mantém estado visível, toque não depende de hover, reduced motion desativa o rastreamento contínuo e alto contraste troca o brilho por contorno sólido.
- Não inventar profissionais, credenciais, tratamentos, preços, contatos, depoimentos ou resultados clínicos.
- A página “Casos de sucesso” deve permanecer em estado vazio transparente enquanto não houver relatos reais aprovados; publicação exige autorização e contexto.
- Textos institucionais são propostas editoriais para validação. Agendamento/contato é demonstração explícita: não há transmissão nem persistência de dados.

## Implementação
- HTML semântico, CSS com tokens, JavaScript em módulos, Vite para desenvolvimento/build.
- Separar navegação, movimento e contato. Priorizar funções nativas do navegador.
- Testar um comportamento de cada vez: teste falhando, implementação, teste passando.
- Não publicar nem conectar serviços externos sem autorização.
- Testar build, erros do navegador, teclado, contato, movimento reduzido e larguras 320/768/1024/1440.

## Fontes de referência
- Impeccable (pbakaus/impeccable): hierarquia, composição própria e refinamento, sem copiar layouts.
- MDN: backdrop-filter, prefers-reduced-motion, HTML dialog e IntersectionObserver.
- Graphify antigo cobre somente elo; serve como mapa das referências anteriores, não como memória deste produto.

## Banco Supabase — etapa iniciada em 2026-10-07
- O usuário autorizou um novo projeto Supabase para o banco do login. Estrutura e testes em `supabase/`; detalhes em `supabase/README.md`.
- Manter Better Auth 1.7.7. Schema privado `sete_passos_auth`; não substituir por Supabase Auth ou expor tabelas pela Data API sem nova decisão explícita.
- Ativado em 2026-10-13 no projeto `sete-passos-sistema` (`jizynpvncmfpycexplnb`). O entrypoint usa Supabase quando o arquivo privado `supabase.env` está configurado. Conexão dedicada `sete_passos_app`, TLS validado e schema privado; configuração inválida interrompe o start, sem fallback silencioso.
- Nunca colocar conexão de banco ou senhas na raiz estática. Não migrar contas ou sessões locais automaticamente.

## Serviço local persistente — 2026-10-14
- O usuário pediu que o backend continue ativo independentemente dos créditos do chat. LaunchAgent `com.setepassos.backend` supervisiona a API na porta 3007 com KeepAlive.
- Gerenciar com `node scripts/backend-service.mjs install|status|restart|uninstall`. Não iniciar outra API na mesma porta nem deixar o serviço removido após testes.
- Credenciais e logs ficam no diretório privado existente fora da raiz web. Não alterar energia/suspensão do Mac ou contratar hospedagem implicitamente.
