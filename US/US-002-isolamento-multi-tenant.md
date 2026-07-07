# US-002 - Isolamento multi-tenant por cliente

## Objetivo

Garantir que um usuario so acesse dados do cliente ao qual ele realmente pertence, evitando vazamento entre clientes.

## Origem

- Validacao operacional
- Especificacao da plataforma multi-cliente

## Descricao

Como sistema multi-cliente, quero validar o vinculo entre usuario e cliente em toda rota de cliente para impedir acesso indevido por troca manual de `clienteId`.

## Escopo

- Criar guarda central para validar vinculo usuario-cliente
- Aplicar a guarda em todas as rotas ` /api/clientes/:clienteId/*`
- Liberar excecao apenas para `SUPER_ADMIN`
- Validar leitura, edicao, remocao e testes de integracao
- Cobrir o comportamento com testes automatizados

## Criterios de aceite

- Um usuario de um cliente nao consegue ler dados de outro cliente alterando a URL.
- Um usuario de um cliente nao consegue editar usuarios, integracoes, configuracoes ou posts de outro cliente.
- `SUPER_ADMIN` pode acessar todos os clientes.
- O backend retorna 403 quando o usuario nao pertence ao cliente informado.
- O comportamento esta coberto por testes de regressao.

## Dependencias

- US-001
