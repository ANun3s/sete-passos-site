# Perfis e fichas na Administração

## O fluxo

Em **Pessoas e acessos**, o nome abre o detalhe do cliente. O detalhe mostra nome e e-mail da conta, estado de verificação, data de criação, sessões ativas, todas as fichas salvas e as respostas organizadas pelos grupos do respectivo modelo. “Voltar para perfis” retorna à busca sem levar identificadores à URL.

“Preencher ficha com o cliente” abre um formulário por grupos expansíveis. Os modelos disponíveis são avaliação fisioterapêutica, proposta de tratamento e outra ficha. Nome e e-mail vêm da conta já selecionada; a profissional completa e revisa os demais campos antes de salvar.

## Campos lidos dos modelos existentes

- **Avaliação fisioterapêutica:** identificação, queixa e evolução, início dos sintomas, escala e localização da dor, características/frequência/fatores, tratamentos anteriores, medicações, cirurgias, traumas, exames, condições gerais, sono, alimentação, atividade física, fatores emocionais e viscerais, contraindicações, plano, objetivo, data, profissional e registro de ciência.
- **Proposta de tratamento:** identificação das partes, objetivos, recursos e tratamentos, frequência e duração, datas, observações, investimento, condições de pagamento, opção, condições do atendimento e aceite.
- **Outra ficha:** nome, e-mail, data do atendimento e informações registradas pela profissional.

As perguntas clínicas são campos de registro. O formulário não recomenda tratamento e não afirma ser um protocolo validado.

## Persistência e acesso

As respostas vão para o objeto `answers` dentro do `content` JSONB da ficha individual existente. `content.text` continua preenchido para compatibilidade com registros anteriores. A proposta leva `_formType: "proposta-tratamento"` dentro do JSON porque a restrição legada do campo `type` não inclui esse valor. Assim, não é necessária outra migration.

O navegador envia as respostas somente a `POST /api/admin/fichas`; a API exige sessão e e-mail administrador, verifica `Origin`, limita os campos e o tamanho do corpo e liga o registro ao perfil resolvido pelo e-mail no servidor. `GET /api/admin/users` devolve as respostas apenas ao administrador autenticado. Nenhuma resposta clínica, e-mail de seleção ou ID de conta vai para a URL. Os modelos de exemplo seguem como documentos separados dos prontuários.

Se o armazenamento da tabela não estiver disponível, o formulário não é mostrado e a interface explica a condição. Os registros antigos continuam aparecendo como texto.

## Referências de interface

- Apple HIG `lists-and-tables.md › Content`: quando uma linha contém muitos dados, mostre primeiro os títulos e abra outra vista para ler os detalhes.
- Apple HIG `layout.md › Visual hierarchy`: alinhar e agrupar dados relacionados para deixar clara a hierarquia.
- Apple HIG `entering-data.md › Best practices`: dar nome claro aos dados, preferir opções quando fizer sentido e validar antes de concluir.
- Apple HIG `privacy.md › Best practices`: solicitar somente dados necessários e explicar seu uso.
- Na web, esses princípios viram botões e elementos de formulário HTML semânticos, navegação de teclado e CSS adaptável; ver `cross-platform.md`.

## Limites desta entrega

- A conta fornece somente o nome e o e-mail criados no cadastro; os demais dados aparecem depois que a profissional os preenche na ficha.
- Modelos preenchidos antigos continuam exibidos como texto livre; a nova estrutura vale para fichas criadas pelo novo formulário.
- Nenhuma informação de cliente foi enviada ao OmniRoute ou usada como prompt de IA.
