# API local — Sete Passos

Backend Node HTTP + Better Auth **1.7.7**, conectado ao PostgreSQL privado do Supabase desde 13/10/2026. SQLite **13.0.3** permanece nos testes isolados. A administração autorizada pode criar fichas individuais, guardadas em tabela privada no Supabase; a migration correspondente deve estar aplicada antes de ativar o cadastro remoto. Consulte `../supabase/README.md`. Não há SMTP configurado; este processo Node segue local-only, enquanto a versão publicada usa o adapter `server/cloudflare-api.mjs` via Cloudflare Pages Functions. `NODE_ENV=production` é recusado antes de abrir banco/porta.

## Iniciar

A partir da raiz deste projeto, com as dependências do `package-lock.json` instaladas:

```sh
node server/setup.mjs
node server/migrate.mjs
node server/index.mjs
# Em outro terminal:
node --test server/*.test.mjs
```

Scripts npm equivalentes, quando adicionados pelo responsável do frontend: `backend:setup`, `db:migrate`, `dev:api`, `test:api`. Este backend não modifica `package.json`, Vite, frontend ou testes Playwright. Se houver incompatibilidade nativa ao trocar Node: `npm rebuild better-sqlite3` (o binding instalado passou no Node 26.7.0).

O servidor escuta **somente `127.0.0.1:3007`**. SIGINT/SIGTERM fecham listener e banco/pool. Desde 14/10/2026, o LaunchAgent `com.setepassos.backend` mantém a API ativa independentemente do chat, inicia ao fazer login no macOS e reinicia se o processo encerrar. Execute `setup` antes do primeiro start; ele é idempotente, não gira segredo existente e não cria usuários. Start só aplica migrations no modo SQLite; no Supabase apenas verifica a conexão e o schema existente.

## Segredo e banco FORA da raiz web

Go Live pode servir arquivos da raiz do projeto. **`.gitignore`, `ignoreFiles` e ocultação de dotfiles não são controles suficientes. Não colocar segredo ou SQLite no projeto.**

Arquivos reais dedicados a este projeto:

```text
~/Library/Application Support/Sete Passos Development/   # 700
  auth-secret.env                                      # 600
  auth.sqlite                                          # 600
  auth.sqlite-wal / auth.sqlite-shm                      # SQLite, temporários
```

`setup.mjs` gera 48 bytes criptograficamente aleatórios, sem imprimi-los, em `auth-secret.env`; usa criação exclusiva para não sobrescrever segredo existente. Não foi criado `.env.local`. `.env.example` contém somente comentários. O loader lê esse caminho fixo, sem varrer cwd, sem dotenv global, sem ler outro projeto, sem variáveis `VITE_*`. Caminhos dentro da raiz web, inclusive via ancestral symlink, são recusados; links simbólicos de segredo/banco também são recusados. Não publique o diretório privado por outro servidor.

`server/data/`, `.env*` e arquivos SQLite permanecem ignorados **como defesa extra**, não como proteção HTTP. Os testes automatizados criam diretórios isolados em `os.tmpdir()` (neste ambiente, o scratch Hermes), removem os próprios arquivos e não escrevem no banco de desenvolvimento.

## Contratos HTTP para integração

Todas as respostas têm `Cache-Control: no-store`. Enviar JSON nos POSTs e `credentials: 'include'` em **todas** as chamadas de autenticação. Nunca salvar senha ou token em localStorage/sessionStorage/IndexedDB, URL ou logs.

| Método/rota | Entrada / resposta |
|---|---|
| `GET /api/health` | `200 {"ok":true,"signUpEnabled":true}` quando servidor local está pronto |
| `POST /api/auth/sign-up/email` | `{name,identifier,password}`; cadastro com CPF válido ou e-mail. CPF fica associado ao perfil; e-mail é usado como identificador. O e-mail da conta administrativa configurada é reservado e não pode ser cadastrado publicamente. Sem sessão após cadastro; pedir login. |
| `POST /api/auth/sign-in/email` | `{identifier,password,rememberMe?}`; `identifier` aceita CPF ou e-mail já cadastrado na mesma caixa. Não exige que a pessoa possua ambos. `200` com resposta Better Auth + cookie. Senha incorreta e usuário ausente: `401`, mesmo erro genérico. A UI ignora o token do JSON e usa o cookie. |
| `GET /api/auth/get-session` | `200 {session,user}` nativo Better Auth ou `200 null` sem sessão válida. Não persistir o token contido na resposta. |
| `POST /api/auth/sign-out` | `{}`; `200 {success:true}`, revoga sessão no banco e limpa cookie. Reutilizar o cookie anterior não autentica. |
| `GET /api/me` | `200 {user:{id,name,email}}` ou `401 {code:"UNAUTHORIZED"}` |
| `GET /api/users/:id` | Mesmo usuário: `200 {user:{id,name,email}}`; qualquer outro id (existente ou não): `403 {code:"FORBIDDEN"}`; sem sessão: `401` |
| `GET /api/auth/ok` | Health nativo Better Auth |
| `/api/auth/request-password-reset`, `/reset-password`, `/send-verification-email`, `/verify-email` | `501 {code:"EMAIL_UNAVAILABLE"}`; **não enviam email e não simulam envio**. Cadastros com e-mail não recebem confirmação e não podem recuperar a senha por e-mail. |
| `GET /api/admin/users` | Somente admin: perfis, quantidade de sessões válidas e respostas das fichas vinculadas; sem ids, senhas ou tokens |
| `GET /api/admin/fichas` | Somente admin: modelos visuais demonstrativos protegidos |
| `POST /api/admin/fichas` | Somente admin: cria ficha individual `{email,type,title,content,fields?}` no perfil correspondente; `fields` é um objeto de respostas validado e pode chegar a 48 KiB; o endpoint aceita corpo até 64 KiB, exige Origin local e limite de frequência |

Demais endpoints Better Auth não estão publicados (`404`). Método errado nas rotas conhecidas: `405`. Origem/host/preflight indevidos: `403`. JSON malformado: `400`; corpo acima de 16 KiB: `413`, exceto o POST administrativo de fichas, limitado a 64 KiB; outro Content-Type: `415`. Erros inesperados: `500` genérico, sem stack ou credenciais.

E-mail de login é `trim().toLowerCase()` no servidor. CPF é aceito como 11 dígitos ou no formato `000.000.000-00`, e os dois dígitos verificadores são calculados; repetição de um mesmo dígito e caracteres extras são rejeitados. Nome não vazio, com trim, máximo 100 caracteres. Senha **12–128 caracteres**, sem trim ou transformação; hashing/verificação pelo padrão da biblioteca (scrypt), sem implementação própria. Cadastro não aceita `role`/privilégios. No cadastro, o mesmo campo aceita CPF ou e-mail; quando a pessoa usa e-mail, ele vira seu identificador de login. Sem provedor de envio, cadastros comuns com e-mail não recebem confirmação e não podem recuperar a senha por e-mail.

### Vite e Go Live

- Vite em `http://127.0.0.1:5177` ou `http://localhost:5177`: frontend usa `/api/...` e proxy `/api` para `http://127.0.0.1:3007`. O proxy não deve reescrever cookies. `changeOrigin: true` funciona, mas Host local 5177 também é aceito.
- Go Live em `http://127.0.0.1:5500`: chamar `http://127.0.0.1:3007/api/...`.
- Go Live em `http://localhost:5500`: chamar `http://localhost:3007/api/...`.
- **Manter o mesmo hostname no frontend e backend**: não misturar `localhost` e `127.0.0.1`, pois são sites/cookies distintos. Go Live não faz proxy.
- Allowlist exata: os quatro origins acima e origins do backend local. CORS com credenciais, sem `*`; `OPTIONS` permite somente GET/POST e Content-Type. Porta preview 4177 não foi adicionada.
- Better Auth mantém checagens próprias de Origin, callbackURL e Fetch Metadata/CSRF habilitadas. Headers encaminhados do cliente não são confiados.

## Sessão e limites

Cookie host-only `sete-passos.session_token`, `HttpOnly`, `SameSite=Lax`, `Path=/`. Em HTTP de loopback não tem Secure; configuração HTTPS emite `Secure` e prefixo `__Secure-` (coberto em teste da biblioteca, não um deploy TLS). Expiração de sessão 24 horas, atualização após 1 hora; `rememberMe:false` usa comportamento de cookie de sessão da biblioteca. Cache de sessão em cookie **desligado**; autorização consulta persistência, e expiração/revogação não têm bypass de cache.

Rate limit ligado também em dev, com contadores persistidos no SQLite: login e cadastro **10 solicitações por 60 s por IP/rota**; demais rotas Better Auth 120/60 s. Retorna `429` com `X-Retry-After` exposto por CORS. IP vem exclusivamente de `req.socket.remoteAddress`, sobrepondo header interno e removendo forwarding headers. Clientes locais/proxy Vite compartilham loopback e, portanto, o limite. Reiniciar servidor não zera contadores. Limites não se aplicam a health/me por `auth.api`; essas rotas não executam verificação de senha.

## Schema oficial e migrations

`001-better-auth.sql` é a saída **sem edição** do CLI oficial instalado `auth@1.7.7`, gerada com:

```sh
./node_modules/.bin/auth generate --config server/schema-auth.mjs --output server/migrations/001-better-auth.sql --yes
```

O config de geração usa banco **em memória vazio** e segredo efêmero, nunca o banco/segredo de dev. Não rode o comando acima sobre uma migration já aplicada. Para revisão futura gere para um novo arquivo em `server/`, compare e converta somente o delta revisado em nova migration numerada. O CLI Kysely gera SQL baseado no estado do banco configurado; schema completo gerado de memória não é uma migration incremental de um banco existente.

Schema revisado: `user` (email unique), `account` (hash, FK user/cascade), `session` (token unique, validade, FK user/cascade), `verification`, `rateLimit` (key unique). Índices oficiais de userId/identifier preservados. `002-expiry-indexes.sql` acrescenta índices de expiração de sessão/verificação e lastRequest de rate limit.

Runner usa `BEGIN IMMEDIATE`, ledger `_migrations` com SHA-256, aplicação transacional de DDL + ledger, `foreign_keys=ON`, `foreign_key_check`, WAL e busy timeout. Reaplicação é no-op; SQL aplicado editado é recusado; erro reverte lote inteiro. Não existem DROP, seed admin, comando reset ou migration destrutiva automática.

## Testes e factories

```js
import { createLocalServer } from './server/app.mjs';
const app = await createLocalServer({
  databasePath: '/absolute/private/test-dir/auth.sqlite', // fora do webroot
  secret: /* segredo aleatório em memória, >=32 caracteres */,
  port: 0, // porta efêmera; usar 3007 se o browser precisar
  mode: 'test',
});
await app.start();
// app.url, app.db, app.auth; sempre await app.close() no finally
```

`server/index.mjs` também exporta `startLocalServer(config)`. Para teste real do entrypoint/browser em banco isolado, use `NODE_ENV=test` + `SETE_PASSOS_TEST_DATA_DIR=<diretório privado externo>` e opcional `SETE_PASSOS_TEST_PORT=3007` (ou 0). Execute `setup.mjs` e `index.mjs` com as mesmas variáveis. O override do diretório é recusado fora de mode test. Não apontar para o diretório de desenvolvimento para testes destrutivos.

A suíte `node --test server/*.test.mjs` verifica cadastro/duplicado normalizado, hash sem expor senha, login correto/incorreto e erro indistinguível para ausente, cookies HTTP/HTTPS, sessão/logout/expiração/tamper, 401/403 entre dois usuários reais, CORS/origin/callback/CSRF/Host, rate limit com XFF falsificado, validação HTTP, falta de email, segredo/permissões/isolamento, migrations idempotentes/rollback/checksum e **reinício real de subprocessos com novos PIDs** preservando conta, sessão, revogação e rate limit. Não mocka Better Auth nem SQLite. Testes RED foram executados antes das slices de implementação; falhas esperadas incluíram 401→200 em signup/me, 200→403 em cross-user, CORS ausente, produção não bloqueada, entrypoint ausente, 200→405 em métodos e índice de expiração ausente.

## Antes de qualquer produção (fora deste escopo)

Não remover simplesmente o bloqueio de produção. Exige projeto separado/revisão: HTTPS/proxy confiável, secret manager e rotação, domínio/cookies/CORS próprios, política de cadastro fechado ou convites, verificação real de email e transporte/reset de senha, permissões clínicas explícitas, proteção contra abuso e limites distribuídos, auditoria sem PII/segredos, backups testados/retention, privacidade e consentimento, e revisão de segurança. Uma conta local nunca equivale a profissional autorizado.

Evolução possível: PostgreSQL com o adapter oficial, migrations **novas geradas para Postgres** (não reutilizar DDL SQLite), teste de transferência de usuários/hashes e estratégia explícita para revogar/migrar sessões. Preservar ids/constraints onde apropriado e validar backup/restore antes de qualquer mudança. Nenhum PostgreSQL, ORM, Docker ou serviço foi introduzido nesta etapa.

## Preparação PostgreSQL/Supabase (2026-10-07)

O usuário autorizou o banco Supabase para login e, em 14/10/2026, armazenamento de fichas individuais. Em 19/10/2026, a migration `20261014200652_admin_clinical_fichas.sql` foi aplicada ao projeto `sete-passos-sistema` pelo SQL Editor: ledger com quatro migrations, tabela `clinical_ficha` presente, RLS habilitado e permissões de leitura/inserção para `sete_passos_app` verificadas. A tabela é privada e a API verifica a allowlist administrativa antes das operações. As migrations, testes e instalador ficam em `../supabase/`.

## Login com Google Identity Services

A página usa o botão oficial renderizado por Google Identity Services (GIS) e entrega o ID token ao endpoint Better Auth `/api/auth/sign-in/social`, que valida a assinatura e cria a sessão no servidor. O nonce aleatório por tentativa é conferido junto ao token. Para este fluxo GIS de ID token, configure o `GOOGLE_CLIENT_ID` (cliente OAuth do tipo Web) no ambiente do projeto; a validação do token usa as chaves públicas do Google e esse Client ID, sem precisar de `GOOGLE_CLIENT_SECRET`. Se outro fluxo OAuth por redirecionamento for adicionado no futuro, o segredo deve permanecer exclusivamente no backend. Nunca coloque segredos no código, frontend ou repositório. No Google Cloud Console, cadastre os **Authorized JavaScript origins** `https://sete-passos.pages.dev`, `http://127.0.0.1:5177`, `http://localhost:5177`, `http://127.0.0.1:5500` e `http://localhost:5500`. Este fluxo GIS com ID token não usa redirect URI. O endpoint `/api/health` informa `capabilities.googleLogin` e expõe apenas o Client ID público; a página renderiza o botão oficial quando a configuração estiver ativa. O login exige email verificado pelo Google; contas Better Auth com o mesmo email só podem ser vinculadas quando o e-mail local já estiver verificado. Para login GIS por ID token, somente o Client ID é necessário; o Client Secret permanece vazio se não houver OAuth por redirecionamento. A biblioteca oficial é carregada de `https://accounts.google.com/gsi/client`.

## Serviço persistente no macOS

Instalado em 14/10/2026 após confirmar que o Supabase respondia, mas a API local estava parada. O macOS supervisiona `server/index.mjs` via `~/Library/LaunchAgents/com.setepassos.backend.plist`; não depende dos créditos do chat.

```sh
npm run backend:service -- status
npm run backend:service -- restart
npm run backend:service -- install
npm run backend:service -- uninstall
```

`install` resolve o Node em uso e o caminho do projeto, valida o plist e registra o serviço. Reexecute após mover o projeto ou substituir o runtime Node. `uninstall` remove somente o serviço; mantém banco e credenciais. Não execute outra API na porta 3007 enquanto o serviço estiver ativo. Para testes que precisam dessa porta, remova o serviço temporariamente e reinstale ao concluir.

Logs sem senhas e tokens: `~/Library/Application Support/Sete Passos Development/backend-service.log`. KeepAlive com intervalo mínimo de 15 segundos entre tentativas. A configuração permanece fora da raiz web, com permissões privadas. O serviço lê o arquivo existente de conexão; o plist não contém credenciais.

Limites: exige sessão do usuário no Mac, computador ligado e acordado e internet. Não altera o plano nem as políticas de pausa do Supabase. Disponibilidade sem depender do computador requer hospedagem do backend. Frontend Vite/Live Server continua sendo um processo separado.
