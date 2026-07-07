# US-004 - Listagem e cadastro de clientes

## Objetivo

Permitir ao `SUPER_ADMIN` criar, consultar, editar e gerenciar clientes da plataforma.

## Origem

- Especificacao de telas
- Especificacao da plataforma multi-cliente

## Descricao

Como `SUPER_ADMIN`, quero uma tela de clientes para administrar marcas, status, identidade visual e informacoes basicas de integracao.

## Escopo

- Tela de listagem de clientes
- Busca por nome e filtro por status
- Criacao de novo cliente
- Edicao e ativacao/inativacao
- Exibicao de resumo por cliente
- Registro de log na criacao e alteracao

## Criterios de aceite

- O `SUPER_ADMIN` consegue listar todos os clientes.
- O sistema permite criar cliente com nome, slug e status.
- O slug nao pode duplicar.
- O sistema aceita cor primaria, cor secundaria e logo.
- A lista mostra status e informacoes resumidas.
- As acoes de cliente geram log de auditoria.

## Dependencias

- US-001
- US-002
- US-003
