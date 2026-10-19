# Bloco 02 — Política proposta para canais e integrações compartilhadas

**Estado:** proposta para revisão; não é autorização para ativar enforcement. **Fonte:** código inspecionado na branch `feature/modular-plans-entitlements`, especialmente `entitlements/catalog.ts`, `entitlements/resolver.ts`, `authorization/authorize.ts` e APIs de Atendimento. Não houve consulta a dados de produção.

## Separar quatro dimensões

1. **Módulo contratado:** `atendimento` autoriza o acesso comercial à operação de Atendimento; não concede automaticamente permissões operacionais.
2. **Capacidade comercial:** `integrations` indica direito comercial à capacidade de integrações; não é uma permissão de usuário.
3. **Canal contratado:** `whatsapp`, `instagram_channel`, `email_channel` e `site_widget` são direitos comerciais distintos; não identificam provider, conta ou inbox.
4. **Permissão operacional:** `integrations.view/edit/delete` controla quem pode configurar integrações. O motor `authorizeModuleAccess` só reconhece `atendimento.atendimento`, `vendas.leads/kanban` e `marketing.projects`. Não passar `integrations` como `permission` do módulo Atendimento: seria rejeitado.

## Matriz proposta (não implementada)

| Superfície | Direito de módulo | Direito de canal | Permissão operacional | Cuidados |
|---|---|---|---|---|
| Equipes, inboxes, agentes e diagnóstico | atendimento | — | atendimento conforme ação | Guard comercial observe_only já integrado em rotas auditadas |
| Widget: configuração, provisionamento, agentes | atendimento | site_widget | integrations conforme ação | Provisionamento externo e vínculo Chatwoot devem permanecer intactos |
| WhatsApp: conexão e remoção | atendimento | whatsapp | integrations conforme ação | Respeitar limites, titularidade, provider e callbacks |
| Instagram: configuração, conexão e contas | atendimento | instagram_channel | integrations conforme ação | Não alterar OAuth, token ou webhook |
| E-mail: listar, autorizar e remover | atendimento | email_channel | integrations conforme ação | Não alterar OAuth, callbacks e credenciais |
| Catálogo de providers | a definir | — | integrations.view | Pode ser UI de descoberta; não inferir direito a conectar |
| Webhooks/callbacks externos | política técnica própria | canal vinculado ao tenant | assinatura/segredo do provider, não sessão humana | Não aplicar guard de sessão de usuário; verificar tenant e idempotência |

## Critérios obrigatórios antes de qualquer bloqueio

- A decisão final deve ser a **interseção**, não a união, de módulo, canal/capacidade quando aplicável, permissão operacional, status comercial e propriedade do recurso.
- Consultar entitlements do tenant autenticado no servidor; nunca aceitar `organizationId`, role, módulo ou canal enviados pelo frontend como autoridade.
- Ausência, configuração inválida ou erro de leitura deve produzir negativa no modo enforce, sem permitir acesso implícito a owner.
- Em `observe_only`, preservar a resposta legada e registrar observações sem tokens, IDs pessoais ou dados de outros tenants.
- Tratar clientes com configuração antiga de `Organization.features` antes de ativar; o resolver não faz fallback universal de plano.
- **Não habilitar** `APPROVED_ENFORCEMENTS` antes de testes funcionais e revisão independente. A política de atraso de dez dias precisa ser conciliada com o bloqueio imediato de `past_due`.
- Não inferir que todo recurso de `integrations` pertence a Atendimento: há integrações compartilhadas. Exigir classificação por endpoint e método.

## Próxima execução

Preparar testes unitários isolados para a interseção de módulo + canal + permissão operacional; depois integrar em modo observação nos handlers de configuração, com atenção a providers e sem ativar bloqueios. Testar tenants fictícios com canais diferentes, owner/admin/user, token revogado, erro de banco e vínculo cruzado. Revisar a proposta antes de alterar a política de produção.
