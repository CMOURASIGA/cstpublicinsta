# US-005 - Gestao de usuarios do cliente

## Objetivo

Permitir administrar usuarios vinculados a um cliente, incluindo convite, edicao de perfil, inativacao e remocao de vinculo.

## Origem

- Especificacao de telas
- Especificacao da plataforma multi-cliente

## Descricao

Como `ADMIN_CLIENTE` ou `SUPER_ADMIN`, quero gerenciar os usuarios do cliente ativo para controlar acesso operacional.

## Escopo

- Listar usuarios do cliente ativo
- Convidar usuario para o cliente
- Editar perfil e status
- Inativar acesso
- Remover vinculo
- Registrar auditoria das alteracoes

## Criterios de aceite

- O usuario ve apenas os usuarios do cliente ativo.
- O `ADMIN_CLIENTE` nao consegue criar `SUPER_ADMIN`.
- O `SUPER_ADMIN` consegue atuar em qualquer cliente.
- Convite cria ou vincula usuario e registra log.
- Alteracao de perfil e status fica auditada.
- Remocao de vinculo atualiza a relacao cliente-usuario corretamente.

## Dependencias

- US-001
- US-002
- US-003
