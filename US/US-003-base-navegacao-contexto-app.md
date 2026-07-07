# US-003 - Base de navegacao, rotas e contexto do app

## Objetivo

Estruturar o frontend com rotas reais, contexto de cliente ativo e layout administrativo reutilizavel.

## Origem

- Especificacao de telas

## Descricao

Como usuario da plataforma, quero navegar por rotas reais e manter o contexto do cliente ativo para compartilhar link, voltar no navegador e operar sem depender de estado local.

## Escopo

- Criar AppShell com sidebar e topbar
- Criar contexto global de cliente ativo
- Migrar a navegacao de `currentScreen` para rotas reais
- Separar contexto `/admin` e `/app`
- Recarregar dados ao trocar cliente
- Respeitar permissoes de menu por perfil

## Criterios de aceite

- O usuario consegue acessar telas por URL.
- O botao voltar do navegador funciona de forma consistente.
- O cliente ativo persiste ao navegar.
- Super admin consegue alternar clientes.
- Usuarios comuns veem apenas o cliente permitido.
- O layout principal e reutilizado entre telas.

## Dependencias

- US-001
- US-002
