# Chatwoot — correção dos três bloqueadores de onboarding

Base: `c4d0db7ac28d799887316f9926b793a6873ca324`; branch `audit/block2-sanitized`. Escopo exclusivo: concorrência do proprietário, reconciliação de webhook e fidelidade do status administrativo. Commit desta entrega: consultar o commit que adiciona este relatório; nenhuma publicação remota realizada.

## Reprodução antes / resultado depois

As três regressões foram executadas **antes de alterar a implementação**, com fonte oficial, PostgreSQL 16 descartável e servidor HTTP Platform API sintético. As três falharam. As mesmas asserções passaram após a correção; não são testes apenas de texto-fonte.

| Defeito | Causa comprovada em c4d0db7 | Correção e resultado |
|---|---|---|
| P1 proprietário | UPDATE final de User sem condição sobre chatwootUserId; atribuição concorrente era sobrescrita e o serviço retornava sucesso | Checkpoints validam o valor esperado; UPDATE final exige CAS do mesmo valor. Testes durante POST webhook e imediatamente antes do UPDATE final preservam o ID concorrente, não ativam CA/Organization e não emitem atividade de sucesso. Outro tenant permanece intacto. |
| P1 webhook | GET 404/405 ou resposta desconhecida eram tratados como lista vazia; POST podia criar, perder resposta e ser repetido | Intenção durável gravada antes do POST sob CAS existente. GET inconclusivo nunca autoriza criação. Após tentativa, mesmo lista vazia não permite outro POST. Recuperação exige registro remoto único identificável; ID conhecido também deve coincidir. Sem DELETE/PATCH de webhook. |
| P2 ready | Falha da validação remota só afetava a resposta POST; GET recalculava ready pelos registros locais | Falha persiste lastError=binding_requires_review com CAS, sem modificar data/token/isActive. GET permanece provisioned:false; somente nova validação positiva limpa esse aviso. Erros operacionais diferentes não são substituídos/apagados. UI explica as pendências e mantém ação de consultar/recuperar. |

Checkpoint legado na fase webhook sem intenção explícita é tratado como potencial POST anterior, antes de qualquer recuperação de membership. Uma execução cujo lease expirou não pode confirmar ready depois de perder seu CAS. A expiração não permite repetir POST incerto.

## Arquivos e referências

- `src/lib/integrations/chatwoot-provision.ts`: normalização conclusiva de listagem; helper webhook (170–237); DTO (305–316); metadados de validação (334–394); checkpoint/normalização legado (401–424); webhook intent e CAS final (460–482).
- `src/components/OrganizationChatwootOnboarding.tsx`: motivos compreensíveis para vínculo, webhook e proprietário, preservando recuperação existente.
- `tests/chatwoot-onboarding-postgres.test.mjs`: 26 casos funcionais, 12 novos; falhas antes/depois, CAS final independente, resposta perdida, 404/405/500, JSON inconclusivo/inválido, timeout, evidência remota, concorrência/lease expirado, legado/membership, status e erros operacionais preexistentes.
- `tests/helpers/synthetic-chatwoot.mjs`: injeções de falha/concorrência no provider HTTP sintético; simula efeito remoto seguido de socket encerrado, não apenas falha antes do efeito.
- `tests/chatwoot-onboarding-http.mjs`: GET posterior à falha e à recuperação, bloqueio de GET405 e reconciliação por webhook existente via Next.js real. O caso HTTP405 prepara um checkpoint sintético; a perda real de resposta após criação está coberta no teste PostgreSQL/HTTP do provisionador.
- `tests/authorization-boundaries.test.ts`: mantém pin dos helpers não alterados, subscriptions/normalização de URL e estratégia Rails não utilizada; excetua somente normalizador e helper webhook autorizados nesta correção.
- Manual/relatório anteriores: atualizados para explicar intenção durável, revisão e status. Resultados anteriores continuam identificados como históricos.
- [Evidência consolidada](evidence/CHATWOOT_ONBOARDING_THREE_FIXES_2026-10-26.json): resultados, cenários HTTP, hashes do código/testes e revisão.

## Comandos e resultados

Node 22.21.1; somente banco `mds_crm_dev` em 127.0.0.1:5432, container PostgreSQL de teste criado para esta execução. Schema preparado com Prisma db push --skip-generate **somente nesse banco descartável**. Nenhuma migration aplicada em ambiente real. HTTP/build executados em cópia isolada, sem arquivos .env reais; configuração sintética fornecida por allowlist. Não registrar valores de ambiente.

| Comando / verificação | Resultado |
|---|---|
| `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern='P1 owner\|P1 webhook\|P2 ready' tests/chatwoot-onboarding-postgres.test.mjs` antes | 3 falhas reproduzidas; base c4d0db7 |
| `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.mjs` depois | **654/654**, zero falhas/skips/TODOs; inclui 26 de onboarding |
| `CI=true BLOCK2_CI_DISPOSABLE=true node --import tsx tests/chatwoot-onboarding-http.mjs` | **13 cenários HTTP aprovados** |
| `CI=true BLOCK2_CI_DISPOSABLE=true node scripts/block2-domain-ci.mjs` | **52 cenários + restart real aprovados**; domínio V1.1 persistente preservado |
| `CI=true BLOCK2_CI_DISPOSABLE=true node scripts/block2-c6-ci.mjs http` | **10 probes HTTP C0–C5 aprovados**, incluindo auth/tenant/comercial, branding, tarefas/OS, comentários, anexos e domínio |
| `npm run build -- --webpack` | Exit 0; compilação Next.js aprovada |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |
| `node node_modules/prisma/build/index.js validate` | Exit 0 |
| ESLint dos seis arquivos de código/testes alterados | Exit 0; zero erros/avisos |
| `git diff --check` | Aprovado |
| Comparação do delta com quatro valores expostos conhecidos + padrões fortes de segredos | Zero correspondências; nenhum arquivo sensível alterado. Heurística não equivale a garantia universal. |

Logs locais: `/workspace/mds-crm-onboarding-evidence/chatwoot-three-fixes-2026-10-26/` (`before.log`, `full-tests.log`, `onboarding-http.log`, `domain-http.log`, `c0-c5-http.log`, `build.log`, `typecheck.log`, `lint.log`, `prisma-validate.log`, `secrets-delta.json`). Esses caminhos são evidência local, não links públicos de download. Evidência sanitizada resumida foi versionada no JSON acima.

## Revisão independente

Agente `/root/review_three_chatwoot_fixes`, somente leitura, distinto do implementador. Parecer final: **APROVADO COM RESSALVAS para publicação e CI**, após conferir também os registros completos (654 testes, 13 HTTP onboarding, 52 domínio/restart, 10 C0–C5 e build). Executou independentemente 16/16 testes de fronteiras de autorização e diff check. Distinguir sua execução própria dos resultados completos executados pelo implementador.

Encontrou na primeira versão dos ajustes dois casos que foram corrigidos e receberam teste PostgreSQL: reclassificação indevida de erro operacional preexistente e perda de intenção legada após recuperação de membership. Não restou bloqueador concreto identificado nos três pontos revisados.

## Riscos residuais e aptidão

- Platform API exercitada com servidor sintético; versão/permissões/comportamento da instância real continuam sujeitos a homologação autorizada. Nenhuma conta, inbox, usuário, webhook ou conversa real foi provisionada/modificada.
- POST webhook com resultado desconhecido e sem evidência remota suficiente exige revisão administrativa. GET405 não é contornado. Não apagar checkpoint/CA para permitir nova criação. Erro antes de efeito também é conservadoramente bloqueado quando já houve POST, pois o cliente não pode provar a ausência do efeito.
- O GET reflete a última validação conhecida e consistência local, não monitoramento remoto contínuo. Integração local ativa não garante disponibilidade futura do Chatwoot.
- O POST de usuário do próprio Chatwoot pode confirmar usuário/conceder permissão do Platform App antes de responder quando reutiliza email. Isso é comportamento upstream preexistente; este patch não o modifica nem desfaz automaticamente. Identidade estrangeira continua rejeitada pelo CRM.
- Build Next.js aprovado não certifica build Docker completo. Limitação Alpine/proxy anteriormente registrada não foi reaberta; Dockerfile/dependências não foram alterados.
- URLs públicas legadas de anexos na produção, configuração durável de storage e homologação real dos canais permanecem fora desta correção e sujeitos às pendências anteriores.
- Sem schema/migrations/variáveis novas. Sem alteração em domínio, autenticação, providers, core Chatwoot, motor comercial ou webhooks operacionais. `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados.

Apta tecnicamente para **solicitar autorização de publicação/CI** nos limites da revisão. CI remota deste novo commit ainda não executada: push não autorizado nesta missão. PR #15 permanece sem atualização por esta execução; não houve operação remota para alterar seu estado Draft.

G1/G2/G3: regressões locais favoráveis, sem aceite formal; G4: domínio/Instagram regressivos preservados, sem homologação real nova; G5: contratos/modos preservados, enforcement não ativado; G6: validações locais concluídas, publicação/CI remota e homologação operacional pendentes. **Nenhum gate, Bloco 02 ou piloto aprovado automaticamente.**
