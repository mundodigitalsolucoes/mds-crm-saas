# Google OAuth + onboarding SaaS — PR #14 (draft)

## Implementado na branch
- Login Google para usuário existente e ativo, com e-mail verificado; vínculo por Google subject (sub) único, associado ao User interno.
- Cadastro Google: empresa + consentimento LGPD registrados em cookie HttpOnly assinado (JWT, validade 10 minutos) antes do redirecionamento OAuth; após autenticação Google, criação transacional de Organization, User owner e GoogleIdentity, trial de 14 dias e disparo do provisionamento Chatwoot.
- Senha aleatória não reutilizável para compatibilidade com passwordHash obrigatório; senha não solicitada ao usuário Google.
- GoogleProvider só é registrado quando GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão definidos.
- Login e cadastro por e-mail e senha continuam disponíveis.
- Contas excluídas não podem ser reativadas por cadastro público para reiniciar o trial.
- Nenhum merge nem deploy autorizado.

## Migração
prisma/migrations/20261018030000_google_identity/migration.sql — cria tabela google_identities, subject único e userId único, FK para users.

## Configuração
GOOGLE_CLIENT_ID: ID OAuth (servidor)
GOOGLE_CLIENT_SECRET: segredo OAuth (servidor; nunca comitar valores reais)
Callback exato: https://crm.mundodigitalsolucoes.com.br/api/auth/callback/google
NEXTAUTH_URL deve coincidir com o domínio público.
Registrar ENVs no documento oficial 19-ENVS-E-CREDENCIAIS e [ENV] no CHANGELOG antes do deploy.

## Pendências de homologação obrigatórias
- Rodar npm ci, npx prisma validate, npx prisma generate e npm run build; nenhum teste foi executado nesta sessão.
- Validar comportamento de cookies() no callback NextAuth v4 sob Next.js 16 em ambiente real; confirmar leitura do intent no callback OAuth.
- Testar login com usuário existente, Google novo, repetição, dois Google accounts com mesmo e-mail, usuário/organização excluídos, concorrência, LGPD, expiração e login por senha.
- Validar isolamento multi-tenant, plano, trial expirado, permissões e provisionamento Chatwoot.
- Revisar vínculo automático por e-mail verificado com a política de segurança desejada; considerar exigir associação autenticada para contas preexistentes.
- Validar migração em banco isolado antes de produção e rollback.
- Considerar endurecimento de prevenção de abuso de trial entre identidades diferentes; e-mail único não impede abuso entre e-mails distintos.
- Ajustar UX da tela de cadastro e mensagens de erro após testes de navegador.
- Configurar Google Cloud e Coolify e atualizar documentação oficial de ENVs e changelog.

**Status: código candidato, não homologado, PR em draft. Não fazer merge/deploy.**
