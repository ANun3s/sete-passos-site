# Login e criar conta locais

Escopo autorizado: tornar login e cadastro funcionais diretamente neste workspace, preservando visual, animações e remoção da galeria de Fichas. Nenhum prontuário, dado real, administrador padrão ou deploy. Os planos visuais anteriores permanecem históricos; esta etapa não os reinicia.

## Decisão
Sem backend/ORM/PostgreSQL/Docker disponível. Node HTTP + Better Auth 1.7.7 + SQLite persistente. Schema oficial versionado; banco dev isolado, testes em outro banco. Senhas e sessões da biblioteca, cookies HttpOnly, nenhuma credencial no armazenamento do navegador. Cadastro local somente; produção exige decisão de convite/aprovação e verificação de email.

## Contrato e ordem
- [ ] Backend: setup/segredo restrito, migrations oficiais, signup/signin/signout/get-session, /api/me e proteção por usuário. Testes integração segurança e reinício.
- [ ] UI: mesma página login com formulário Criar conta (nome/email/senha/confirmação), validação, mostrar senha, loading/erros, painel Minha conta e sair. API real, sem simulação. Cadastro solicita login depois de resposta neutra.
- [ ] Integração: Vite proxy /api → 127.0.0.1:3007; Go Live local usa porta 3007 no mesmo hostname com origem explícita. API indisponível deve aparecer como erro, nunca como sucesso.
- [ ] QA: testes UI e integração real com banco separado, reload/logout/persistência, responsividade/axe, regressões existentes e build. Documentar comandos e limites.

Ownership: agente backend escreve apenas server/**, .env.example, .env.local e .gitignore. Agente principal escreve frontend, testes Playwright, scripts package/Vite e documentação geral. Não alterar animações.
