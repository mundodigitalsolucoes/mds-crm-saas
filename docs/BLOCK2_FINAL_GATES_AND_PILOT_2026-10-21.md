# Bloco 02 — fechamento técnico e condições do piloto

**Resultado: candidata corrigida localmente; contrato do piloto NÃO HOMOLOGADO.** Branch `audit/block2-sanitized`, referência inicial confirmada `17b11d901a30b78be8d84d1ba18ee1d22df175e7`, árvore inicialmente limpa. PR existente #15 preservada; nenhum push ou alteração remota nesta rodada. Os quatro workflows aprovados do SHA17b11d9 **não certificam o novo commit local**.

## Missão1 — dois P2 reproduzidos e corrigidos

A reprodução histórica com handlers/autorização reais, PostgreSQL descartável e barreiras determinísticas voltou a confirmar:

| Caso | Antes | Depois |
|---|---|---|
| Transferir associação A→B após autorização GET, antes da transação | `200`, comentário de outro autor de A retornado à associação agora em B | `403`, sem dados anteriores e antes de consulta sensível de comentários |
| Revogar `tasks.edit` após autorização POST, antes da transação | `201`, uma resposta persistida | `403`, zero gravações |

Único arquivo funcional alterado: `src/app/api/comments/route.ts`. A checagem inicial por `checkPermission` continua existente. Dentro da transação, antes de consultar comentários ou gravar, o handler bloqueia por `FOR SHARE` o usuário e a organização ativos, exige associação à organização autenticada e reavalia **papel/permissões atuais do registro bloqueado**, usando o motor existente `parsePermissions`/`hasPermission` e o mesmo bypass operacional de owner. Não há novo mecanismo de autenticação, permissão artificial ou motor comercial.

A revalidação não depende de uma segunda conexão Prisma dentro da transação: o registro bloqueado fornece as permissões ao motor central, preservando pools pequenos. Teste de integração com `connection_limit=1` comprova GET200/POST201 legítimos. DELETE, PUT e helpers centrais não foram alterados nesta rodada. O mapeamento seletivo40001/40P01→409 e as correções de pai/entidade/autor/cascade permanecem.

**Semântica de concorrência comprovada:** mudanças confirmadas antes da aquisição do lock são respeitadas; mudanças posteriores precisam aguardar a operação já autorizada terminar. Não se promete cancelar respostas de rede já em trânsito. Cinco novos testes de aceitação PostgreSQL cobrem os dois interleavings originais, oito combinações GET/POST×permissão/usuário/organização/transferência confirmadas antes da transação, zero consultas sensíveis nos negados, locks contra revogação/transferência/exclusão durante leitura/escrita, próxima requisição negada após revogação confirmada e pool unitário. Snapshot/locks/integridade não foram enfraquecidos.

As reproduções antigas em `docs/evidence/BLOCK2_COMMENTS_REVOCATION_PROBES_2026-10-21.mjs` são evidência histórica que afirma o comportamento vulnerável; foram executadas **antes** da correção, não somadas a PASS de segurança e não reescritas para apagar o achado. A aceitação corrigida está em `tests/comments-revocation-postgres.test.mjs`. Esta reprodução é por handlers/PostgreSQL, sem alegar interleaving determinístico por HTTP; os115 casos HTTP existentes foram repetidos no build corrigido.

## Missão2 — duas organizações fictícias e resultado comercial

Fixtures independentes, nenhuma conta real da Ótica ou MDS acessada:

- MDS fictícia: `atendimento`, `vendas`, `marketing`; marca MDS padrão, permissões e operação preservadas.
- Piloto fictício: `atendimento`, `vendas`, `white_label`; logo/cores/favicon próprios, sem Marketing contratado. Capacidade White-Label separada dos módulos; nenhuma habilitação por cliente.
- Owner/admin e usuário comum com view permitido; usuário comum sem edit e, numa etapa negativa, sem leads.view. Credenciais sintéticas aleatórias, sem valores em logs/relatórios. Fixtures removidas no finally.

| Superfície | MDS fictícia | Piloto fictício | Resultado |
|---|---|---|---|
| Sidebar real renderizada com contexto autenticado/PG, seções abertas no teste | Três módulos | Atendimento/Vendas; Marketing ausente | PASS de componente, não ensaio de browser/hidratação |
| Dashboard e seus indicadores | Leads e Projetos autorizados | Leads presentes; Projetos/Marketing ausentes | PASS HTTP |
| Leads, Kanban, Atendimento e APIs listadas | Disponíveis com view | Disponíveis com view | PASS HTTP nos três papéis |
| Usuário sem leads.view | API403, Dashboard sem Leads | API403, Dashboard sem Leads | PASS HTTP |
| Usuário sem edit / escrita com ID de outro tenant | Negados sem alterar raízes | Negados sem alterar raízes | PASS; zero dados cruzados nos casos exercitados |
| White-Label | Branding MDS padrão | Logo/cores/favicon por organização | PASS de HTML/componente e asset piloto200 |
| URL direta de Marketing | `200` legítimo | **200 indevido para o contrato** | **FAIL comercial** |
| API de projetos de Marketing | `200` legítimo | **200 com dados locais de projeto**, mesmo owner sem módulo | **FAIL comercial**, não IDOR cross-tenant |

`tests/pilot-contract-http.mjs` executou **6 cenários (2 organizações×3 papéis)**, sete superfícies Marketing por papel. Foram **21 expectativas comerciais reprovadas**, não21 vulnerabilidades distintas. URLs: `/projects`, `/tasks`, `/os`, `/reports`, `/api/projects`, `/api/tasks`, `/api/os`. Páginas200 provam shell acessível; a exposição de dados comerciais foi comprovada em `/api/projects`, nos três papéis. Não confundir shell200 com dado sensível, nem dado local não contratado com dado de outro tenant.

O probe retornou **exit1**, `pilotContractPassed=false`, `operationalBaselinePassed=true`. APIs/GETs/negativas verificam ausência de IDs/marcadores estrangeiros; snapshots de Lead/Projeto/Tarefa comprovam nenhuma alteração desses recursos. Etapa Kanban foi semeada previamente para evitar inicialização por GET. Mudanças de permissões pertencem somente às fixtures e são intencionais. A proposta não usa permissões avulsas como substituto de contrato.

**Pendência visual preexistente, separada:** a marca MDS referencia `/favicon.ico`, ausente no checkout/build e retornando404. O favicon próprio da fixture piloto usa `/images/favicon.png` existente e retorna200; logo/cores/links são corretos. A primeira fixture havia escolhido o mesmo asset ausente e foi corrigida para asset existente; não se alterou branding da aplicação nem se ocultou o404 padrão. Essa pendência não é a causa das21 falhas comerciais.

### Enforcement isolado, sem ativação

`tests/pilot-contract-postgres.test.mjs` validou contexto/Sidebar e motor/guards reais com PostgreSQL. Simulou via **dependência de teste**, somente para a fixture piloto, o efeito `enforce`: marketing/projects bloqueado por API403/página notFound; Vendas/Atendimento e MDS preservados. O seletor real continuou observe_only em todas as asserções; manifest vazio e arquivos comerciais intactos.

O teste não ativa enforcement no app e não certifica rotas sem guard. **C5-03/C5-04 permanecem:** cobertura comercial parcial; recursos compartilhados sem política completa; formatos parciais/legados incompatíveis com o futuro motor. Preencher o manifest isoladamente não cumpriria o contrato. [Proposta concreta de rollout, arquivos, testes, condições e rollback](BLOCK2_PILOT_ROLLOUT_PROPOSAL_2026-10-21.md). Nenhuma implementação comercial foi feita nesta rodada.

## Missão3 — matriz final G1–G6 desta candidata local

“Satisfeito localmente” abaixo significa o critério automatizado citado, não fechamento de todo o gate, aceite independente ou autorização de produção. **Nenhum gate integral é declarado aprovado por este relatório.** Documentos de referência: `BLOCK2_CLOSURE_EXECUTION_2026-10-19.md` e `BLOCK2_CLOSURE_GATE_2026-10-19.md`; resultados históricos não foram sobrescritos.

| Gate | Critério técnico exercitado | Situação integral / exatamente o que falta |
|---|---|---|
| **G1 — Autenticação** | Regressões de login/admin, sessões/associação ativa, reset/signup/concorrência e C0 novamente PASS | **Recorte técnico automatizado satisfeito**; falta homologação manual dos fluxos completos/admin/e-mail e aceite independente. Não certifica produção. |
| **G2 — Autorização** | P1 anteriores e os dois P2 de comentários agora bloqueados em testes reais; permissões por papel, pai/entidade/autor e zero efeitos indevidos | **Parcial**: falta revisão independente do novo SHA, cobertura total de métodos/rotas indiretas/recursos compartilhados e exceções justificadas; PUT não certificado por analogia. |
| **G3 — Multi-tenancy/providers** | Duas organizações, papéis, URLs/APIs e referências sem cruzamento nos casos testados; suíte Widget PostgreSQL/CAS/reconciliação PASS | **Recorte de isolamento satisfeito**; providers/canais reais em sandbox, operação de resultado remoto incerto e critérios de recuperação ainda pendentes de homologação. |
| **G4 — Instagram** | Nove testes PostgreSQL: consumo único concorrente, binding/expiração, callbacks, assinatura, replay, recibo durável e resultado incerto PASS | **Recorte técnico de persistência/replay satisfeito**; faltam Meta sandbox/retornos reais, retenção/limpeza/recuperação e revisão do histórico/migrations antes de promoção. |
| **G5 — Entitlements** | Navegação/Dashboard/White-Label e contratos em simulação passam; observe_only/manifest vazio preservados | **BLOQUEADO**: piloto com21 expectativas URL/API reprovadas; completar C5-03/C5-04/políticas compartilhadas, testar e obter autorização nominal antes de ativação. |
| **G6 — Homologação final** | Build/typecheck/lint e144 Node/PG+383 TypeScript+115 HTTP comentários+C0–C5 PASS; plano de rollout/rollback preparado | **BLOQUEADO**: novo commit não enviado/sem CI remota por restrição desta etapa; revisão independente/aceite, G5, riscos de dependências e validação operacional/rollback pendentes. |

Os quatro workflows remotos passaram no **17b11d9 anterior**, conforme evidência de consolidação; não foram disparados nem atribuídos ao novo código local. Revisão independente anterior descobriu os P2; as correções desta rodada ainda precisam de nova revisão distinta. Os18 pacotes sinalizados no relatório C6 (0 críticos/15 altos/2 moderados/1 baixo) são fotografia anterior do lockfile, que não mudou; não houve novo npm audit ou triagem de providers nesta rodada e não se declara essa dívida resolvida.

## Execução final e evidências

[Evidência versionada](evidence/BLOCK2_FINAL_GATES_PILOT_RESULTS_2026-10-21.json): status antes/depois, dados resumidos da matriz comercial, resultados e impressões dos quatro arquivos de código/teste efetivamente executados. Nenhum segredo ou hash de credencial. Logs completos ficam fora do Git em `/workspace/mds-crm-onboarding-evidence/final-pilot/`.

| Comando | Resultado |
|---|---|
| `node --import tsx --test docs/evidence/BLOCK2_COMMENTS_REVOCATION_PROBES_2026-10-21.mjs` no HEAD anterior | Duas reproduções confirmadas (não segurança aprovada) |
| `node scripts/block2-c6-ci.mjs node` | **144/144**, zero FAIL/SKIP/TODO |
| `node --import tsx --test tests/*.test.ts` | **383/383** |
| `node tests/comments-delete-http.mjs` / `node tests/comments-tenant-http.mjs` em servidor local | **62/62 +53/53** |
| `node tests/pilot-contract-http.mjs` | **FAIL contrato**, exit1; operação/isolamento exercitados PASS |
| `node scripts/block2-c6-ci.mjs http` | Seis probes C0–C5 PASS, inclusive84 cenários de acesso direto e84 de branding |
| `npm run build` / `node node_modules/typescript/bin/tsc --noEmit` | PASS; gerado next-env restaurado |
| ESLint `--max-warnings 0` no handler e três testes novos | Zero erros/avisos; sem relaxar regras |
| `git diff --check`; diff em política, entitlements, schema, lockfile e workflows | PASS; nenhum desses arquivos alterado |

O runner local inicia `next start` diretamente em loopback com segredos sintéticos em memória; nunca `npm start` (prestart aplica migrations). O processo coordenador registra o exit1 comercial separadamente dos PASS de regressão; não foi convertido em homologação positiva. Sem migration ou consulta a produção.

## Próximas condições para o piloto

1. Revisão independente das correções P2 e autorização separada para atualizar a **mesma PR15**, seguida de quatro CIs no novo SHA.
2. Decidir e autorizar o lote mínimo C5-03/C5-04 de cobertura/compatibilidade compartilhada; implementar e provar bloqueio Marketing em todos os métodos/efeitos, sem quebrar Vendas/Atendimento/MDS.
3. Só após cobertura/revisão suficiente, solicitar autorização específica de enforcement para a organização nominal, utilizando o seletor existente e mantendo as demais em observe_only. **Não há ativação segura pronta para execução agora.**
4. Homologar providers e operação dos canais contratados, conferir migrações com o operador, imagem/SHA/URL, backup e rollback seguros. Reverter isolamento ou apagar nonces/recibos/inbox IDs não é rollback aceitável.
5. Registrar aceite G1–G6 e autorização própria para piloto/publicação. Este trabalho não faz merge, push, deploy, alteração de PR/Coolify/produção ou ativação comercial.

Commit local desta rodada identificável por `git log -1 --format=%H -- src/app/api/comments/route.ts`; os fingerprints registram a árvore testada sobre17b11d9 e evitam atribuir testes ao SHA anterior. A correção de comentários não altera schema nem requer migration.
