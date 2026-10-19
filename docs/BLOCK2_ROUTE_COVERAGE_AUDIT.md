# Bloco 2 — Auditoria de cobertura das rotas e isolamento

**Escopo:** leitura da branch `feature/modular-plans-entitlements`; nenhum enforcement ou alteração em produção.

## Evidências de código

| Superfície | Autorização encontrada | Observação |
|---|---|---|
| `/api/projects` | `checkModulePermission({module:'marketing',permission:'projects',...})` | Cobertura comercial implementada, ainda `observe_only` |
| `/api/leads` e `/api/kanban` | Testes de integração Vendas existentes (`authorization-sales.test.ts`) | Exigir inventário método a método antes de ativar |
| `/atendimento` | `PermissionGate module='atendimento' action='view'` no cliente | UI não substitui guard de servidor; credenciais são buscadas por API |
| `/api/atendimento/equipes` | `checkPermission('atendimento','view/create')` | Permissão legada, sem limite comercial unificado |
| `/api/atendimento/canais/email` | `checkPermission('integrations','view/delete')` | Integrações/providers: requer política comercial específica e auditoria antes de tocar |
| `/api/agenda` | `checkPermission('agenda',...)` | Compartilhado; valida tenant em listagem e relações de criação |
| `/api/tasks` | `checkPermission('tasks',...)` | Compartilhado; listagem usa organizationId da sessão |
| `src/lib/authorization/guards.ts` | Avalia motor comercial, mas `observe_only` preserva decisão legada | Owner continua podendo usar recurso não contratado até ativação controlada |
| `src/lib/authorization/inventory.ts` | Consulta SQL de inventário em transação `READ ONLY` com rollback | Diagnóstico não deve revelar identificadores de tenants; não foi executado em banco real |

## Riscos e decisões

1. **Atendimento:** completar inventário de rotas de equipes, inboxes, canais, agentes, widget e SSO/credenciais antes de integrar guard comercial. Preservar autenticação específica de callbacks, webhooks e providers. Não trocar `integrations` por `atendimento` indiscriminadamente.
2. **Marketing:** comprovar que todas as superfícies do módulo estão mapeadas. `projects` não implica que toda função de marketing se restrinja a projetos.
3. **Vendas:** confirmar cobertura de todos os métodos e ações de leads, etapas, bulk e importação, inclusive rotas indiretas.
4. **Recursos compartilhados:** agenda, tarefas, tags e integrações precisam de matriz de ownership comercial; não bloquear com módulo arbitrário.
5. **Isolamento:** exigir `organizationId` de sessão nas queries e nas mutações finais; proteger relações e objetos filhos. A existência de filtros em algumas rotas não prova cobertura global.
6. **Owner:** a regra comercial no novo motor já nega módulo ausente em testes, mas `APPROVED_ENFORCEMENTS` permanece vazio. Não ativar sem homologação por tenant.
7. **Política de cobrança:** `past_due` ainda é tratado como bloqueio imediato por partes do código; política de 10 dias é trabalho separado, porém precisa ser reconciliada antes de ativar enforcement comercial.

## Evidência de CI

GitHub Actions `Block 2 Authorization Regression` execução #1: 83/84 testes passaram; teste de fronteira histórica falhou porque comparava arquivos alterados intencionalmente por C03/C04. Commit `280e311` corrigiu escopo do teste, e execução #2 aparece aprovada na interface GitHub apresentada pelo usuário. A aprovação de testes com fixtures não substitui homologação funcional em staging.

## Próximo incremento recomendado

Implementar primeiro uma **matriz automatizada de inventário** por rota/método, sem modificar comportamento, e revisar separadamente Atendimento, recursos compartilhados e providers. Após revisão independente, testar cenários de tenant fictício com módulo ausente e preparar ativação por tenant, sem merge/deploy.
