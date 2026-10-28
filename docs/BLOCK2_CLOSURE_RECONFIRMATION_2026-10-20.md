# A — Bloco 02: reconfirmação local para encerramento

**Atualização da revisão crítica:** G1/G2 têm agora bloqueador funcional P1 no Dashboard (identidade removida e Leads sem permissão ainda expostos). Os PASS abaixo continuam evidência dos casos executados, sem cobrir essa nova reprodução. Consulte [revisão crítica](BLOCK2_EVIDENCE_CRITICAL_REVIEW_2026-10-20.md) e [C0 do plano para aprovação](COMMERCIAL_MINIMUM_EXECUTION_PLAN_2026-10-20.md). Nenhuma correção de aplicação foi executada.


**Data:**20/10/2026, America/Sao_Paulo. **Estado: NÃO HOMOLOGADO; nenhum gate aprovado formalmente.**

Candidato efetivamente testado: `audit/block2-sanitized`, HEAD **18507ac7f0f98449e8d1768d5c631c58e8f25cb3**, árvore inicialmente limpa. O commit que inclui este relatório altera somente documentos/evidências. Nenhuma reconstrução, alteração comercial ou correção de aplicação foi necessária nesta execução.

## Preservação e documentos novos

Os nove commits originais e o incremento de preparação posterior continuam preservados em `audit/block2-closure` **59da966**, com os dez correspondentes saneados e as correções posteriores alcançáveis na candidata. Mapa: `docs/evidence/BLOCK2_SANITIZED_LINEAGE_2026-10-20.json`. Foram reconfirmadas as proteções por testes e comparação Git: iframe Atendimento, credenciais Chatwoot, webhook, orchestration, providers, helper Chatwoot, autorização, entitlements, checkPermission, Prisma, manifest e lock sem mudanças desde18507ac. Os dois SHAs de baseline saneados continuam disponíveis.

A base remota avançou de cb1884e para **12e0e6735c4023ff4d2d947920703d30b3e252f0**. Mudanças explicitamente documentadas pelo pedido: c4cd327852eabeb96a628c9e69c815bf9bcbd674 adiciona somente a decisão-mestre (pai cb1884e);12e0e67 adiciona somente a auditoria remota (pai c4cd327). Ambos os documentos foram lidos e copiados byte a byte pela API de conteúdo. **Não houve fetch dos commits, merge, rebase ou incorporação dos ancestrais inseguros.** Origem e comparação dos12 arquivos da frente comercial estão no [registro de evidências](evidence/BLOCK2_COMMERCIAL_AUDIT_2026-10-20.json).

Documentação consultada: arquitetura, core protegido, metodologia, isolamento de providers, status canônico, README operacional, mapa de dependências/checklist; ADR-001, relatório do Bloco1, piloto modular, matriz de acesso e relatórios de autorização/Widget/G4/rollback. Os canônicos de maio são contexto histórico; exemplos antigos de push/deploy não autorizam essas ações nesta missão.

A candidata continua sem os caminhos `.env.backup`, `build.log` e backup de leads em seus ancestrais. Não foram acessadas credenciais reais ou reabertos valores antigos de backup. `.env.local` técnico e PostgreSQL descartável foram usados para testes, sem credenciais de produção. O histórico público antigo não foi saneado por esta tarefa; não se afirmou revogação global dos valores de teste.

## Execução e resultados atuais

Evidências completas: `/workspace/mds-crm-onboarding-evidence/commercial-audit/`. A execução inicial da suite TypeScript não chegou ao runner devido à corrida na criação do diretório de logs; após criar o diretório, a suite completa foi executada e passou. Não foi tratada como teste aprovado uma execução que não rodou. As demais contagens abaixo são conclusivas.

| Comando/check | Resultado |
| --- | --- |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, DB local explícito | **102 PASS**, zero falha/skip/TODO; node-tests.tap |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, zero falha/skip/TODO; tsx-tests.log |
| Widget real handler/PostgreSQL, parte dos102 | **17 PASS**, incluindo CAS perdido, timeout sem ID, concorrência do criador/perdedor, existente/404, tenant e soft delete |
| Instagram real handler/PostgreSQL, parte dos102 | **9 PASS**: nonce único/concorrente, callback, assinatura, replay, tenant e resultado incerto |
| Autenticação e recuperação, parte dos102 | Admin/login/sessão/JWT, signup concorrente, reset/convites e associação/papel atual positivos; provider/e-mail simulados |
| `npm run build` | PASS Next16.3.8; build.log |
| `npx tsc --noEmit` após build | PASS; typecheck.log; next-env.d.ts gerado restaurado |
| Prisma validate e schema diff local `--exit-code` | PASS/diff vazio; nenhuma migration executada |
| Reinício do build via `npx next start` sem prestart; smoke real autenticado | **22 PASS**; login sem500, IDOR/tenant/assignee/permissão, sessão removida, rate limit, agenda com1 criação para8 pedidos; http-smoke-results.json |
| Lint global | Retorno1: **182 erros/77 avisos**; diagnósticos idênticos aos da execução anterior, sem regra/fonte alterada; lint-comparison.json |
| Auditoria npm | Retorno1: **46 pacotes**,0 críticos/40 altos/3 moderados/3 baixos; npm-audit.json. O snapshot17 é histórico |
| Revisão G2 por método repetida |116 arquivos,177 métodos,50 páginas/layouts,zero sem classificação; inventário/revisão estática não equivale a provar todos os ramos |
| Matriz comercial adicional, isolada e sem implementação |14 cenários do resolver e126 decisões puras de autorização; sondagem SSR real evidencia lacunas, detalhadas no relatório B |
| CI GitHub da candidata | Consulta real retornou **zero runs**; nenhuma execução disparada, nenhum SHA novo enviado |

O controle de whitespace do Git sinaliza5 linhas com os dois espaços de quebra Markdown já presentes nos documentos remotos; foram preservados para cópia byte a byte. Nenhuma regra de lint/segurança foi desativada; esse check de whitespace não foi descrito como PASS.

Não repetir a conclusão equivocada de que102+171 aprovam a frente comercial: os testes de segurança, fundamentos comerciais e observação não provam aplicação de contrato em UI/URLs/APIs. A matriz adicional confirma justamente a incompletude de navegação/branding. Node local24; workflows configurados para22 ainda não executados no SHA candidato.

## G1–G6: estado real

| Gate | Evidência positiva atual | Condição restante para aprovação |
| --- | --- | --- |
| G1 — autenticação | Suites de admin, sessões, reset, signup/convites/concorrência e login HTTP real repetidos | Revisão independente e homologação completa de browser/e-mail; logout não certificado como revogação de JWT copiado |
| G2 — autorização | Guards/papel corrente, recursos pessoais, matrizes multi-tenant e contratos dos177 métodos reconfirmados | Revisão independente de ramos/ações indiretas e exceções; dashboard/branding/compartilhados e cobertura comercial continuam incompletos |
| G3 — isolamento/providers | Testes com DB/mocks positivos;17 casos funcionais Widget preservam reconciliação durável | Providers reais isolados, legado de vínculos e procedimento de resultado remoto sem ID precisam aceite; não tocar números reais |
| G4 — Instagram | Nove casos PostgreSQL positivos para uso único, assinatura e replay/idempotência | Meta real, retenção/limpeza e operação de pending/remote_unknown ainda sem homologação independente |
| G5 — entitlements | Catálogo/resolver reutilizáveis,14 combinações de fundamento e126 decisões puras; política intacta | Contrato de compartilhados/legado e aceitação da matriz completa UI/API pendentes. **observe_only, APPROVED_ENFORCEMENTS vazio** |
| G6 — homologação/revisão | Build/typecheck/testes/smoke, linhagem e evidências locais positivos | Lint/dependências, CI do SHA enviado, reviewer distinto, providers reais e autorização explícita de promoção/rollback |

**Todos os gates permanecem sem aprovação formal.** O Bloco02 está tecnicamente preparado para revisão independente, não encerrado por autodeclaração.

## Riscos e próximo passo

Permanecem182 erros/77 avisos anteriores (44 diagnósticos em fronteiras sensíveis, não44 falhas comprovadas),46 pacotes sinalizados e aviso images.domains legado. A classificação existente por origem/regra/pacote foi preservada; não se executou audit fix, upgrade global ou refatoração. A situação de credenciais de teste e a limpeza pública são frentes separadas; confirmação do responsável não equivale a revogação nem aprovação dos gates.

Não foi modificado nenhum fluxo operacional nem o core nesta execução; rollback deste incremento de documentos é somente reversão do commit documental. O rollback de aplicação continua sujeito a suspender fluxos afetados, preservar IDs/recibos duráveis e não reabrir ranges vulneráveis ou guards antigos sem restrição/revisão. Não apagar pending/remote_unknown para liberar POST.

Próxima ação objetiva: responsável independente revisar este relatório e o [diferencial comercial](COMMERCIAL_DIFFERENTIAL_LOCAL_AUDIT_2026-10-20.md), definir aceite/exceções e destino/base saneada compatível para eventual CI/PR. A branch pública ainda possui ancestrais antigos: **não fazer PR/merge automático contra ela, force-push ou envio de refs antigas**. A definição de destino e envio dependem de autorização futura; esta tarefa não pede deploy nem acesso à produção. Após essa revisão, aprovar separadamente o lote mínimo de adaptação descrito em B, sem antecipar Blocos3–5.
