# US-001 - Seguranca de autenticacao e acesso

## Objetivo

Garantir que o sistema nao aceite acesso operacional por fallback de headers, usuario padrao ou qualquer outra forma nao verificada em ambiente de producao.

## Origem

- Validacao operacional
- Especificacao da plataforma multi-cliente

## Descricao

Como administrador da plataforma, quero que toda requisicao protegida exija autenticacao valida para impedir acesso indevido a dados e operacoes.

## Escopo

- Exigir token valido para acesso operacional
- Remover fallback por `x-user-email` e `x-user-name` em producao
- Eliminar usuario padrao implicito
- Padronizar resposta 401 quando nao houver autenticacao
- Manter logs tecnicos sem expor detalhes sensiveis ao usuario final

## Criterios de aceite

- Toda rota protegida retorna 401 quando nao houver token valido.
- Nenhuma requisicao operacional pode autenticar apenas por header textual.
- Nao existe usuario padrao automatico em producao.
- O usuario autenticado precisa existir na base operacional ativa.
- Usuarios inativos nao conseguem acessar o sistema.
- Mensagens de erro para o frontend nao expoem segredo, stack ou payload sensivel.

## Dependencias

- US-002
- Infra de autenticao Supabase ou equivalente ja configurada.
