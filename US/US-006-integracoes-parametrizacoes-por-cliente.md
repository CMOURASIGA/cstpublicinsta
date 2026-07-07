# US-006 - Integracoes e parametrizacoes por cliente

## Objetivo

Separar e controlar integracoes e parametros por cliente, sem expor segredos no frontend.

## Origem

- Especificacao de telas
- Especificacao de parametrizacoes
- Validacao operacional

## Descricao

Como operador da plataforma, quero configurar e testar integracoes do cliente ativo com seguranca e rastreabilidade.

## Escopo

- Exibir configuracoes e status do cliente ativo
- Permitir editar integracoes autorizadas
- Testar Google Drive, Meta e n8n
- Mostrar tokens mascarados no frontend
- Registrar alteracoes e testes em log
- Separar configuracoes do sistema e configuracoes do cliente

## Criterios de aceite

- O frontend nunca mostra token completo.
- Somente perfis permitidos conseguem alterar integracoes.
- O cliente ativo determina quais dados sao exibidos e alterados.
- Testes de conexao geram log.
- Configuracoes sensiveis ficam mascaradas ou bloqueadas conforme permissao.
- A tela nao mistura configuracao global com configuracao de cliente sem criterio claro.

## Dependencias

- US-001
- US-002
- US-003
