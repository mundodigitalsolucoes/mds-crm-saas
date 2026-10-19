# Bloco 02 — Execução dos seis gates de fechamento

**Estado:** execução iniciada, **sem homologação e sem autorização de produção**.  
**Candidato anterior:** `4220877`, CI #114 aprovada. **Novo incremento:** inventário read-only `scripts/block2-route-inventory.mjs`; aguarda CI específica.

| Gate | Trabalho executado / evidência disponível | Resultado honesto | Próxima condição de aceite |
| --- | --- | --- | --- |
| G1 C03/C04 | Plano de 15 cenários em `docs/BLOCK2_C03_C04_FUNCTIONAL_HOMOLOGATION.md`, regressões e builds anteriores | **NÃO EXECUTADO E2E** | Banco descartável, login autenticado, signup concorrente e recuperação; capturar PASS/FAIL por cenário |
| G2 Inventário | Repositório contém 116 arquivos `src/app/api/**/route.ts` no snapshot consultado; novo script enumera métodos e sinais de autorização sem rede ou escrita | **INVENTÁRIO AUTOMATIZADO PREPARADO, REVISÃO HUMANA PENDENTE** | Rodar script, classificar cada rota/método e ações indiretas, revisar as exceções; confirmar páginas e recursos compartilhados |
| G3 Isolamento/providers | Testes estáticos de Instagram, Evolution, Chatwoot e WhatsApp, CI #114 | **TESTES MULTI-TENANT COM BANCO/MOCKS PENDENTES** | Executar 2 tenants fictícios, 3 papéis e mocks Meta/Chatwoot/Evolution/Google; comprovar ausência de IDOR |
| G4 Replay | Assinatura Instagram/WhatsApp implementada; state Instagram assinado + cookie; desenho `docs/BLOCK2_INSTAGRAM_OAUTH_SINGLE_USE_DESIGN.md` | **BLOQUEANTE**: state ainda não possui consumo único atômico; webhook Instagram sem deduplicação transacional comprovada | Aprovar storage e eventual migração para nonce/dedupe, implementar/testar ou obter aceite formal documentado do risco |
| G5 Política comercial | `src/lib/authorization/policy.ts` mantém `APPROVED_ENFORCEMENTS=[]`, observe_only; inventário de entitlements existente | **SEGURO PARA NÃO ATIVAR, NÃO HOMOLOGADO PARA ENFORCE** | Aprovar matriz por recurso/ação, limites de canais, legado e plano de rollout; só então discutir enforcement |
| G6 Revisão independente | Evidências e plano de rollback documentados no gate | **PENDENTE** | Revisão por responsável distinto do implementador, assinatura de aceite e autorização explícita para promover |

## Execução isolada e segura

- Rodar `node scripts/block2-route-inventory.mjs > /tmp/block2-routes.json` no checkout; **não** contém segredos e não acessa rede ou banco. O script é um inventário heurístico: uma string `organizationId` não comprova isolamento, e uma chamada `checkPermission` no arquivo não prova proteção de todos os métodos.
- Para G1/G3, utilizar ambiente descartável **sem conexão com produção**. Não executar `npm start` sem revisar `prestart` (pode executar Prisma migrations). Mocks de providers e contas fictícias.
- Classificar cada cenário `PASS`, `FAIL` ou `SKIP` com SHA, status HTTP, efeitos no banco e evidência; `SKIP` não conta como aprovado.
- Não adicionar segredos reais em GitHub, logs, documentos ou artefatos.

## Decisões que dependem de aprovação externa

1. **G4:** escolher armazenamento para nonce OAuth de consumo único (PostgreSQL com migração ou Redis compartilhado) e deduplicação do webhook, ou aceitar explicitamente o risco com justificativa e prazo. Não aplicar migração automaticamente.
2. **G5:** aprovar semântica de módulos compartilhados e legado antes de habilitar bloqueios comerciais.
3. **G6:** aceite independente não pode ser emitido pelo próprio implementador nem inferido de CI verde.

## Critério de conclusão

**Não declarar os seis gates concluídos** sem evidências reais de G1/G3, cobertura G2 revisada, resolução/aceite G4, decisão G5 e aceite G6. Preservar `observe_only`, sem merge/deploy/migrações/produção. A conta piloto Ótica São Paulo não é necessária para os testes isolados.
