# MDS White Label Mode

## Objetivo

A flag `MDS_WHITE_LABEL_MODE` prepara a base para o modo white label da MDS. Nesta Sprint 1, ela apenas disponibiliza o estado da configuração no frontend por meio de `window.chatwootConfig.mdsWhiteLabelMode` e do helper `isMdsWhiteLabelModeEnabled`.

## Ativação

Defina a variável de ambiente como `true` no ambiente desejado:

```env
MDS_WHITE_LABEL_MODE=true
```

Depois, reinicie a aplicação para que o layout Rails exponha o novo valor no `window.chatwootConfig`.

## Desativação

Defina a variável de ambiente como `false` ou remova a variável do ambiente:

```env
MDS_WHITE_LABEL_MODE=false
```

Quando ausente, a aplicação assume `false` como valor padrão.

## Rollback

Para reverter operacionalmente sem deploy, altere `MDS_WHITE_LABEL_MODE=false` e reinicie a aplicação. Para rollback de código, reverta o commit desta Sprint, removendo a exposição no layout, o helper, o teste e esta documentação.

## Escopo desta Sprint

Nesta Sprint 1, a flag ainda não altera menus, sidebar, rotas, permissões, banco de dados, API, SSO, workers, Sidekiq, controllers ou models. O objetivo é somente criar a base segura para próximas Sprints.
