# Área pessoal — contrato de implementação

Escopo autorizado: `docs/prompt-hermes-perfil-2026-10-13.md`. Preservar a home, marca, GSAP, modelos e rodapé; sem deploy, dados reais ou alterações remotas de banco.

## Estrutura
```text
Cabeçalho existente                           [foto · Meu perfil] [Sair]
Meu perfil
┌ resumo (desktop) ──────┬ informações alinhadas ─────────────────┐
│ bonequinho cinza      │ Informações pessoais                  │
│ nome / e-mail         │ Nome [editar] · E-mail [verificação]   │
│ [Alterar foto]        ├───────────────────────────────────────┤
│ prévia / salvar /     │ Minhas fichas: estado vazio real       │
│ cancelar / remover   │ [Modelos de fichas]                    │
│                      ├───────────────────────────────────────┤
│ [Sair da conta]       │ Segurança · alterar senha / recuperar │
└──────────────────────┴───────────────────────────────────────┘
Rodapé compartilhado completo
```
No celular: coluna única, avatar primeiro. Formulários com rolagem natural, sem pinning/3D. Shell HTML nunca inclui dados pessoais; apenas API autorizada pode fornecê-los.

## Etapas e aceite
1. Backend: sessão real e métodos oficiais Better Auth; avatar privado validado/reencodado; nome/senha; capacidades verdadeiras de e-mail. Testes isolados, sem reset de banco existente.
2. Estrutura visual: `perfil.html`, tokens reais, avatar SVG cinza, responsividade e semântica. Home e logo intocadas.
3. Integração: sessão no cabeçalho, destino seguro após login, logout, edição sem duplicações, prévia cancelável, mensagens e recuperação honesta.
4. Verificação: Node, testes de navegador com API real isolada, Chromium/WebKit, 320/768/1024/1440, teclado, reduced motion, duas contas e persistência. Check/build e regressões da home/rodapé.

## Decisões de segurança
- A senha atual nunca é recuperada. Apenas estado verdadeiro e confirmação de senha digitada.
- Sem transporte de e-mail: alteração e recuperação ficam indisponíveis, sem simular envio.
- Não existem fichas pessoais no modelo atual; retornar lista vazia e manter os modelos públicos separados.
- Foto fora da raiz pública; nenhum `userId` do cliente controla proprietário.
- Vite usa a API para autorizar `/perfil.html`. Go Live é servidor estático: entrega somente shell; todos os dados/fotos continuam protegidos na API e o cliente redireciona sem sessão.

## Verificação
A preencher com resultados reais ao concluir. Não confundir transporte sintético de teste com entrega externa de e-mail.
