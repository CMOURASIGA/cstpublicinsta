# US-010 - UX, acessibilidade e feedback visual

## Objetivo

Melhorar a experiencia operacional com feedback consistente, acessibilidade minima e estados visuais padronizados.

## Origem

- Validacao operacional
- Especificacao de telas

## Descricao

Como usuario da plataforma, quero interacoes mais previsiveis e acessiveis para operar sem depender de alertas nativos do navegador.

## Escopo

- Substituir `alert()` e `confirm()` por componentes proprios
- Padronizar loading, empty state, error state e sem permissao
- Melhorar acessibilidade com labels, roles e foco visivel
- Ajustar escala tipografica minima
- Melhorar feedback de processos longos

## Criterios de aceite

- Nenhuma acao critica depende de `alert()` ou `confirm()` nativos.
- Todas as telas importantes possuem estado de carregando, vazio e erro.
- Campos e botoes principais sao operaveis por teclado.
- Elementos sem texto possuem rotulo acessivel.
- Texto operacional principal nao usa tamanho excessivamente pequeno.

## Dependencias

- US-003
