# Seletores `data-test` — inventário para automação

Todos os elementos relevantes para testes têm o atributo `data-test`.
Use sempre este atributo nos testes Cypress:

```js
cy.get('[data-test="btn-login"]').click();
```

## Regras adotadas

1. **Nome em português**, minúsculas, palavras separadas por hífen.
2. **Prefixo pelo tipo do elemento:**
   `input-` (campo), `select-` (lista), `btn-` (botão/link de ação), `filtro-` (campo de filtro),
   `erro-` (erro de um campo), `mensagem-` (mensagem geral), `card-` (indicador),
   `tabela-`, `linha-` (linha de tabela), `lista-`, `item-` (item de lista), `modal-`, `menu-`.
3. **Único dentro da tela.** Elementos repetidos (linhas de tabela e seus botões) são únicos
   **dentro da linha**: encontre a linha primeiro e depois o botão dentro dela.
4. **Não depende de texto nem de classe CSS.** Textos e estilos podem mudar; o `data-test`, não.
5. **Linhas carregam `data-id`** com o id do registro, para localizar um registro específico.

### Como achar um botão dentro de uma linha

```js
// Pelo texto da linha (nome do jogador) → botão daquela linha
cy.contains('[data-test="linha-jogador"]', 'Fulano de Tal')
  .find('[data-test="btn-editar-jogador"]')
  .click();

// Pelo id do registro
cy.get('[data-test="linha-usuario"][data-id="5"]')
  .find('[data-test="btn-inativar-usuario"]')
  .click();
```

---

## Login (`/login.html`)

| data-test | Elemento |
|---|---|
| `usuario` | Campo usuário ou e-mail |
| `senha` | Campo senha |
| `btn-visualizar-senha` | Mostrar/ocultar senha (`aria-pressed` indica o estado) |
| `btn-login` | Botão Entrar (fica `disabled` durante a requisição) |
| `erro-usuario` | Erro do campo usuário (campo obrigatório) |
| `erro-senha` | Erro do campo senha (campo obrigatório) |
| `mensagem-erro-login` | Erro geral (credenciais inválidas, inativo, bloqueio) |
| `mensagem-info-login` | Aviso informativo (ex.: sessão expirada) |

## Layout comum (todas as telas internas)

| data-test | Elemento |
|---|---|
| `menu-lateral` | Menu lateral |
| `menu-painel` / `menu-mensalidades` / `menu-jogadores` / `menu-usuarios` | Itens do menu (`menu-usuarios` só aparece para administradores) |
| `usuario-logado` | Nome e perfil do usuário logado |
| `btn-sair` | Sair do sistema |
| `btn-menu` | Abrir menu (só no celular) |
| `toast` | Aviso temporário; o atributo `data-tipo` vale `sucesso`, `erro` ou `info` |
| `modal-confirmacao` | Janela de confirmação |
| `mensagem-confirmacao` | Texto da confirmação |
| `btn-confirmar` / `btn-cancelar-confirmacao` | Botões da confirmação |
| `paginacao`, `info-paginacao`, `btn-pagina-anterior`, `btn-proxima-pagina` | Paginação das listagens |

## Painel (`/`)

| data-test | Elemento |
|---|---|
| `filtro-mes-dashboard` | Mês de referência do painel |
| `valor-arrecadado-mes` | Valor pago no mês |
| `texto-previsto-mes` | Texto "de R$ X previstos" |
| `medidor-arrecadacao` | Medidor (`aria-valuenow` = percentual) |
| `percentual-arrecadado` | Percentual do previsto |
| `card-jogadores-ativos`, `card-pendente-mes`, `card-sem-lancamento`, `card-pendente-geral` | Indicadores |
| `grafico-evolucao` | Gráfico de 6 meses |
| `coluna-grafico` | Cada coluna (atributo `data-mes` = AAAA-MM) |
| `btn-ver-tabela-evolucao`, `tabela-evolucao` | Tabela de apoio do gráfico |
| `lista-sem-lancamento`, `item-sem-lancamento`, `btn-registrar-pagamento` | Jogadores sem lançamento no mês |
| `mensagem-todos-lancados` | Mensagem quando todos têm lançamento |
| `lista-maiores-pendencias`, `item-pendencia`, `mensagem-sem-pendencias` | Maiores pendências |
| `lista-ultimos-pagamentos`, `item-ultimo-pagamento` | Últimos lançamentos |

## Mensalidades (`/mensalidades.html`)

| data-test | Elemento |
|---|---|
| `btn-novo-pagamento` | Abrir o modal de novo pagamento |
| `card-total-pago`, `card-total-pendente`, `card-quantidade-pagamentos` | Resumo dos filtros |
| `filtro-mes`, `filtro-jogador`, `filtro-status-pagamento`, `btn-limpar-filtros` | Filtros |
| `tabela-pagamentos`, `mensagem-sem-pagamentos` | Listagem |
| `linha-pagamento` (+ `data-id`) | Linha da tabela |
| `status-pagamento` | Etiqueta de status na linha |
| `btn-editar-pagamento`, `btn-cancelar-pagamento` | Ações da linha (não existem em pagamentos cancelados) |
| `modal-pagamento`, `titulo-modal-pagamento` | Modal de lançamento/edição |
| `select-jogador-pagamento`, `input-data-pagamento`, `input-valor-pagamento`, `select-status-pagamento` | Campos |
| `erro-jogador-pagamento`, `erro-data-pagamento`, `erro-valor-pagamento` | Erros dos campos |
| `mensagem-erro-formulario-pagamento` | Erro vindo do backend |
| `btn-salvar-pagamento`, `btn-fechar-modal-pagamento` | Ações do modal |

## Jogadores (`/jogadores.html`)

| data-test | Elemento |
|---|---|
| `btn-novo-jogador` | Abrir o modal de novo jogador |
| `input-pesquisa-jogador`, `filtro-status-jogador` | Pesquisa (nome ou CPF) e filtro |
| `tabela-jogadores`, `mensagem-sem-jogadores` | Listagem |
| `linha-jogador` (+ `data-id`) | Linha da tabela |
| `nome-jogador`, `pendente-jogador`, `status-jogador` | Dados na linha |
| `btn-editar-jogador`, `btn-inativar-jogador` | Ações da linha (inativar só aparece em ativos) |
| `modal-jogador`, `titulo-modal-jogador` | Modal |
| `input-nome-jogador`, `input-cpf`, `input-telefone`, `input-data-nascimento`, `input-data-entrada`, `input-valor-mensalidade`, `select-status-jogador`, `input-observacoes` | Campos |
| `erro-nome-jogador`, `erro-cpf`, `erro-telefone`, `erro-data-nascimento`, `erro-data-entrada`, `erro-valor-mensalidade`, `erro-observacoes` | Erros dos campos |
| `mensagem-erro-formulario-jogador` | Erro vindo do backend (ex.: CPF duplicado) |
| `btn-salvar-jogador`, `btn-fechar-modal-jogador` | Ações do modal |

## Usuários (`/usuarios.html`, somente administrador)

| data-test | Elemento |
|---|---|
| `btn-novo-usuario` | Abrir o modal de novo usuário |
| `input-pesquisa-usuario`, `filtro-status-usuario` | Pesquisa e filtro |
| `tabela-usuarios`, `mensagem-sem-usuarios` | Listagem |
| `linha-usuario` (+ `data-id`) | Linha da tabela |
| `perfil-usuario`, `status-usuario` | Etiquetas na linha |
| `btn-editar-usuario`, `btn-inativar-usuario` | Ações da linha (inativar não aparece para o próprio usuário logado nem para inativos) |
| `modal-usuario`, `titulo-modal-usuario` | Modal |
| `input-nome`, `input-email`, `input-usuario`, `input-senha`, `input-confirmar-senha`, `select-perfil`, `select-status` | Campos |
| `erro-nome`, `erro-email`, `erro-usuario`, `erro-senha`, `erro-confirmar-senha`, `erro-perfil` | Erros dos campos |
| `mensagem-erro-formulario-usuario` | Erro vindo do backend (ex.: e-mail duplicado) |
| `btn-salvar-usuario`, `btn-fechar-modal-usuario` | Ações do modal |
