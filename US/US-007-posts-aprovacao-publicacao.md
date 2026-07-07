# US-007 - Fluxo de posts, aprovacao e publicacao

## Objetivo

Manter e organizar o fluxo de criacao, aprovacao, agendamento e publicacao de posts por cliente.

## Origem

- Especificacao de telas
- Especificacao da plataforma multi-cliente

## Descricao

Como usuario operacional, quero criar, revisar, aprovar, rejeitar e publicar posts vinculados ao cliente correto.

## Escopo

- Criacao de rascunho
- Envio para aprovacao
- Edicao do post antes da aprovacao
- Aprovacao e rejeicao
- Agendamento
- Publicacao e registro de status
- Historico e rastreabilidade

## Criterios de aceite

- Todo post fica vinculado a um `cliente_id`.
- O usuario nao consegue acessar post de outro cliente.
- O fluxo de aprovacao respeita permissao por perfil.
- O sistema registra historico das mudancas de status.
- O status tecnico da midia e exibido quando aplicavel.
- O usuario ve mensagens claras ao falhar upload, validacao ou publicacao.

## Dependencias

- US-001
- US-002
- US-003
