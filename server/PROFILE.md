# Perfil pessoal — contrato do backend

## Rotas para integração

Todas as respostas de perfil e suas imagens usam `Cache-Control: no-store`. A sessão é consultada no banco, sem cache de cookie. Nenhum parâmetro `userId` é usado para autorizar ou escolher uma conta.

- `GET /api/profile` → `{ user: { name, cpf, image }, security: { hasPassword, minPasswordLength, maxPasswordLength }, capabilities: { cpfChange, emailChange, passwordReset }, fichas: [] }`. O CPF é um identificador privado: só aparece para a própria sessão e para a área administrativa autorizada.
- `POST /api/profile/name` JSON `{ name }` → `{ ok: true }`. Normaliza NFC, espaços e margens; aceita nomes Unicode, até 100 pontos de código; rejeita vazio e controles. Somente `name` é encaminhado a `auth.api.updateUser`.
- `POST /api/profile/password` JSON `{ currentPassword, newPassword, confirmPassword }` → `{ ok: true }`. Usa `auth.api.changePassword` com `revokeOtherSessions: true`, sem aceitar substituição dessa política. O Better Auth 1.7.7 revoga todas as sessões anteriores e cria a substituta; `Set-Cookie` é preservado. O token retornado internamente nunca é copiado para o JSON do endpoint.
- `POST /api/profile/avatar` multipart com exatamente um arquivo no campo `photo` → `{ ok: true }`.
- `POST /api/profile/avatar/remove` JSON `{}` → `{ ok: true }`. Idempotente.
- `GET /api/profile/avatar?v=<versão>` → WebP privado da pessoa da sessão, ou 404. `v` é cache-busting, NÃO seletor de proprietário/arquivo. Copiar a URL de outra conta nunca lê a foto dela.
- `POST /api/profile/email` JSON `{ newEmail, currentPassword }` → **501 `EMAIL_UNAVAILABLE`**. Não altera e-mail nem verificação.
- `POST /api/profile/cpf` JSON `{ cpf }` → `{ ok: true }` para vincular o CPF a uma conta antiga ainda sem CPF; valida os dígitos e impede duplicidade. Um CPF já associado não pode ser trocado por esta rota.
- `POST /api/auth/sign-up/email` recebe `{ name, identifier, password }` com um CPF válido ou e-mail válido. CPF inválido retorna `400 INVALID_CPF`; e-mail malformado retorna `400 INVALID_EMAIL`. O endereço da conta administrativa configurada é reservado e continua exigindo o acesso Google verificado. Cadastros comuns por e-mail/senha não confirmam a caixa postal, pois nenhum transporte de e-mail está configurado.
- `POST /api/auth/sign-in/email` recebe `{ identifier, password }` e aceita CPF válido ou e-mail já cadastrado na mesma caixa. Não é necessário cadastrar os dois. E-mails antigos continuam aceitos; cadastros feitos com CPF mantêm o CPF no perfil. O CPF nunca é convertido em e-mail e não perde a função de identificador.
- A confirmação e a recuperação por e-mail seguem indisponíveis até configurar um provedor de envio; contas cadastradas com e-mail não podem recuperar senha por e-mail. A vinculação automática com Google exige que o e-mail local já esteja verificado.
- `GET /api/me` e o endpoint compatível de leitura própria `/api/users/:id` acrescentam `user.image`, contendo apenas a referência privada sanitizada ou `null`.
- `GET /api/health` preserva `ok` e `signUpEnabled`, acrescentando `capabilities: { cpfChange: true, emailChange: false, passwordReset: false }` e `passwordPolicy: { minPasswordLength: 12, maxPasswordLength: 128 }`.
- `GET /perfil.html`: exige sessão; sem ela retorna **303 `/login.html?returnTo=%2Fperfil.html`**. Com sessão serve exclusivamente o arquivo conhecido `perfil.html` como `text/html`, sem inserir dados pessoais. Não é um servidor estático geral. O frontend/Vite deve continuar responsável pela transformação de HTML/assets e pelo guard da sua própria entrega de shell.

Após qualquer mutação bem-sucedida, consultar novamente `/api/profile` e `/api/me`; o browser deve aceitar o cookie substituído na troca de senha.

## Imagem e armazenamento

`sharp` **0.35.5** é a única dependência acrescentada (`package.json` e lockfile). Better Auth permanece **1.7.7**. JPEG (`.jpg/.jpeg`), PNG e WebP precisam de extensão, MIME e assinatura/conteúdo concordantes. SVG, HTML, formatos divergentes, arquivos truncados e animações são rejeitados. Limites:

- 5 MiB (5 × 1024 × 1024 bytes) por arquivo;
- 64 KiB adicionais no envelope multipart, inclusive quando enviado em chunks;
- 8192 pixels por dimensão e 16 milhões de pixels no total;
- derivada centralizada 512 × 512 WebP, qualidade 85, orientação aplicada e sem metadados EXIF/ICC;
- originais não são escritos em disco.

`createLocalServer({ avatarDirectory })` permite indicar armazenamento privado externo ao webroot. Sem override usa `${databasePath}.avatars` quando há caminho de banco (inclusive testes); sem esse caminho usa `~/Library/Application Support/Sete Passos Development/avatars`. Diretórios 0700, arquivos 0600, nomes gerados por servidor. A subpasta do titular é derivada do ID da sessão; a URL não contém o ID.

Usa o campo oficial já existente `user.image`; **nenhuma migração nova**. O novo arquivo é escrito antes da atualização oficial da referência; falhas confirmadas de atualização removem a derivada recém-criada sem tocar na anterior. A substituição/remoção descarta a anterior apenas depois do sucesso no banco. Operações simultâneas do mesmo titular são serializadas e revalidam sessão/estado dentro da região serializada. Uma resposta perdida depois do commit não prova rollback: antes de descartar a nova derivada, uma leitura autoritativa verifica que ela não é a atual. Se o resultado for incerto, os arquivos ficam privados para evitar uma referência quebrada; o cliente deve recarregar o perfil após recuperar a conexão. Falhas de limpeza depois do commit também podem deixar um arquivo órfão privado. O armazenamento/lock é local e de processo único: não é uma implementação para múltiplas instâncias/produção.

## Proteções e erros

Mutação personalizada exige `Origin` local permitido e JSON ou multipart conforme a rota; fetch explicitamente cross-site é recusado. O envelope preserva CORS, Host, CSRF e cookies HttpOnly/SameSite do serviço existente. Cabeçalhos de encaminhamento/IP do cliente não são confiados, inclusive na criação da sessão substituta da troca de senha. `/api/auth/update-user`, `/api/auth/change-password` e rotas de administração não são abertas diretamente pelo servidor. O cadastro descarta `image` recebido do cliente.

Limites de 60 segundos: senha 5, avatar upload/remoção 10 compartilhados, nome/e-mail de perfil 30, endpoints de e-mail não autenticados 5 compartilhados. As mutações são limitadas por IP real do socket e também pelo titular, antes de processamento caro; tentativas inválidas contam. O mapa é limitado a 4096 entradas e falha fechado quando cheio. São limites locais em memória, reiniciados com o processo; os limites existentes de login/cadastro permanecem persistidos pelo Better Auth.

Erros JSON `{ code }`, incluindo `UNAUTHORIZED` (401), `INVALID_NAME`, `INVALID_CURRENT_PASSWORD`, `PASSWORD_MISMATCH`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `INVALID_IMAGE`, `IMAGE_DIMENSIONS` (400), `IMAGE_TOO_LARGE` (413), `EMAIL_UNAVAILABLE` (501), `RATE_LIMITED` (429, com `X-Retry-After` e `Retry-After`). Tipos de corpo incorretos são 415, métodos incorretos 405 e falhas internas não expõem stack, SQL ou credenciais.

## E-mail/recuperação: limitação real

Não foram encontradas variáveis SMTP nem arquivos dedicados `smtp.env`/`mail.env` no ambiente local inspecionado (somente presença, sem imprimir segredos). Esta entrega **não instala/configura transporte**, não simula envio e não ativa uma troca não verificada. As capacidades de e-mail ficam falsas.

`POST /api/auth/request-password-reset`, `POST /api/auth/reset-password`, `POST /api/auth/send-verification-email` e `GET /api/auth/verify-email` retornam 501 após proteção de envelope/abuso, independentemente da existência da conta. Nenhum token é emitido/consumido e nenhum callback é executado. Portanto não há fluxo de confirmação de e-mail externo validado nem endereço de callback ativo nesta entrega. A futura ativação precisa de transporte server-only autorizado, métodos oficiais Better Auth, confirmação/reautenticação, tokens de curta duração/uso único e testes de aceitação de envio. Não basta mudar os booleanos de capacidades.

## Verificação e limites de escopo

Desenvolvimento por ciclos RED→GREEN: leitura de perfil, nome, senha, limites, upload, validação, rollback, concorrência, bloqueio de injeção de imagem, e-mail indisponível, shell protegido, extensão do health, `/api/me` e cadastro/entrada por CPF. Testes usam SQLite temporário, PGlite em memória e contas sintéticas.

Comando da suíte local: `node --test server/*.test.mjs`. A migração `202610160001_cpf_identifier.sql` foi aplicada ao projeto Supabase `sete-passos-sistema`; a consulta de verificação confirmou a coluna `cpf`, o registro da migração e RLS ativo no ledger. Uma conta anterior foi preservada: ela pode entrar com o e-mail antigo e vincular CPF no perfil. Novas contas podem usar CPF ou e-mail como identificador.

Resultado desta entrega: **36 testes passando, 0 falhas/skip**; `node --check` nos módulos modificados passou; `npm audit --omit=dev` retornou **0 vulnerabilidades**. A verificação de interface/build/navegadores pertence à integração frontend, não a esta suíte de servidor.
