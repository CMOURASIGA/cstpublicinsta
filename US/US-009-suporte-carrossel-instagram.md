# US-009 - Suporte a carrossel Instagram

## Objetivo

Permitir criar, validar e publicar posts do tipo carrossel sem quebrar o fluxo atual de imagem e video unico.

## Origem

- Especificacao de carrossel

## Descricao

Como usuario que cria posts, quero montar um carrossel com multiplas midias para publicar sequencias de imagem ou video no Instagram.

## Escopo

- Criar suporte a carrossel no modelo de dados
- Permitir upload multiplo de midias
- Permitir reordenar e remover itens antes de salvar
- Validar cada item individualmente
- Exibir preview em formato de carrossel
- Criar o fluxo correto de publicacao no Instagram com container pai e filhos

## Criterios de aceite

- Um carrossel suporta de 2 a 10 midias.
- Cada item do carrossel e validado individualmente.
- A ordem definida no frontend e a ordem usada na publicacao.
- O sistema nao trata carrossel como uma unica url de midia.
- O preview deixa claro que o post tem multiplos itens.
- A publicacao usa a estrutura correta da Graph API para carrossel.

## Dependencias

- US-001
- US-002
- US-003
- US-007
