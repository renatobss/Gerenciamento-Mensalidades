# Gerenciamento de Mensalidades

Aplicacao web didatica em JavaScript com Node.js, Express e SQLite para registrar pagamentos de mensalidades.

## Requisito

- Node.js 24 ou superior, pois o projeto usa o SQLite nativo do Node.

## Por que SQLite?

Para fins educacionais, SQLite e a opcao mais simples: nao precisa instalar servidor de banco, nao exige conta externa e salva os dados em um arquivo local. SQL Server e mais pesado para comecar, enquanto Google Sheets depende de credenciais e integracao com API.

## Como executar

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## Conceitos para estudar neste projeto

- Servidor web com Express
- Rotas REST para cadastrar, listar, editar e excluir
- Validacao de dados no backend e no frontend
- Persistencia em banco SQLite
- Manipulacao do DOM com JavaScript
- Filtro por mes e calculo de total
