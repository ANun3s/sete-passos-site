# Menu da conta — 2026-10-13

Pedido: organizar a navegação e revelar Meu perfil em um menu que desce ao passar o mouse sobre a foto.

Implementado em src/account-header.js e src/account.css. Avatar no final da barra, nome/Meu perfil/Sair no painel. Toque/clique, ArrowDown, Tab, Escape, foco visível e movimento reduzido. src/navigation.js fecha o submenu quando o menu móvel fecha. Login e API de autenticação preservados.

Validação: teste inicial falhou pela ausência do controle; após implementação, 6 testes de conta/autenticação e 11 testes de cabeçalho/navegação passaram. npm run check e npm run build passaram. Screenshots inspecionados em 320px e 1440px, com capturas também em 768px e 1024px. Contas sintéticas e SQLite isolado nos testes, sem alterações no Supabase do usuário.

Backup dos arquivos de implementação anteriores: artifacts/backups/account-dropdown/. O teste de autenticação foi adaptado para abrir o submenu antes de clicar no perfil. O grafo do projeto elo não foi alterado: ele não cobre este produto.
