# MDS CRM SaaS — Política proposta de inadimplência (10 dias)

**Status:** regra de negócio aprovada pelo usuário em 2026-10-18; implementação de bloqueio automático e integração de pagamentos **não autorizadas nesta etapa**. Não confundir suspensão financeira com exclusão lógica.

## Regra aprovada

- Cliente com plano vencido permanece com acesso durante os primeiros **10 dias de atraso**.
- Após completar **10 dias de inadimplência**, suspender o acesso operacional dos usuários do tenant; não excluir, rebaixar papéis ou modificar dados.
- Ao confirmar pagamento válido e liquidado, reativar o acesso do tenant, preservando todos os dados.
- Conta/tenant soft-deleted continua impedido de entrar e recuperar senha, independentemente de pagamentos.

## Estado observado no código

- `Organization` possui `plan`, `planStatus`, `subscriptionId`, `asaasCustomerId`, `trialEndsAt` e `deletedAt`.
- Não foi identificado campo de vencimento, início de inadimplência ou histórico financeiro na modelagem inspecionada de `Organization`. Não presumir que `planStatus` sozinho permite contar 10 dias.
- O `src/lib/auth.ts` atual verifica exclusão lógica e inclui `planStatus` na sessão, mas não implementa bloqueio financeiro no trecho revisado.
- Política de módulos em `observe_only` permanece inalterada. **Não ligar enforcement comercial por acidente.**

## Plano técnico para aprovação posterior

1. Auditar integração financeira/Asaas existente e identificar fonte autoritativa de vencimento e quitação. Não assumir que todo webhook representa pagamento liquidado.
2. Definir estados comerciais separados (por exemplo `active`, `past_due`, `suspended_nonpayment`) e registrar `dueAt`, `suspendedAt`, `paidAt` ou equivalente com histórico/auditoria. Evitar criar estado paralelo quando já houver modelagem oficial.
3. Estabelecer interpretação exata do prazo: suspensão **após completar dez dias corridos desde o vencimento**, no fuso de cobrança definido. Definir política para múltiplas faturas, pagamento parcial, contestação, chargeback, suspensão manual e planos trial.
4. Bloquear apenas superfícies humanas protegidas do tenant, com uma tela de cobrança e caminho para regularização. Preservar login necessário para pagar, recuperação de senha para usuários ativos e o Super Admin.
5. **Não bloquear** webhooks de cobrança, callbacks técnicos e reconciliação financeira que permitam detectar a quitação; isolar também lifecycle Chatwoot/Evolution/Meta.
6. Após evento de pagamento confirmado, reconciliar com provedor de forma idempotente e desbloquear somente suspensão por inadimplência, sem reativar tenant excluído ou suspensão administrativa.
7. Cobrir testes 0/9/10/11 dias, fusos, atraso de webhook, eventos duplicados/fora de ordem, reembolso, pagamento parcial, tenant excluído, tokens já emitidos, isolamento multi-tenant, e reversão de estado.
8. Homologar em banco descartável e providers simulados, depois revisão independente, autorização expressa e rollout gradual.

## Guardrails

Nenhuma migração, mudança de status real, deploy, merge, alteração de credenciais, integração financeira ou enforcement de módulos nesta etapa.
