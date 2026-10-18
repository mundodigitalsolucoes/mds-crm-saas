# ADR-001 — Planos modulares, compatibilidade e governança de alterações

**Data:** 2026-10-18  
**Estado:** decisão arquitetural aprovada; Bloco 1 implementado com ressalvas; correções complementares pendentes.  
**Base auditada:** commit `175dcb8efd3256637c3f32d00580bb7118300b3c`.  
**Escopo:** MDS CRM SaaS multi-tenant; piloto White-Label Ótica São Paulo.

## 1. Decisões oficiais
- CORE compartilhado e único, sem fork por organização.
- Super Admin MDS é a autoridade comercial para planos, módulos, capacidades, limites e identidade White-Label.
- Módulos independentes: `atendimento`, `vendas`, `marketing`; `financeiro` e `agentes_ia` planejados, não operacionais.
- `white_label`, `advanced_reports`, `integrations`, `ai_assistant` são capacidades; não se confundem com módulos. `ai_assistant` legado não é `agentes_ia`.
- Canais e add-ons são dimensões próprias. O direito comercial não substitui permissão operacional por usuário.
- Atendimento tem canais habilitados e limites individuais por tipo de canal, a implementar no Bloco 3.
- Dashboard e configurações comuns são infraestrutura da plataforma e devem respeitar os módulos contratados.
- Cliente owner/admin gerencia operação e membros, nunca planos, limites comerciais ou branding MDS.
- Ótica São Paulo: piloto com Atendimento + Vendas + White-Label; Marketing desativado após enforcement homologado. Quantidades de canais/usuários ainda não definidas.

## 2. Fonte de verdade e compatibilidade
- Persistência atual: `Plan.features` e `Organization.features` como strings JSON; `syncPlanLimits` replica features/limites conforme fluxos atuais.
- Para o motor de leitura, `Organization.features` é o snapshot comercial da organização. Não inferir direitos pelo nome do plano ou por fallback automático de `Plan.features`.
- Parser: somente array JSON de strings; identificadores desconhecidos não concedem direitos; duplicatas normalizadas; configuração inválida não concede direitos novos.
- `observe_only` é obrigatório no Bloco 1. Não ligar guardas globais, alterar assinatura, migrar organizações ou bloquear módulos até inventário e homologação.
- `needsMigrationReview` é diagnóstico, não autorização de acesso nem prova de que a organização é legada.
- Sem inventário autorizado de dados reais, não se conhece o volume de organizações com `features=[]`, JSON inválido ou divergência entre plano e organização.
- Desativar módulo não significa apagar dados. Política de acesso e retenção será definida antes de enforcement.

## 3. Contratos de canais e providers
- O contrato futuro `ChannelEntitlementContract` usa quantidades inteiras >= 0; zero significa nenhuma conexão.
- O campo legado `maxWhatsappInstances` aceita -1 = ilimitado, 0 = nenhum, >0 = quantidade. **Não converter -1 em 0 nem aplicar diretamente o schema futuro.**
- Uma futura migração deve definir explicitamente representação de ilimitado, conversão de valores legados e limites por canal, com testes e rollback.
- `whatsapp` como feature comercial não identifica provider nem representa uma conexão real.
- Regra operacional oficial: **1 número = 1 inbox = 1 canal operacional**. Evolution API e Meta Cloud API mantêm autenticação, webhooks, lifecycle, sessão, fila, onboarding e dispatcher isolados.
- Não modificar Chatwoot/Atendimento nem provisionamento no Bloco 1.

## 4. Pendências confirmadas na auditoria independente
**P1 — validação no backend:** `src/lib/validations/admin.ts` aceita `features` como string de até 5000 caracteres, sem validação semântica. Validar novos payloads no POST/PUT dos planos usando parser/catalog, sem impedir atualização de campos não relacionados em planos legados com features inválidas. Não descartar identificadores desconhecidos de listas legadas válidas silenciosamente.

**P1 — propagação em massa:** `src/app/admin/plans/page.tsx` inicializa `propagateToOrgs: true` ao criar/editar; `PUT /api/admin/plans/[id]` faz `updateMany` nas organizações com o nome antigo do plano. Mudar padrão da interface para **false**, pedir confirmação explícita com impacto estimado antes de propagação e manter proteção no servidor. Não executar alterações de dados reais neste lote.

**P1 — limites de WhatsApp:** documentar e testar coexistência de `maxWhatsappInstances=-1` com contrato futuro não negativo; não fazer migração nem enforcement no Bloco 1.

**P2 — lint:** script `next lint` é incompatível com Next.js 16. Planejar ajuste de tooling isolado, sem ampliar escopo de autorização.

**P1 — documentação:** os 11 documentos de governança fornecidos no contexto do projeto não estavam no checkout do agente Codex. Ausência não autoriza suposições. Disponibilizar documentação canônica revisada, sem segredos, ao agente antes de alterar CORE protegido. Este ADR é registro de decisões, não substitui os documentos originais.

## 5. Plano de correção complementar (mesma branch)
1. Auditar consumidores e payloads reais das APIs de planos, inclusive edição parcial e preservação de features legadas.
2. Implementar validação semântica **no servidor** para features novas/alteradas, rejeitando formato inválido sem conceder acesso; testar POST/PUT e edição parcial.
3. Tornar propagação **opt-in**, com confirmação e indicação do número de organizações impactadas; sem alteração automática de tenants.
4. Documentar e testar ponte de compatibilidade de `maxWhatsappInstances`, sem tocar providers nem schema de produção.
5. Registrar casos de teste, riscos e rollback no relatório de complemento.
6. Executar testes, TypeScript, build e lint apropriado (registrar qualquer falha pré-existente).

## 6. Critérios de aprovação
- Compatibilidade legada preservada e alterações em massa nunca ocorrem por default.
- Nenhuma escrita em organização, banco de produção ou provider.
- Sem enforcement de módulos, merge, PR novo ou deploy.
- Evidência de testes para payloads inválidos, preservação de desconhecidos, atualização parcial e propagação opt-in.
- Revisão independente do novo SHA antes de iniciar Bloco 2.

## 7. Proteção do CORE e operação
A metodologia oficial exige **Auditoria → Plano → Implementação → Validação**. Não implementar por hipótese; mapear impacto e rollback. Atendimento iframe `src/app/(app)/atendimento/page.tsx`, providers, webhooks, pipeline e isolamento multi-tenant são protegidos. Deploy Coolify é **manual pelo responsável**, somente após aprovação expressa.

## 8. Rastreabilidade
- Especificação: `docs/MODULAR_PLANS_WHITE_LABEL_PILOT.md`.
- Relatório de implementação: `docs/MODULAR_PLANS_BLOCK1_REPORT.md`.
- Commit Bloco 1: `175dcb8efd3256637c3f32d00580bb7118300b3c`.
- Registro de pendências e decisões: este ADR.
- Próximo marco: complemento do Bloco 1; Bloco 2 **não autorizado** até nova revisão.

## 9. Não decidido
- Limites concretos do piloto Ótica São Paulo.
- Migração das organizações legadas e marco de enforcement por organização.
- Representação persistida futura de canais e de quantidade ilimitada.
- Política de retenção/visibilidade de dados de módulos desativados.
- Matriz completa de rotas e APIs por módulo.
