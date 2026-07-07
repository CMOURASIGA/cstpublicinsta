# US-008 - Logs e auditoria

## Objetivo

Disponibilizar visao de auditoria operacional para suporte, rastreabilidade e analise de eventos.

## Origem

- Especificacao de telas
- Validacao operacional

## Descricao

Como administrador da plataforma, quero consultar logs por cliente, servico e evento para diagnosticar falhas e revisar operacoes relevantes.

## Escopo

- Tela de logs global para `SUPER_ADMIN`
- Tela de logs por cliente para usuario autorizado
- Filtros por cliente, usuario, servico, evento, status e periodo
- Registro de acoes criticas da plataforma

## Criterios de aceite

- O `SUPER_ADMIN` acessa logs globais.
- O usuario de cliente acessa apenas logs do seu cliente.
- O filtro por data e servico funciona corretamente.
- Eventos de cliente, integracao, post e autenticacao ficam rastreados.
- A tela mostra estado vazio e erro de forma clara.

## Dependencias

- US-001
- US-002
- US-003
