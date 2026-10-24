# Bloco 02 — Consolidação dos comentários na PR Draft #15

Referência local inicial confirmada: `18594d0952f4b70e67813f64476a598c61ac0e3b`, árvore limpa. Destino autorizado exclusivamente `audit/block2-sanitized`; PR existente [#15](https://github.com/mundodigitalsolucoes/mds-crm-saas/pull/15), base `review/block2-sanitized-base` em `8aa1db0b893b042967c3905a3582916b713cf9ab`. Não criar outra PR nem atualizar a base. O commit desta consolidação é identificável por `git log -1 --format=%H -- src/app/api/comments/route.ts`.

## Tratamento pontual do conflito

O conflito real DELETE/POST já documentado retornava `500` por `Prisma P2010`, `meta.code=40001`. O helper de erros de GET/POST agora retorna **409**, com mensagem genérica de conflito, somente para `P2010` com `40001` (serialização) ou `40P01` (deadlock), além dos códigos Prisma já tratados antes. Não há retry, nova escrita, alteração de snapshot, redução de locks ou mudança de autorização.

O teste determinístico usa handlers reais, PostgreSQL descartável e barreiras no adaptador das transações: DELETE vence com `200`; POST concorrente recebe **409**, corpo genérico e **zero respostas órfãs**. Novo teste do handler cobre ambos os métodos e comprova que `23505`, erro sem SQLSTATE e falha inesperada continuam **500**, sem divulgar detalhes ou produzir gravação parcial. O conflito não é convertido em sucesso nem mascara outros erros.

Histórico cumulativo a enviar desde o remoto `f4866f5`: `594606d` (GET/POST), `18594d0` (DELETE), esta consolidação. Apenas handlers de comentários, seus testes e documentação/evidência. PUT teve apenas a renomeação de variável exigida pelo lint no commit DELETE; nenhuma nova alteração de PUT neste lote. Core dos módulos, providers, schema, dependências, workflows, White-Label e motor comercial permanecem intactos.

## Validação local

Node22.21.1; somente PostgreSQL descartável em loopback; nenhuma migration. Comandos usam ambiente local sem imprimir valores. Servidor Next iniciado diretamente, sem `npm start`/prestart de migration.

| Verificação | Resultado |
|---|---|
| `node scripts/block2-c6-ci.mjs node` | **138/138**, zero falhas/SKIP/TODO |
| `node --import tsx --test tests/*.test.ts` | **383/383** |
| `node tests/comments-delete-http.mjs` | **62/62** |
| `node tests/comments-tenant-http.mjs` | **53/53** |
| `node scripts/block2-c6-ci.mjs http` | Seis probes C0–C5 PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `npm run build` | PASS; `next-env.d.ts` gerado restaurado |
| ESLint `--max-warnings 0` nos dois handlers e quatro testes de comentários | Zero erros/avisos |
| ESLint na reprodução documental dos riscos residuais | Zero erros/avisos |
| `git diff --check` | PASS |

[Resultados e impressões dos arquivos efetivamente testados](evidence/BLOCK2_COMMENTS_CONSOLIDATION_RESULTS_2026-10-21.json). Os testes foram executados na árvore modificada sobre o HEAD documental; as impressões distinguem essa árvore do SHA anterior. Logs completos e observações remotas ficam fora do Git em `/workspace/mds-crm-onboarding-evidence/comments-consolidation/`.

## Revisão independente GET/POST/DELETE

Revisor: agente **`/root/comments_independent_review`**, separado do implementador, somente leitura. Reexecutou **15/15 testes PostgreSQL** de comentários e inspecionou os três handlers e o mapeamento de erros. Não encontrou P0/P1 novo no pequeno patch de conflito. A conferência final do SHA e o parecer completo serão registrados na PR existente, sem aprovar automaticamente gates.

**Dois riscos concorrentes preexistentes foram reproduzidos e permanecem abertos**, classificados pelo revisor como P2 condicionais à política de revogação imediata e à existência de transferência de associação:

- GET: depois de `checkPermission`, mas antes da aquisição da transação, transferir a associação A→B permite à requisição já autorizada retornar `200` com comentário de outro autor de A. GET não revalida a associação dentro da transação.
- POST: revogar `tasks.edit` depois de `checkPermission`, antes de adquirir a transação, permite `201` e uma resposta persistida, pois o lock posterior revalida associação ativa, mas não a permissão.

[Probes observacionais portáteis](evidence/BLOCK2_COMMENTS_REVOCATION_PROBES_2026-10-21.mjs): `node --import tsx --test docs/evidence/BLOCK2_COMMENTS_REVOCATION_PROBES_2026-10-21.mjs`, com `BLOCK2_TEST_DATABASE_URL` local autorizado. **PASS desses dois probes confirma os riscos, não aprovação de segurança.** Eles usam handlers/autorização/PostgreSQL reais e barreiras no adaptador, sem HTTP; não alegar reprodução HTTP desses riscos. Fixtures são removidas. Não alteramos a semântica de revogação neste lote pontual. PUT, providers e carga também não recebem certificação por analogia.

## Preflight de envio e CI

Revisados os quatro workflows completos da candidata e os quatro da base, seus comandos, ações e scripts invocados. Somente checkout/setup/testes/build/artifacts; sem deploy, publicação, `workflow_run`, `repository_dispatch`, `pull_request_target` ou environment de produção. `main` no SHA remoto conhecido não contém workflows. O cadastro histórico Google OAuth não corresponde a arquivo nas refs relevantes, não sendo workflow executável desta candidata. Nenhum workflow foi alterado.

GitHub retornou `403` ao ler webhooks. Esta limitação permanece explícita; a verificação das configurações externas usa a confirmação anterior do responsável: produção em `main`, previews desativados e nenhum webhook listado. Não apareceu evidência de gatilho de publicação. Se surgir alguma, interromper o envio.

Antes de enviar: repetir scanner dos commits/blobs alcançáveis (quatro valores expostos conhecidos em memória, sem imprimir/copiar hashes de segredos; padrões fortes e caminhos proibidos); verificar ausência de ancestrais sensíveis; confirmar que remoto candidato permanece `f4866f5`, base permanece `8aa1db0`, PR Draft/base corretas e relação de ancestralidade. Usar checkout isolado que contenha somente a candidata saneada e hook que aceite **uma única atualização exata**, do SHA remoto esperado ao SHA final. Push normal com refspec explícita, sem force, tags, all ou mirror. Qualquer divergência bloqueia o envio.

Após o envio autorizado: acompanhar no novo SHA os quatro workflows (Authorization, PostgreSQL Handler/Concurrency, Build, Security), distinguindo execuções push/pull_request e resultado de cada job. Não atribuir success antes da conclusão real. URLs/resultados serão registrados em comentário da PR #15 e relatório externo local; o relatório versionado registra esta etapa como posterior à validação local. Preservar a PR Draft e todas as outras refs. Requisição de revisão independente pelo agente e comentário de revalidação na PR, sem atribuir revisão humana inexistente.

## Matriz G2/G3 e decisão

| Gate | Evidência e pendências |
|---|---|
| G2 | GET/POST/DELETE e erros de conflito validados; revisão independente confirmou patch pontual. Duas janelas P2 de revogação permanecem. **Não aprovado integralmente.** |
| G3 | Parent/entidade/autor/árvore escopados; cascades estrangeiros bloqueados; transações/concorrência/rollback e zero órfãos no conflito. Transferência concorrente no GET e providers/carga não homologados. **Não aprovado integralmente.** |
| G1/G4 | Regressões existentes positivas; sem nova aprovação. |
| G5 | `observe_only`, manifest `APPROVED_ENFORCEMENTS` vazio, lacunas comerciais anteriores preservadas; sem enforcement. |
| G6 | Preparação local/revisão independente registradas; CI real do SHA enviado e aceite final devem ser observados separadamente. |

O 500 transitório documentado no relatório DELETE foi corrigido nesta consolidação, sem apagar a evidência histórica. Bloco02/piloto permanecem sem aprovação. Rollback proposto, não executado: revert isolado do mapeamento de conflitos mantém integridade, mas reintroduz o 500; reverter os commits de isolamento reintroduz P1 e não é opção segura para publicação.

Sem merge, deploy, preview, Coolify, migrations ou alterações em produção. A autorização desta etapa abrange somente atualização da candidata na PR #15 para CI/revisão.
