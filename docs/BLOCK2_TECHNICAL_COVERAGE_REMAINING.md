# Bloco 02 — Fechamento de cobertura técnica: inventário e pendências

**Branch:** `feature/modular-plans-entitlements`. **Estado:** cobertura parcial, não homologada; não ativar enforcement. Atualizado após implementação das observações de canais e correção de isolamento na troca de token do Instagram.

## Cobertura implementada

- Marketing: projetos, com guard comercial em `observe_only`.
- Vendas: Leads e Kanban, com integração em `observe_only`.
- Atendimento: equipes, agentes, inboxes, membros e diagnóstico, com guards comerciais em `observe_only`.
- Widget: configuração GET/POST, agentes e provisionamento, com observação de `site_widget` **depois** da permissão operacional.
- WhatsApp: conexão e exclusão Cloud API e conexão genérica, com observação de `whatsapp`.
- E-mail: canais e início de autorização Google, com observação de `email_channel`.
- Instagram: configuração, conexão, contas, criação de inbox, debug e operações de sincronização, com observação de `instagram_channel`.
- `instagram/exchange-token`: agora exige sessão e `integrations.edit`, compara `organizationId` recebido com tenant autenticado e usa apenas o tenant autenticado nas escritas. **Revisar também o protocolo OAuth de ponta a ponta**.
- Webhook e callback Instagram: intocados; exigem validação própria de origem, assinatura, estado, replay e isolamento, não guard de sessão humana.

## Cobertura ainda necessária antes de declarar fase concluída

1. **Páginas:** `/atendimento` e subpáginas `/settings/atendimento/**` usam majoritariamente componentes de cliente; realizar revisão por página, controle de menu e guard server-side no layout ou rota apropriada, preservando permissões distintas `atendimento` e `integrations`.
2. **Rotas não exclusivas:** `/api/agenda`, `/api/tasks`, tags, notificações, relatórios, anexos e funções compartilhadas precisam de mapeamento por recurso/ação. Não atribuir automaticamente a Marketing ou Vendas.
3. **APIs indiretas e server actions:** verificar inventário integral de handlers, ações e chamadas a serviços para evitar contornar a política por endpoint alternativo.
4. **Provider catalog:** `/api/atendimento/canais/providers` lista opções e métricas; classificar como descoberta compartilhada ou canal WhatsApp antes de exigir entitlement específico.
5. **Contratos de canais:** o avaliador atual lê a lista explícita `Organization.features`. Ainda **não** aplica limites `maxConnections` do contrato futuro nem o direito comercial de capacidade `integrations`; definir compatibilidade com assinaturas legadas antes de enforcement.
6. **Isolamento:** auditar os vínculos de inbox, conta, equipe e IDs externos com testes de tenants distintos; testes estáticos não demonstram ausência de IDOR.
7. **OAuth/segredos:** validar `state`, expiração, consumo único, binding tenant/usuário, não exposição de tokens e callbacks de Meta/Google. A correção de `exchange-token` não substitui essa auditoria.
8. **Homologação:** testes de integração com mocks de providers, usuários fictícios, owner/admin/user e organização sem Marketing. Validar C03/C04 e o comportamento de falha de banco.
9. **Rollout:** somente após evidências de cobertura e homologação, aprovar tenant piloto e alterar `APPROVED_ENFORCEMENTS`. Nenhuma aprovação existe hoje.

## Critério de aceite

A fase de cobertura técnica só pode ser marcada concluída quando todas as páginas, handlers, server actions e rotas indiretas estiverem inventariados e protegidos por política comercial apropriada ou exceção fundamentada, com regressões e CI aprovadas. A conclusão de CI isoladamente não prova esse critério.
