# Auditoria diferencial inicial — Módulos comerciais e White-Label

**Data:** 20/10/2026  
**Repositório:** mundodigitalsolucoes/mds-crm-saas  
**Base lida:** feature/modular-plans-entitlements (após decisão comercial c4cd327)  
**Natureza:** inspeção de código, somente leitura; não representa homologação funcional nem revisão da candidata local audit/block2-sanitized (18507ac).

## Achados comprovados na base remota

| Área | Já existe | Lacuna / evidência a validar | Próxima ação |
| --- | --- | --- | --- |
| Catálogo comercial | `src/lib/entitlements/catalog.ts`: atendimento, vendas, marketing como módulos disponíveis; financeiro/agentes_ia planejados; white_label é `capability`. | Sem necessidade de criar novo catálogo. Validar configuração real das organizações/planos. | Reutilizar catálogo atual. |
| Resolução | `src/lib/entitlements/resolver.ts`: resolve lista explícita em `Organization.features`, separa module/capability/channel/addon, mantém `observe_only`. | Compatibilidade legada e sete combinações ainda exigem homologação. | Testar combinações sem ativar enforcement. |
| Autorização | `src/lib/authorization/authorize.ts` testa módulo contratado, tenant, usuário, status e permissão. `src/lib/authorization/policy.ts` preserva `APPROVED_ENFORCEMENTS=[]`. | Cobertura efetiva em TODAS as rotas e ações não comprovada; rollout comercial segue inativo. | Reutilizar testes existentes; avaliar matriz de rotas. |
| Sidebar | `src/components/Sidebar.tsx` organiza Atendimento, Vendas, Marketing e áreas comuns. | `canViewItem` usa apenas papel/permissão do frontend; Atendimento não possui `module` por item; ausência visível de decisão contratual comercial para cada seção. | Conectar à resolução autenticada de módulos, sem substituir autorização backend. |
| Owner no frontend | `src/hooks/usePermission.ts` concede `true` a qualquer permissão do owner. | Visibilidade de seções não contratadas é possível; regra do contrato precisa ser aplicada separadamente. | Interseção entre módulo contratado e permissão individual. |
| Branding — dados | `src/lib/branding.ts`, `src/app/api/organizations/route.ts` e `src/app/(app)/settings/branding/page.tsx` já oferecem nome, logo, favicon e cores. | Verificar se edição está reservada à MDS quando White-Label é produto adicional; API hoje indica permissão owner/admin. | Auditar controle comercial sem retirar edição operacional legítima abruptamente. |
| Branding — shell | `src/app/(app)/layout.tsx` lê favicon da organização; `src/components/Sidebar.tsx` usa marca e paleta MDS fixas. | Ainda não aplica logo/cores por tenant em toda navegação; shell usa cores fixas. | Reaproveitar branding existente na shell e sidebar, condicionado ao contrato. |
| Escopo piloto | Módulos operacionais Atendimento, Leads e Kanban já existem e são utilizados em produção segundo responsável. | Validar Ótica São Paulo = Atendimento + Vendas + White-Label, sem Marketing, sem expor dados MDS. | Homologação isolada posterior, evitando reconstrução. |

## Prioridade mínima de trabalho

1. Não criar motor paralelo: `white_label` já está classificado como capacidade separada dos módulos.
2. Auditar primeiro a cobertura de entitlements nas rotas e o tratamento de planos legados, SEM ativar enforcement.
3. Tornar navegação e indicadores do dashboard sensíveis aos módulos da organização, respeitando permissão individual.
4. Aplicar identidade por organização na shell/sidebar reaproveitando os campos existentes, com controle MDS para disponibilidade comercial de White-Label.
5. Validar sete combinações não vazias × 2 identidades, múltiplos papéis, URLs/APIs, dados cross-tenant e regressão da organização MDS.
6. Não misturar com as correções locais do Bloco 02 sem comparar os diffs com a candidata saneada.

## Limites e segurança

Esta auditoria cobriu arquivos específicos da **branch remota**, não a candidata local `audit/block2-sanitized` HEAD informado `18507ac`. Não inferir que as lacunas ainda persistem nessa candidata; comparar antes de codificar. Não fazer merge, deploy, migrações, push da candidata, ativação de enforcement, ou mudanças em produção. O histórico público antigo com arquivo de teste sensível deve ser tratado separadamente.

**Resultado:** há infraestrutura comercial e White-Label suficiente para orientar ajustes pontuais. Não existe evidência para recomendar reescrita do CRM.
