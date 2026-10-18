# Google OAuth e trial — implementação em homologação

## Escopo desta branch
- GoogleProvider opcional quando GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão configurados.
- Login Google para contas CRM **existentes e ativas**, com e-mail verificado e JWT associado ao User.id interno, organizationId, role e permissões.
- O login por credenciais permanece disponível.
- Cadastro por senha preservado; contas excluídas não podem reiniciar o trial por reativação pública.
- Nenhum merge nem deploy autorizado.

## Pendente: onboarding completo pelo Google
**Não liberar como funcionalidade comercial de teste grátis ainda.** O cadastro Google de novos clientes não foi implementado. O provedor rejeita contas desconhecidas; não cria usuários nem organizações.

Para concluir: autenticação temporária de identidade verificada (Google sub + e-mail) com proteção anti-CSRF e sessão curta; coleta do nome da empresa e consentimento LGPD; criação transacional de User+Organization com trial de 14 dias, sem senha reutilizável; identidade Google persistida vinculada ao usuário, sem vínculo inseguro baseado apenas em e-mail; provisionamento Chatwoot e testes de concorrência, reentrada, conta existente/desativada e falhas de rede.

## Configuração
- `GOOGLE_CLIENT_ID` — ID do cliente OAuth do Google Cloud, servidor, opcional enquanto recurso desativado.
- `GOOGLE_CLIENT_SECRET` — segredo do cliente OAuth; servidor apenas, nunca registrar no GitHub.
- Callback exato: `https://crm.mundodigitalsolucoes.com.br/api/auth/callback/google`.
- Registrar novas ENVs no documento oficial 19-ENVS-E-CREDENCIAIS e lançamento [ENV] no CHANGELOG antes de qualquer deploy.

## Critérios para aprovação
- `npm run build`, `npx prisma validate` e testes reais em ambiente isolado.
- Login Google / credenciais / logout, autorização por tenant e papéis, criação/expiração do trial, bloqueio de reativação e integração Chatwoot.
- Testar com credenciais OAuth no Google Cloud e Coolify. 
- Não fazer merge/deploy sem aprovação explícita.
