# Gerenciamento de Mensalidades ⚽

Sistema web para controlar as mensalidades de um grupo de futebol: jogadores,
lançamentos de pagamento, pendências e usuários com perfis de acesso.

Projeto **didático**: o código é comentado em português explicando *o que* cada
parte faz, *por que* foi feita assim e *como* se conecta com o resto do sistema.

---

## Sumário

- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Configuração (.env)](#configuração-env)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [API](#api)
- [Banco de dados](#banco-de-dados)
- [Segurança](#segurança)
- [Testes automatizados (Cypress)](#testes-automatizados-cypress)
- [Roteiro de estudo](#roteiro-de-estudo)

---

## Tecnologias

| Camada | Tecnologia | Por quê |
|---|---|---|
| Backend | **Node.js 24+** e **Express 4** | Servidor HTTP simples e muito usado no mercado |
| Sessão | **express-session** | Login com cookie de sessão (os dados ficam no servidor) |
| Banco | **SQLite** (`node:sqlite`, nativo do Node 24) | Um arquivo local, sem instalar servidor de banco |
| Senhas | **crypto.scrypt** (nativo do Node) | Hash seguro sem dependência extra |
| Frontend | **HTML + CSS + JavaScript puro** (módulos ES) | Sem framework e sem etapa de build, ideal para aprender a base |
| Testes | **Cypress 16** | Testes E2E (pela tela) e de API no mesmo projeto |
| Documentação da API | **OpenAPI 3** + **swagger-ui-express** + **yaml** | Contrato da API legível e testável pelo navegador |

## Como executar

**Requisito:** Node.js 24 ou superior (o projeto usa o SQLite nativo do Node).

```bash
npm install
```

```bash
npm run dev
```

Acesse **http://localhost:3001**.

No primeiro acesso, use o usuário `admin` com a senha `admin123` (ou o valor de
`ADMIN_SENHA_INICIAL` no `.env`). **Troque essa senha** na tela de Usuários.

### Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o servidor com recarga automática (nodemon) |
| `npm start` | Inicia o servidor |
| `npm run test:e2e` | Roda **toda** a suíte Cypress (sobe e derruba o servidor de testes sozinho) |
| `npm run test:servidor` | Sobe só o servidor de testes (porta 3100, banco descartável) |
| `npm run cy:open` | Abre o Cypress no modo interativo (use com `test:servidor` rodando) |
| `npm run cy:run` | Roda o Cypress sem interface (use com `test:servidor` rodando) |

### Ao iniciar, o servidor automaticamente

1. aplica as **migrações** pendentes do banco (veja [Banco de dados](#banco-de-dados));
2. converte para hash qualquer senha antiga ainda em texto puro;
3. cria o usuário `admin` se não houver nenhum usuário.

> 💾 Backups do banco ficam em `data/backup/`. Faça uma cópia de `data/mensalidades.db`
> antes de atualizar o sistema.

## Configuração (.env)

Copie `.env.example` para `.env` e ajuste. O `.env` **não vai para o Git**.

| Variável | Padrão | Descrição |
|---|---|---|
| `SESSION_SECRET` | aleatório a cada início | Segredo que assina o cookie de sessão. **Defina um valor fixo**, senão todos são deslogados quando o servidor reinicia |
| `PORT` | `3001` | Porta do servidor |
| `DB_PATH` | `data/mensalidades.db` | Caminho do banco (os testes usam outro arquivo) |
| `ADMIN_SENHA_INICIAL` | `admin123` | Senha do `admin` criado quando o banco está vazio |
| `LOGIN_MAX_TENTATIVAS` | `5` | Falhas de login seguidas até o bloqueio |
| `LOGIN_BLOQUEIO_MINUTOS` | `15` | Duração do bloqueio |
| `SESSAO_DURACAO_HORAS` | `8` | A sessão expira após este tempo sem uso |

Para gerar um segredo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Funcionalidades

| Tela | O que permite | Quem acessa |
|---|---|---|
| **Login** | Entrar com usuário **ou** e-mail; mostrar/ocultar senha; mensagens amigáveis | Todos |
| **Painel** (`/`) | Arrecadado no mês contra o previsto, pendências, jogadores sem lançamento (com atalho "Registrar"), gráfico dos últimos 6 meses | Todos os perfis |
| **Mensalidades** | Lançar, editar e **cancelar** pagamentos; filtros por mês, jogador e status; paginação | Todos os perfis |
| **Jogadores** | Cadastrar, editar, inativar e pesquisar (nome ou CPF); CPF validado; telefone e valor com máscara | Todos os perfis |
| **Usuários** | Cadastrar, editar, inativar e pesquisar; definir perfil | **Somente Administrador** |

### Regras de negócio importantes

- **Nada financeiro é apagado.** Pagamentos são *cancelados* (continuam no histórico,
  fora dos totais); jogadores e usuários são *inativados*.
- Todo pagamento pertence a um **jogador cadastrado**. Jogador inativo não recebe novos
  lançamentos, mas o histórico dele continua editável.
- **CPF** é opcional, mas, se informado, precisa ser válido e único. Sem CPF, o mesmo
  nome com a mesma data de nascimento é considerado duplicado.
- **E-mail** e **nome de usuário** são únicos (sem diferenciar maiúsculas).
- O administrador não pode inativar a si mesmo nem remover o próprio perfil, e o
  sistema sempre mantém ao menos um administrador ativo.
- O "mês" de um pagamento é o mês da **data do lançamento** (ainda não existe um
  campo de mês de referência/competência).

## Arquitetura

O backend segue uma **arquitetura em camadas**. Cada camada tem uma única responsabilidade:

```
Navegador (HTML + JS)
   │  fetch() com JSON          public/js/api.js centraliza as chamadas
   ▼
Rotas (routes/)                 qual URL e método HTTP → qual controller
   ▼
Middlewares (middlewares/)      está logado? (401) tem o perfil? (403)
   ▼
Controllers (controllers/)      lê req, chama o service, monta res
   ▼
Services (services/)            regras de negócio + consultas SQL
   ▼                            validators/ conferem e normalizam os dados
SQLite (data/mensalidades.db)
```

Erros "esperados" (validação, não encontrado, duplicidade) são lançados como
`AppError` e viram respostas no formato padrão `{ "erros": ["mensagem", ...] }`
no middleware `tratadorErros`.

### Estrutura de pastas

```
├── src/
│   ├── server.js              ponto de entrada: inicializa dados e abre a porta
│   ├── app.js                 monta o Express (a ORDEM dos middlewares importa)
│   ├── config/                ambiente (.env), conexão, migrações, perfis, dados iniciais
│   ├── routes/                definição das URLs
│   ├── middlewares/           autenticação, autorização, tratamento de erros
│   ├── controllers/           ponte HTTP ↔ service
│   ├── services/              regras de negócio e SQL
│   ├── validators/            validação e normalização dos dados recebidos
│   └── utils/                 AppError, hash de senha, limitador, consultas, validações
├── public/
│   ├── *.html                 uma página por tela
│   ├── login.js               script da tela de login
│   ├── styles.css             estilos (variáveis de cor no :root)
│   └── js/                    módulos ES: api, ui, layout, máscaras e um por tela
├── cypress/                   testes automatizados (e2e/ e e2e/api/)
├── scripts/                   servidor de testes e orquestrador da suíte
├── docs/seletores-data-test.md  inventário dos seletores para automação
├── docs/openapi.yaml          contrato da API (Swagger / OpenAPI 3)
└── data/                      banco SQLite e backups (fora do Git)
```

## API

Todas as rotas, exceto login e logout, exigem sessão (**401** sem login).
Erros sempre no formato `{ "erros": ["..."] }`.

> **Swagger:** com o servidor ligado e **logado**, acesse
> [http://localhost:3001/api-docs](http://localhost:3001/api-docs) para ver e testar
> todas as rotas ("Try it out" usa o cookie da sua sessão). O contrato fica em
> [`docs/openapi.yaml`](docs/openapi.yaml) (no Postman: *Import → arquivo* gera uma coleção
> com todas as rotas), e a versão JSON em `/api-docs/openapi.json`. Ao criar ou alterar
> uma rota, atualize o YAML.

### Autenticação

| Método | URL | Descrição |
|---|---|---|
| POST | `/api/login` | `{ usuario, senha }` → 200 · 400 · 401 · 403 (inativo) · 429 (bloqueado) |
| GET | `/api/logout` | Encerra a sessão e redireciona ao login |
| GET | `/api/sessao` | Dados do usuário logado |

### Painel

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/dashboard?mes=AAAA-MM` | Todos os indicadores do mês (padrão: mês atual) |

### Pagamentos

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/pagamentos?mes=&jogador_id=&status=&pagina=&limite=` | Lista com totais. Sem `pagina`/`limite`, devolve tudo |
| POST | `/api/pagamentos` | `{ jogador_id, data_pagamento, valor, status }` → 201 |
| PUT | `/api/pagamentos/:id` | Edita (cancelados não podem ser editados) |
| PATCH | `/api/pagamentos/:id/cancelar` | Cancelamento lógico |
| DELETE | `/api/pagamentos/:id` | Mantido por compatibilidade: **também apenas cancela** (204) |

### Jogadores

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/jogadores?busca=&status=&pagina=&limite=` | Lista paginada (busca por nome ou CPF) |
| GET | `/api/jogadores/opcoes[?incluirInativos=1]` | Lista enxuta para selects |
| GET | `/api/jogadores/:id` | Consulta |
| POST | `/api/jogadores` | Cadastra → 201 · 400 · 409 (duplicado) |
| PUT | `/api/jogadores/:id` | Edita |
| PATCH | `/api/jogadores/:id/inativar` | Inativa |

### Usuários (somente Administrador — 403 para os demais)

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/usuarios?busca=&status=&pagina=&limite=` | Lista paginada |
| GET | `/api/usuarios/:id` | Consulta |
| POST | `/api/usuarios` | Cadastra → 201 · 400 · 409 |
| PUT | `/api/usuarios/:id` | Edita (senha em branco mantém a atual) |
| PATCH | `/api/usuarios/:id/inativar` | Inativa |

## Banco de dados

SQLite com **migrações versionadas** (`src/config/migracoes.js`). O banco guarda a
versão em `PRAGMA user_version`; ao iniciar, só as migrações mais novas são aplicadas,
cada uma dentro de uma transação. **Nunca altere uma migração já aplicada: crie uma nova.**

| Versão | O que faz |
|---|---|
| 1 | Usuários: nome completo, e-mail, perfil, situação e índices únicos |
| 2 | Tabela de jogadores, vínculo `pagamentos.jogador_id` (chave estrangeira) e importação dos jogadores a partir dos pagamentos existentes |

```
usuarios   id · nome (login) · senha (hash) · nome_completo · email · perfil · ativo · criado_em · atualizado_em
jogadores  id · nome_completo · cpf · telefone · data_nascimento · data_entrada · valor_mensalidade · ativo · observacoes · criado_em · atualizado_em
pagamentos id · jogador_id → jogadores.id · jogador (nome, histórico) · data_pagamento · valor · status (Pago|Pendente|Cancelado) · criado_em
```

## Segurança

- Senhas com **hash scrypt** + salt; comparação em tempo constante; nunca retornadas pela API.
- **Limite de tentativas** de login por IP + usuário (429).
- Mensagem de login **genérica** e tempo de resposta parecido para usuário existente ou não.
- Sessão **regenerada** no login; cookie `httpOnly` e `sameSite=lax`; segredo no `.env`.
- Sessão guarda só o id do usuário: inativação e mudança de perfil valem **na hora**.
- Autorização por perfil **no backend** (o menu escondido é só conforto visual).
- Páginas protegidas por padrão ("negar por padrão"); só o login e o CSS são públicos.
- Consultas SQL sempre com parâmetros (`?`), o que impede SQL Injection.
- Dados do usuário inseridos na tela com `textContent`, o que impede XSS.
- Validação no frontend (retorno rápido) **e** no backend (garantia).

## Testes automatizados (Cypress)

```bash
npm run test:e2e
```

- **67 testes**: 35 de API (`cypress/e2e/api/`) e 32 pela interface (`cypress/e2e/`).
- Rodam contra um **banco descartável** (`data/teste-e2e.db`), recriado a cada execução.
  O banco real nunca é tocado.
- Massa de dados criada pela API em cada teste (`cy.criarJogador()`, `cy.criarUsuario()`...),
  com valores únicos, para os testes serem independentes entre si.
- Seletores: sempre `data-test`. Veja o inventário em
  [docs/seletores-data-test.md](docs/seletores-data-test.md).

```js
it('cadastra jogador', () => {
  cy.login();                       // login pela API, com cy.session
  cy.visit('/jogadores.html');
  cy.get('[data-test="btn-novo-jogador"]').click();
  cy.get('[data-test="input-nome-jogador"]').type('Fulano de Tal');
  cy.get('[data-test="input-valor-mensalidade"]').type('80');
  cy.get('[data-test="btn-salvar-jogador"]').click();
  cy.get('[data-test="toast"][data-tipo="sucesso"]').should('be.visible');
});
```

## Roteiro de estudo

Uma ordem sugerida para ler o código e entender como tudo se conecta:

1. `src/server.js` → `src/app.js`: como uma requisição percorre o Express.
2. `src/middlewares/autenticacao.js` e `autorizacao.js`: 401 × 403.
3. Um fluxo completo, de ponta a ponta: `public/js/jogadores.js` → `routes/jogadorRoutes.js`
   → `controllers/jogadorController.js` → `services/jogadorService.js` → SQL.
4. `src/utils/senha.js` e `services/authService.js`: hash, salt e ataques de timing.
5. `src/config/migracoes.js`: como evoluir um banco sem perder dados.
6. `services/dashboardService.js`: `GROUP BY`, `SUM`, `NOT EXISTS`, `JOIN`.
7. `cypress/support/commands.js` e as specs: como automatizar e por que usar `data-test`.

**Desafio para praticar:** criar o campo "mês de referência" no pagamento. Exige uma
migração nova (versão 3), ajustes no validator e no service, no formulário e nos testes,
cobrindo todas as camadas do sistema.
