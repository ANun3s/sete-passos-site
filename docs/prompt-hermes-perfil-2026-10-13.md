Implemente diretamente no projeto Sete Passos, em /Users/nunes/Documents/Sistema Sete Passos, uma área pessoal completa após o login. Este é o próximo pedido do usuário neste mesmo chat. Preserve todas as ideias e decisões visuais já aprovadas e as alterações recentes. Trabalhe nos arquivos do computador e entregue o fluxo funcionando; não se limite a explicar como fazer.

PEDIDO CENTRAL
Quando a pessoa fizer login, deve entrar na sua própria página de perfil, com um ícone de bonequinho cinza quando ainda não tiver foto. Ela poderá adicionar, trocar e remover a foto, consultar suas informações e suas fichas, editar o nome e o email (inclusive Gmail) e alterar a senha. A experiência deve parecer parte do mesmo site Sete Passos, com acabamento visual cuidadoso.

1. CONTEXTO E SKILLS
Antes de editar, leia AGENTS.md, DESIGN-SYSTEM.md, package.json, a implementação de login/criar conta, a navegação, fichas.html, o servidor e os testes pertinentes. Confira o estado atual dos arquivos e preserve trabalho em andamento. O projeto é HTML semântico + CSS + JavaScript em módulos com Vite, Better Auth 1.7.7 e PostgreSQL privado no Supabase. Não troque a stack ou o sistema de autenticação. O schema sete_passos_auth e a conexão dedicada já existentes devem continuar privados. Não copie a marca elo.

O usuário quer aproveitar suas skills de design. Consulte o catálogo /Users/nunes/Documents/Obsidian Vault/Referências/Catálogo de skills disponíveis.md e carregue todas as pertinentes a este fluxo, por etapa, evitando recomendações incompatíveis. As skills pessoais estão em /Users/nunes/.codex/skills/<nome>/SKILL.md; podem ser lidas diretamente mesmo que o Hermes não as liste.
- apple-design: princípios de hierarquia, layout, tipografia, formulários, contas, acessibilidade, ícones e materiais, adaptados à web.
- plan-screen e to-wireframe: organização da página e de seus estados. O objetivo e a direção estão definidos neste pedido; use um wireframe ASCII compacto para orientar a implementação e siga as preferências atuais do usuário.
- extract-ds: aproveite os tokens e componentes reais do projeto. Não execute o fluxo de copiar o site inteiro ou criar outro design system; esta tarefa é adicionar a página ao produto existente.
- gsap-core, gsap-timeline, gsap-performance, gsap-utils, gsap-plugins e gsap-scrolltrigger: aplique apenas o que fizer sentido para movimento e integração já existentes. A página de perfil precisa permanecer fácil de usar. gsap-react/gsap-frameworks só se a tecnologia correspondente realmente existir; não introduza React para usar uma skill.
- frontend-ui-engineering e referências de Impeccable já presentes no Hermes: refinamento e consistência.
- better-auth-best-practices e email-and-password-best-practices: sessão, atualização de dados, verificação de email, recuperação e troca de senha.
- supabase-postgres-best-practices e a skill supabase do plugin, se disponível: leia antes de alterar consultas ou banco.
Use skills de Figma ou geração de imagens apenas se necessárias ao resultado. O avatar cinza pode ser SVG local ou ícone existente. A instalação de uma skill não configura serviços ou concede permissão de upload. Priorize as instruções deste pedido em decisões de escopo.

2. FLUXO APÓS LOGIN
- Crie uma rota/página de perfil coerente com a estrutura atual, por exemplo perfil.html, protegida por sessão válida no servidor.
- Após autenticação bem-sucedida, abra o perfil; preserve um destino interno protegido previamente solicitado quando o fluxo atual já oferecer isso e ele for seguro.
- No cabeçalho, substitua a ação de entrar pela foto/ícone e um acesso claro a “Meu perfil” quando autenticado. Disponibilize “Sair”.
- Ao abrir o perfil sem sessão ou com sessão expirada, encaminhe ao login sem mostrar dados pessoais. Valide qualquer returnTo para aceitar somente destinos internos.
- Consulte a sessão real pelo mecanismo existente. Não use flags no localStorage como autenticação, não simule usuário logado e não confunda esconder conteúdo no front-end com autorização.
- Atualizações e logout devem refletir no cabeçalho e no perfil. Considere expiração da sessão durante edição sem salvar alterações indevidas.

3. COMPOSIÇÃO VISUAL
Mantenha identidade azul-marinho e branca, logo aprovada, tipografia e tokens atuais. Use Liquid Glass de forma moderada nas ações adequadas, preservando legibilidade. Mantenha a navegação discreta e o rodapé completo da página inicial, como já solicitado.

Estruture a página assim:
- Cabeçalho “Meu perfil”, saudação com o nome real, avatar e ação “Alterar foto”.
- “Informações pessoais”: nome e email da conta, com ações claras de edição.
- “Minhas fichas”: acesso aos registros realmente vinculados à pessoa autenticada, respeitando o que já existe no produto.
- “Segurança”: estado da senha, botão “Alterar senha” e acesso a recuperação quando pertinente.
- Ação “Sair da conta” facilmente encontrada.

Desktop: composição organizada, avatar/resumo ao lado dos detalhes quando houver espaço; largura confortável e áreas alinhadas. Celular: uma coluna, avatar no topo, campos sem cortes e ações acessíveis ao toque. Evite uma grade de cartões decorativos iguais. Agrupe informações por finalidade, com títulos e divisores sutis. Não altere a página inicial, a logo ou as animações aprovadas para fazer esta entrega.

4. AVATAR E FOTO EDITÁVEL
- Sem foto, mostre exatamente um bonequinho/silhueta humana CINZA dentro de um círculo neutro, sem foto de pessoa aleatória ou avatar gerado. Deve aparecer no perfil e, em tamanho reduzido, no cabeçalho.
- Permita selecionar uma imagem, visualizar a prévia, confirmar “Salvar foto”, cancelar a seleção e remover a foto atual para voltar ao bonequinho.
- Aceite JPEG, PNG e WebP, com limite claro, por exemplo 5 MB. Valide tamanho, extensão, MIME e conteúdo real no servidor; rejeite SVG/HTML e arquivos inválidos. Limite também dimensões para evitar imagens excessivas.
- Apresente enquadramento circular consistente com object-fit: cover. Se adicionar recorte/reposicionamento, implemente-o por completo, incluindo teclado e cancelamento; não deixe controles decorativos.
- Ao persistir, gere nomes seguros no servidor, use armazenamento adequado fora da raiz pública para originais privados e associe ao ID da sessão. Não confie em userId informado pelo navegador.
- Prefira armazenamento já configurado. Se não existir, implemente armazenamento local privado para desenvolvimento, com interface substituível; não crie bucket público ou serviço pago automaticamente. Para um storage privado já autorizado, sirva imagem por rota autenticada ou URL temporária conforme a arquitetura real.
- Redimensione/reencode quando houver ferramenta apropriada e remova metadados desnecessários. A foto anterior deve continuar válida se o upload falhar. Libere object URLs da prévia ao trocar/cancelar.
- Persistência deve sobreviver a recarregar a página e iniciar nova sessão. Não armazene a imagem inteira em localStorage nem trate apenas a prévia como salvamento.

5. NOME E EMAIL/GMAIL
Mostre os valores reais da conta, sem exemplos apresentados como dados verdadeiros. Use “E-mail” como rótulo: Gmail é aceito, mas não limite o cadastro a @gmail.com e não adicione OAuth Google só por essa palavra.

Ofereça edição com rótulos permanentes, autocomplete adequado, “Salvar alterações” e “Cancelar”. Valide e normalize no servidor sem rejeitar nomes legítimos; preserve o preenchimento se ocorrer erro. Mostre sucesso apenas após a persistência confirmada. Reutilize métodos oficiais do Better Auth para atributos geridos por ele, evitando atualização paralela que deixe sessão e banco inconsistentes.

Para trocar email, use o fluxo suportado de verificação/reautenticação, trate endereço já utilizado e exiba a alteração pendente até a confirmação necessária. Não marque um novo email como verificado automaticamente. Se o transporte de email não estiver configurado, explique na interface o estado indisponível e na entrega a configuração pendente; não finja enviar email ou confirmar endereço.

6. SENHA E RECUPERAÇÃO
O usuário quer uma seção para sua senha e opções de alteração. NÃO recupere nem mostre a senha atual, hash ou segredo. Mostre “Senha definida” ou estado equivalente verdadeiro e o botão “Alterar senha”. Para conta sem senha local, apresente o fluxo adequado ao método de acesso existente.

O formulário de alteração deve conter “Senha atual”, “Nova senha”, “Confirmar nova senha”, botões acessíveis de mostrar/ocultar apenas o que a pessoa digitou, “Salvar nova senha” e “Cancelar”. Use autocomplete=current-password e new-password. Não preencha campos com senha salva. Siga a política já configurada no Better Auth, valide no servidor e dê orientações úteis, sem inventar regras divergentes.

Exija sessão válida e validação da senha atual/reautenticação conforme o provedor. Use a API oficial para troca; não escreva diretamente nas tabelas de credenciais nem crie criptografia caseira. Nunca envie senha para logs, analytics, URL, banco em texto puro ou armazenamento do navegador. Trate senha atual incorreta, confirmação divergente e sessão expirada. Revalide a sessão e revogue outras sessões conforme as opções suportadas e o comportamento informado à pessoa.

Inclua “Esqueci minha senha” pelo fluxo oficial já existente ou implementado: token de curta duração e uso único, proteção contra abuso e resposta que não revele se um endereço está cadastrado. Só informe “email enviado” quando o transporte efetivamente aceitar o envio. Credenciais e configurações continuam exclusivamente no servidor.

7. MINHAS FICHAS E INFORMAÇÕES DA CONTA
Leia o modelo real antes de criar entidades. AGENTS.md informa que as fichas de avaliação/proposta existentes são modelos visuais com campos desativados. Preserve essa distinção.
- Se já houver registros pessoais, liste somente os pertencentes à pessoa autenticada, com título/tipo, data e status somente quando esses dados existirem, e ação de visualizar.
- Se houver apenas modelos, apresente acesso separado a “Modelos de fichas” e estado vazio honesto em “Minhas fichas”: “Você ainda não possui fichas vinculadas à sua conta”. Não transforme modelos em registros pessoais fictícios.
- Não crie prontuários, preenchimento clínico, dados médicos demonstrativos, funções administrativas ou novas permissões de acesso neste pedido. Preserve campos clínicos desativados e explicite qualquer limitação real.
- Todas as consultas e acessos a detalhes/anexos devem verificar vínculo/autorização no servidor. Trocar um ID na URL não pode revelar dados de outra conta. Nunca retorne campos sensíveis de outra pessoa.
- Mostre outras informações pessoais apenas se já existirem e forem pertinentes ao titular. Não exponha IDs técnicos, tokens, hashes ou configurações de infraestrutura como “informações do perfil”.

8. IMPLEMENTAÇÃO, ESTADOS E ACESSIBILIDADE
Reaproveite componentes, CSS e módulos existentes. Separe leitura de sessão, operações de perfil, upload e comportamento visual. Use APIs/migrações compatíveis com o backend atual, sem trocar Better Auth por Supabase Auth. Migrações devem ser incrementais e revisáveis; não executar mudanças destrutivas, reset de banco ou migrações remotas fora da autorização já existente. Se houver limite de autorização, conclua os arquivos, migrações e validação local e informe precisamente o passo pendente. Não faça deploy.

Forneça carregamento, estado vazio, erro com tentar novamente, sucesso e botões indisponíveis durante submissão. Evite envios duplicados, saltos de layout e perda de dados em erro. Confirme salvamento pela resposta do servidor. Preserve cookies e proteções de origem/CSRF existentes; limite abuso das rotas sensíveis.

Use HTML semântico, labels, foco visível, navegação por teclado, aria-live para feedback e mensagens associadas ao campo. Em diálogos, gerencie foco inicial, contenção e retorno, Escape/cancelamento. Alvos de toque de pelo menos 44px. Contraste suficiente e textos legíveis. Animações discretas de entrada e feedback, preferindo opacity/transform, com prefers-reduced-motion; não coloque scroll pinning, parallax ou 3D sobre formulários e controles. Preserve a rolagem natural.

9. VERIFICAÇÃO E ENTREGA
Execute os checks, build e testes pertinentes do projeto. Valide desktop e celular, incluindo 320/768/1024/1440, teclado e movimento reduzido; confira Safari/WebKit porque esse é um navegador usado pelo usuário.
Verifique pelo menos:
1) login real abre o perfil correto; sessão inválida bloqueia acesso;
2) bonequinho cinza aparece quando não há foto, incluindo fallback de erro de imagem;
3) upload/troca/remoção funcionam, persistem e tratam arquivo inválido;
4) nome atualizado aparece também no cabeçalho após recarregar;
5) troca de email respeita verificação ou informa indisponibilidade real;
6) troca de senha válida funciona, a anterior deixa de autenticar e a nova funciona; use contas sintéticas isoladas, nunca altere a senha real do usuário para testar;
7) recuperação não simula envio;
8) duas contas de teste não acessam dados/fotos/fichas privadas uma da outra;
9) fichas vazias/modelos são apresentados honestamente;
10) logout encerra acesso e as páginas existentes, rodapé, logo e animações continuam funcionando.

Faça testes com dados sintéticos e ambiente isolado sempre que possível. Não exponha credenciais nos resultados. Entregue um resumo em português do que foi implementado, arquivos/rotas principais, como abrir o perfil, verificações realizadas e eventuais dependências reais. Não declare pronto um fluxo que esteja simulado ou não verificado. Mantenha a intenção original do usuário: um perfil bonito, pessoal e útil, com bonequinho cinza, foto alterável, nome, email, fichas e gerenciamento seguro da senha.
