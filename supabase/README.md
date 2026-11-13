# Banco de login — Sete Passos

PostgreSQL hospedado no Supabase, mantendo Better Auth **1.7.7** como responsável pela autenticação. Não utiliza `auth.users` nem troca o login para Supabase Auth. O schema `sete_passos_auth` é privado e inclui armazenamento de fichas individuais, conforme autorização explícita do usuário em 14/10/2026.

## Arquivos

- `migrations/202610070001_better_auth.sql`: DDL PostgreSQL gerado pelo migrador oficial da versão instalada, contra banco vazio PGlite. Não é adaptação do SQL SQLite.
- `migrations/202610070002_auth_security.sql`: permissões, RLS e índices de expiração.
- `migrations/20261014200652_admin_clinical_fichas.sql`: tabela privada de fichas individuais, ligada a perfis, com RLS e escrita/leitura apenas pelo backend.
- `migrations/202610160001_cpf_identifier.sql`: coluna de CPF única e validações para o identificador usado no login.
- `install-login.sql`: instalador transacional para SQL Editor, com ledger e checksums. Reexecução sem mudanças é no-op; alteração de migration aplicada é recusada.
- `../server/postgres.mjs`: configuração do adapter oficial Kysely e runner das migrations.

Tabelas: `user` (perfil e email único), `account` (hash da senha gerado pelo Better Auth), `session` (sessões revogáveis), `verification` (verificações futuras), `rateLimit` (limites persistentes) e `clinical_ficha` (fichas individuais associadas a um perfil). Cada ficha contém tipo, título, conteúdo JSONB e data. Em fichas estruturadas, o JSON guarda `text` para compatibilidade e `answers` com as respostas identificadas pelos campos do modelo; propostas usam `answers._formType` por causa das restrições legadas de tipo. Remoção de perfil remove as fichas vinculadas. A tabela `_migrations` registra somente alterações estruturais.

## Aplicar no Supabase

1. Criar projeto `sete-passos-sistema` na organização escolhida. Manter Data API desligada para este backend; não expor o schema `sete_passos_auth`.
2. Abrir **SQL Editor**, colar `install-login.sql` completo e executar como owner. O resultado deve listar as quatro migrations.
3. Verificar `pg_tables` com `schemaname = 'sete_passos_auth'`: cinco tabelas de autenticação e a tabela `clinical_ficha`, todas com RLS habilitado, além do ledger. A tabela `user` também deve conter a coluna `cpf`.

Alternativa pela conexão de owner: fornecer `SETE_PASSOS_SUPABASE_DB_URL` no ambiente do processo e executar `npm run db:supabase:migrate`. Usar conexão direta ou Session pooler na porta 5432 e TLS validado. Para CA privada, fornecer `SETE_PASSOS_SUPABASE_CA_FILE` apontando ao certificado baixado do painel. Não colocar credenciais na pasta do projeto, no chat ou em variáveis `VITE_*`.

## Acesso do backend

A migration cria `sete_passos_backend` **NOLOGIN**, com DML nas tabelas de autenticação e leitura/inserção de fichas individuais sob políticas RLS exclusivas para esse papel. `anon`, `authenticated` e `service_role` não têm acesso ao schema. A API valida a conta administradora antes de ler ou criar fichas. Não há senha embutida nem usuário de aplicação pré-cadastrado.

Uma conexão exclusiva de servidor deverá receber esse papel quando o backend for conectado. O servidor é a fronteira de autorização entre usuários: seu acesso ao conjunto de tabelas de autenticação é necessário ao Better Auth. Políticas baseadas em `auth.uid()` do Supabase não se aplicam às sessões Better Auth.

**Ativado em 13/10/2026:** o entrypoint usa o banco Supabase do projeto `sete-passos-sistema` (`jizynpvncmfpycexplnb`, Ohio). A API continua restrita a `127.0.0.1:3007`. Contas e sessões SQLite anteriores não foram copiadas. O login dedicado `sete_passos_app` herda somente o papel `sete_passos_backend`. A conexão e o certificado ficam em `~/Library/Application Support/Sete Passos Development/`, nos arquivos `supabase.env` e `supabase-ca.crt` com permissões 600. Pool de até três conexões, TLS validado e encerramento ao parar o servidor. Verificação por email e recuperação de senha continuam indisponíveis até configurar envio real.

## Verificação e regeneração

```sh
npm run test:postgres
npm run db:supabase:sql > supabase/install-login.sql
# Revisão de novo DDL em stdout; não sobrescrever migrations já aplicadas:
node scripts/generate-postgres-schema.mjs
```

Testes usam PostgreSQL em WebAssembly (PGlite), sem conexão de rede, dados reais ou escrita no SQLite de desenvolvimento. Validam DDL, FK/schema do Better Auth e fichas, cadastro, hash, login, sessão/logout, contadores, RLS/permissões, reaplicação e detecção de checksums divergentes. A configuração TLS e a rede do Supabase precisam de verificação no ambiente remoto.

Referências oficiais: [Better Auth PostgreSQL](https://better-auth.com/docs/adapters/postgresql), [Conexão PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Operação após ativação

- Iniciar API: `npm run dev:api`. O Live Server continua na porta 5500; o Vite, na 5177.
- Testar configuração e regressões sem rede: `npm run test:api`.
- Verificar integração remota explicitamente: `npm run verify:supabase`. Cria uma conta fictícia temporária, testa cadastro/login/autorização/persistência após restart/logout e remove a conta ao terminar. Não registra senhas ou cookies.
- `server/supabase-runtime.mjs` lê somente o arquivo privado dedicado. Arquivo ausente permite SQLite para desenvolvimento/teste; arquivo presente inválido ou banco indisponível interrompe a inicialização. Nenhuma migration DDL é executada com a credencial de runtime.
- `/api/health` consulta o banco e retorna 503 quando a conexão remota falha.
- Migrations remotas registradas: `install_sete_passos_private_login`, `sete_passos_dedicated_runtime`, `restrict_automatic_rls_trigger_execution`. A última restringe EXECUTE da função de event trigger criada pelo próprio Supabase, preservando o trigger automático.
- Certificado oficial obtido em https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt pelo botão Download certificate do painel.
- Não há deploy. Desde 14/10/2026, o LaunchAgent `com.setepassos.backend` inicia a API no login do macOS e reinicia o processo se encerrar, independentemente do chat. Requer Mac ligado/acordado, sessão ativa e internet. Consulte `server/README.md`.
