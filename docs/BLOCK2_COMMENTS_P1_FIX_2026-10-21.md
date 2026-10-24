# Bloco 02 — P1 de comentários: correção local

Candidata `audit/block2-sanitized`, referência inicial confirmada `f4866f538f211cf253a1a8e08b800b4ef5fdf4a7`, árvore inicialmente limpa. PR #15 permanece sem atualização nesta execução. O commit desta entrega é identificável com `git log -1 --format=%H -- src/app/api/comments/route.ts`.

## Causa e escopo

O POST de `/api/comments` persistia `parentId` sem conferir organização ou entidade. O GET filtrava os comentários principais pela organização, mas buscava respostas apenas por `parentId`; isso permitia retornar conteúdo e autor de outro tenant. Os identificadores polimórficos não têm FK de entidade/pai no schema atual.

Único arquivo funcional modificado: `src/app/api/comments/route.ts`. Reutilizados `checkPermission`, as permissões existentes (`task/kanban_card → tasks`, `lead → leads`, `goal → projects`), validações e Prisma. Sem mudanças em schema, migrations, core dos módulos, providers, branding ou motor comercial.

- GET valida tipo/UUID e existência da entidade na organização. Raízes e respostas exigem a mesma organização, tipo, entidade e autor da organização, antes da serialização. Relações históricas inválidas são omitidas, sem reescrita de dados.
- POST valida a entidade e exige pai com a mesma organização, tipo, entidade e autor local. Referências inválidas retornam erro genérico sem identificar o recurso estrangeiro.
- Transação PostgreSQL com snapshot `RepeatableRead`; locks `FOR SHARE` no ator ativo/organização, entidade e pai/autor impedem troca de tenant ou exclusão enquanto a escrita é validada e confirmada. No Kanban, a propriedade é resolvida por card → coluna → board, com locks na cadeia. SQL parametrizado e identificadores de tabelas fechados.
- Pai inválido retorna `400`; entidade ausente/estrangeira, `404`; conflito concorrente conhecido, `409`. Direitos operacionais continuam sob o mecanismo existente. Respostas legítimas, formato e ordenação são preservados.

## Reprodução e aceitação

[Evidência versionada](evidence/BLOCK2_COMMENTS_P1_RESULTS_2026-10-21.json) contém respostas observadas resumidas, contagens e impressões dos três arquivos testados. Nenhum token, cookie, senha, URL autenticada ou log de servidor é incluído. Node 22.21.1, NextAuth real, handlers reais, build Next e PostgreSQL descartável em loopback. Fixtures aleatórias são removidas no `finally`.

| Caso HTTP | Antes, HEAD original | Depois, código corrigido |
|---|---|---|
| B cria resposta na própria entidade apontando ao pai de A | `201`, uma gravação estrangeira confirmada no PostgreSQL | `400`, zero gravações |
| A lista comentários após a relação inválida | `200`, conteúdo estrangeiro exposto | `200`, nenhum conteúdo estrangeiro; relação inválida semeada diretamente para testar leitura independentemente da escrita |
| Entidade de outro tenant, owner/admin/user | GET `200` / POST `201` | GET/POST `404`, zero gravações |
| Pai inexistente ou de outra entidade | Aceito em cenários do probe | `400`, zero gravações |
| Raiz/resposta legítima, quatro tipos × três papéis | Preservadas | 12/12 combinações com POST `201` e GET `200` |

O probe antes da correção retornou **exit 1**, 29 falhas em 41 casos: vulnerabilidade confirmada, sem TODO. A versão final acrescenta 12 negações de pai estrangeiro por papel/tipo e reforça a conferência de persistência: **53/53 PASS**, exit 0; zero notificações. Não são 53 cenários executados no baseline antigo.

Seis testes de integração PostgreSQL executam o handler e autorização reais, isolando apenas o transporte da sessão: referências estrangeiras/inexistentes/incompatíveis; pai com autor estrangeiro; leitura de raízes/respostas históricas malformadas; concorrência de respostas legítimas; usuário/organização removidos; permissão operacional negada; falha injetada após INSERT com rollback comprovado por consulta independente; tentativa concorrente de trocar tenant de pai e entidade bloqueada por lock PostgreSQL. Nenhuma notificação ou atividade criada nos casos indevidos. A falha injetada modifica somente o adaptador de teste, não o handler.

## Comandos e resultados

Variáveis locais carregadas sem impressão; `DATABASE_URL` e `BLOCK2_TEST_DATABASE_URL` apontam exclusivamente ao PostgreSQL descartável autorizado. O helper recusa outros hosts/bancos. Não foi usado `npm start`, cujo prestart aplica migrations.

| Comando | Resultado |
|---|---|
| `npm run build` no HEAD original | PASS após permitir subprocessos locais; primeira tentativa no sandbox falhou ao ler `tsc --showConfig` |
| Probe `node tests/comments-tenant-http.mjs` servido pelo build original em `127.0.0.1:3100` | FAIL esperado, exposição reproduzida |
| `node scripts/block2-c6-ci.mjs node` | 129/129, zero falhas/TODO/SKIP |
| `node --import tsx --test tests/comments-tenant-postgres.test.mjs` após reforçar asserções | 6/6 |
| `node --import tsx --test tests/*.test.ts` | 383/383 no código final |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `npm run build` no código final | PASS; `next-env.d.ts` gerado restaurado ao conteúdo rastreado |
| Probe HTTP final, servidor `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100` | 53/53 PASS |
| `node scripts/block2-c6-ci.mjs http` | 6/6 probes PASS: C0 Dashboard; C1/C2 comercial; C3/C4 branding; C5 cross-tenant, acesso direto e regressão Tarefas/OS |
| `node node_modules/eslint/bin/eslint.js --max-warnings 0 src/app/api/comments/route.ts tests/comments-tenant-http.mjs tests/comments-tenant-postgres.test.mjs` | Zero erros e avisos; sem alterar regras |
| `git diff --check` | PASS |

O probe C5 cross-tenant preserva 42 checks positivos e zero notificações indevidas; regressão Tarefas/OS, 14 casos; acesso direto, 84 cenários e `securityAcceptancePassed=true`; branding, 84; apresentação comercial, 42. Não interpretar os PASS observacionais como bloqueio comercial ativado.

Os logs completos permanecem localmente em `/workspace/mds-crm-onboarding-evidence/comments-p1/`, fora do Git. O runner temporário apenas inicia/encerra o servidor com segredos sintéticos em memória e captura JSON do probe versionado. As impressões na evidência identificam os arquivos efetivamente testados com árvore modificada; o HEAD registrado pelos runners antes do commit continua sendo a referência inicial, sem atribuir testes a um SHA inexistente.

## Matriz G2/G3 e limites

| Gate | Nova evidência | Estado |
|---|---|---|
| G2 | GET/POST de comentários respeitam permissões existentes; pai e entidade validados antes da escrita; negativos HTTP e PostgreSQL, rollback e regressões | P1 identificado em `route.ts` corrigido e validado localmente; gate **não aprovado** |
| G3 | Organização em raízes, respostas, autores, entidade e pai; casos históricos inválidos, ausência de efeitos indevidos e locks reais | Recorte de comentários validado; gate **não aprovado** para toda a superfície/providers |
| G1/G4 | Suítes existentes repetidas, sem modificação funcional nesses domínios | Sem nova aprovação |
| G5 | Arquivos comerciais intactos; `observe_only` e `APPROVED_ENFORCEMENTS` vazio preservados | Sem ativação ou aprovação de rollout |
| G6 | Evidência local e commit preparado para revisão | CI remota do novo commit e revisão independente ainda pendentes |

Riscos residuais: sem constraint polimórfica no banco, outros escritores ainda precisam manter a integridade; este lote não repara dados legados. Locks/snapshot foram testados funcionalmente, sem ensaio de carga de produção. A profundidade de respostas permanece a da implementação anterior. O probe PostgreSQL novo é descoberto automaticamente pelo runner Node existente; o probe HTTP novo foi executado localmente e ainda não foi incluído na lista fixa de seis probes da CI. Não houve mudança de workflow.

**Achado adicional de inspeção, fora da correção autorizada:** `src/app/api/comments/[id]/route.ts` faz lookup por ID sem organização e permite DELETE por owner/admin após essa busca; requer reprodução HTTP/PostgreSQL e correção em autorização própria. Não foi reproduzido nem alterado neste lote e não deve ser considerado seguro por analogia com GET/POST. Mantém pendência de G2/G3 e de homologação. Os bloqueios comerciais C5-03/C5-04 e os demais riscos documentados anteriormente permanecem.

Sem push, merge, deploy, migrations, alterações no Coolify ou dados de produção. Não liberar o piloto com base neste resultado. Para atualizar a PR Draft #15 é necessária nova autorização; depois, reexecutar CI no SHA enviado e solicitar revalidação independente do achado.

Rollback proposto: revert isolado deste commit em uma branch de revisão, sem executar agora e sem schema/transformação de dados a desfazer. O revert reintroduz o P1 e não constitui opção segura de publicação; nesse caso, manter candidata/piloto bloqueados até outra correção validada.
