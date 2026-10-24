# C6 — CI, pacote de revisão e homologação local da candidata saneada

Entrada confirmada: `audit/block2-sanitized`, **80ac574aa361378e5c6adffa09d4792e1a611c0e**, árvore limpa. Preparação de CI: **d0cfe6cd89b4365c632ea5b8272f0e9452e65369**. A revisão documental final é identificável por `git log -1 --format=%H -- docs/BLOCK2_C6_REVIEW_PACKAGE_2026-10-21.md`; o manifesto externo do pacote registra o HEAD final e a integridade de todos os arquivos.

**Resultado:** ensaio local positivo, com instalação limpa e Node 22 numa cópia Git saneada isolada. CI remota e revisão por pessoa distinta **não executadas**; piloto **não liberado**. [Evidências desta rodada](evidence/BLOCK2_C6_RESULTS_2026-10-21.json) e [formulário de revisão independente](BLOCK2_C6_INDEPENDENT_REVIEW_2026-10-21.md). Nenhum gate é aprovado por esta preparação.

## Integridade e escopo

- Base de revisão local preparada: `review/block2-sanitized-base` em **8aa1db0b893b042967c3905a3582916b713cf9ab**. Não é a base pública antiga.
- C0 `192a110`, C1 `7f02b38`, C2 `d626bff`, C3 `39facc0`, C4 `5f0f8a9`, auditoria C5 `5ec8ed1`, correção C5 `a9aa6ed` e evidências `80ac574` permanecem ancestrais, com seus relatórios e testes. Dois baselines históricos saneados continuam alcançáveis para os testes de fronteira.
- Revalidadas **783 correspondências** da sanitização: nenhuma diferença funcional fora dos três caminhos removidos; autores/datas preservados. A auditoria original continua local em `59da966`; não integra os bundles de revisão.
- Todos os blobs alcançáveis foram comparados em memória com os quatro valores antigos de `.env.backup`, sem imprimir valores ou guardar fingerprints de credenciais: **zero correspondências**. Padrões fortes de chaves privadas/tokens também sem achados; nenhum `.env` real, backup ou build.log alcançável na candidata. `.env.example` permanece template. Isto é detecção delimitada, não garantia universal nem confirmação de revogação em providers.
- A varredura final do pacote abrange também o commit documental. O manifesto externo registra seu SHA e contagem final de blobs, evitando referência circular dentro do próprio commit.
- C6 altera somente quatro workflows, `scripts/block2-c6-ci.mjs`, `tests/c6-ci-safety.test.mjs` e documentação/evidências. **Aplicação, core protegido, providers, schema/migrations, lockfile, permissões e motor comercial permanecem idênticos a 80ac574.** `observe_only` e `APPROVED_ENFORCEMENTS = []` intactos.

## Workflows preparados

Todos mantêm `contents: read`, sem secrets de produção, `pull_request_target`, publicação ou deploy. Aceitam PRs contra `review/block2-sanitized-base`, além do filtro anterior; pushes da candidata também são considerados. Checkout usa o SHA real do candidato, não o merge-ref sintético da PR; não segue tags nem persiste credenciais.

| Workflow | Preparação C6 | Evidência e limite |
|---|---|---|
| `block2-authorization-tests.yml` | Toda a suíte TypeScript C0–C5, lint do conjunto alterado e guard do histórico saneado | 383 testes locais PASS; nenhum run GitHub novo |
| `block2-postgres-concurrency.yml` | PostgreSQL 16 efêmero; geração Prisma; schema exclusivamente descartável; toda suíte Node/PostgreSQL; build e seis probes HTTP C0–C5 | 123 testes Node e seis scripts HTTP PASS no ensaio local Node 22; serviço GitHub ainda não iniciado |
| `security-c03-c04.yml` | Mantém testes de segurança e SQL advisory lock em PostgreSQL descartável; ajusta base/candidata e checkout | Testes correspondentes incluídos na suíte positiva; sem run remoto novo |
| `security-c03-c04-build.yml` | Prisma, `next typegen`, typecheck e build, sem servidor/deploy/migrations | Comandos ensaiados com Node 22; sem run remoto novo |

Os dois jobs que precisam de baselines usam **profundidade positiva 1000000 somente para a ref/SHA solicitado**, em vez de `fetch-depth: 0`, que poderia buscar outras refs antigas. O guard exige os baselines/raiz conhecidos e falha se a história estiver incompleta ou contiver ancestrais inseguros. O checkout administra temporariamente a autenticação de leitura, inclusive para repositório privado; não há fetch posterior dependente de credencial persistida. O pacote final inclui prova de clone seletivo com esta profundidade, baselines presentes e objetos antigos ausentes.

Validação local dos quatro YAMLs e de **25 passos shell**: sintaxe e controles acima conferidos. Não equivale à validação do serviço GitHub Actions nem ao estado de suas políticas/proteções. Branch protection, habilitação de Actions, permissões do reviewer e integrações externas/Coolify não foram alteradas nem certificados.

O runner C6 recusa banco remoto, nome/porta diferentes e divergência entre DATABASE_URL e BLOCK2_TEST_DATABASE_URL. `prepare` exige simultaneamente `CI=true` e `BLOCK2_CI_DISPOSABLE=true`; nunca executa migrations. HTTP gera segredos de teste apenas em memória, inicia somente `127.0.0.1:3100`, recusa servidor preexistente e encerra o processo ao final. Publicação automática de artefatos é restrita aos JSONs de fixtures; logs privados do servidor não são enviados.

## Resultados reais

Instalação limpa: `npm ci --ignore-scripts`, em clone isolado importado de bundle contendo somente candidata/base saneadas, sem alternates ou hardlinks. Node oficial **v22.21.1**, checksum conferido; o GitHub continuará selecionando o patch corrente de Node 22. A instalação original Node 24 não foi usada como substituto deste ensaio.

| Comando/verificação | Resultado |
|---|---|
| `npm ci --ignore-scripts` | PASS, lockfile preservado; sem lifecycle scripts |
| `npx prisma validate` e `npx prisma generate` | PASS |
| `node scripts/block2-c6-ci.mjs node` | **123 PASS**, zero fail/skip/TODO, incluindo PostgreSQL, Widget, Instagram, C5 e quatro controles de segurança de C6 |
| `npx tsx --test tests/*.test.ts` | **383 PASS**, zero fail/skip/TODO |
| `npx next build`, `npx next typegen`, `npx tsc --noEmit` | PASS; aviso preexistente images.domains |
| `node scripts/block2-c6-ci.mjs http` | **Seis scripts PASS**, exit 0: Dashboard C0, comercial C1/C2, White-Label C3/C4, os dois probes originais C5 e CRUD/negativos C5 |
| Dashboard/contratos/branding | C0 removidos 307 sem dados; C1/C2 **42 cenários**; C3/C4 **84 cenários**, 29 alterações comerciais auditadas; C5 **84 cenários**, 924 GETs de páginas/840 leituras API |
| C5 P0/P1 | **42/42 expectativas cross-tenant PASS**, zero notificações estrangeiras, zero vazamentos de Leads; **14 casos HTTP positivos/negativos novos PASS** |
| Lint do conjunto C0–C6 | **37 arquivos, zero erros, oito avisos já presentes em 80ac574**; dois arquivos novos C6 com zero erros/avisos |
| Conferência Prisma/CI descartável | Diff de schema vazio; comando `prepare` ensaiado e retornou banco já sincronizado, sem alteração de schema; nenhuma migration aplicada |
| Limpeza de fixtures READ ONLY | Zero organizações/admins de fixtures e atividades órfãs dos marcadores verificados |
| `npm audit --json` | **Exit 1**: 18 pacotes afetados, **0 críticos/15 altos/2 moderados/1 baixo**; não foi transformado em PASS |

A suíte completa/HTTP executou o código em **db9f67a**. Os incrementos seguintes alteraram somente YAMLs; a igualdade de `src`, `scripts`, `tests`, schema e lockfile foi conferida. `next typegen`/typecheck e validação final de workflows foram executados separadamente. O commit documental não altera código testado. Os rótulos referenceHead antigos dos probes são históricos; o manifesto registra o SHA efetivo.

O primeiro tsx foi bloqueado pelo socket IPC do sandbox; a repetição autorizada passou integralmente. Não houve teste dispensado. O checkout descartável foi avançado uma vez com `git merge --ff-only` entre dois commits locais de C6: não gerou commit de merge nem uniu histórico público, mas o comando não deveria ter sido usado sob a restrição literal. As atualizações seguintes usaram checkout destacado; a branch candidata e refs antigas não receberam merge/rebase.

## Lint e dependências: riscos existentes

Os oito avisos são três `no-img-element` em branding/Sidebar e cinco variáveis existentes não usadas na API administrativa. Os arquivos operacionais não mudaram em C6; os avisos já existiam no HEAD de entrada. Não se relaxou regra de segurança. A primeira configuração C6 exigia zero avisos de todo o conjunto e falhou; foi ajustada para exigir zero **erros** do conjunto e zero erros/avisos da infraestrutura nova, preservando a severidade e visibilidade dos avisos existentes.

A auditoria atual do npm substitui contagens antigas apenas como fotografia deste lockfile: **18 pacotes afetados não significam 18 regressões C6**. Package.json/lockfile não mudaram. Versões, severidades e existência de correção constam do manifesto; não houve atualização automática. Axios e sua cadeia `follow-redirects`/`form-data` exigem triagem de impacto no backend/proxies/providers; o restante envolve majoritariamente ferramentas, CSS, lint e build, sem dispensar avaliação por cadeia. O npm não oferece correção automática compatível para todos os nós. Nenhum novo gate de auditoria foi mascarado; a CI funcional não certifica esses riscos.

## Pacote de revisão somente leitura

Destino local: `/workspace/mds-crm-onboarding-evidence/c6/review-package/`, com arquivo `block2-c6-review.tar.gz` ao lado. Conteúdo: bundle de **somente duas refs**, patch da base saneada ao HEAD final, lista de commits, relatórios G1–G6/C0–C5, evidências HTTP antes/depois, resultados atuais, riscos, roteiro de revisão e rollback. Sem .git do workspace, .env local, node_modules, logs privados do servidor, refs antigas ou credenciais. Manifesto e SHA-256 são integridade de arquivos, não fingerprints de segredos. Arquivos entregues sem permissão de escrita; para executar testes, importar em outra cópia e usar apenas banco descartável.

O import em bare novo é conferido com fsck estrito, ancestralidade, baselines, ausência de alternates e ausência dos objetos antigos 59da966/cb1884e/c4cd327/12e0e67. Os objetos originais continuam somente no workspace de preservação. A varredura não autentica em Coolify/providers nem demonstra revogação global; a confirmação anterior do responsável sobre credenciais de teste permanece registrada, sem exigir rotação desnecessária.

## Matriz G1–G6 para parecer independente

| Gate | Evidência disponível | Aceite/bloqueio restante |
|---|---|---|
| G1 | Login/sessões/reset/concorrência e C0 positivos em fixtures | Homologação manual dos fluxos completos/admin/e-mail e parecer distinto; sem aprovação integral |
| G2 | Inventários, permissões e negativos C0/C5; recursos e handlers testados | Cobertura completa por operação/rotas indiretas e exceções justificadas; sem certificação por analogia |
| G3 | Dois tenants, papéis, referências/notificações, Widget/CAS/concorrência positivos | Providers reais e operação de resultados incertos, canais/limites e legado ainda não homologados |
| G4 | Persistência PostgreSQL, single-use/replay/idempotência positivos nos testes | Meta real, retenção/limpeza/recuperação e revisão de migrations antes de eventual promoção |
| G5 | Sete contratos, duas marcas, controle comercial White-Label; observe_only intacto | C5-03/C5-04: cobertura comercial parcial, compartilhados/legados; nenhuma ativação autorizada |
| G6 | CI preparada, instalação limpa Node 22, testes/build/typecheck, pacote/rollback | CI do SHA efetivamente enviado, reviewer distinto, riscos de dependências e aceite explícito de promoção |

**Compatibilidade MDS:** fixtures do cliente legado com os três módulos, marca MDS padrão, permissões e operação positiva foram preservadas; core/providers/schema/lock são idênticos ao início de C6. Não foi lido o SHA atualmente implantado, inventário de tenants, banco ou canais de produção: esses testes não certificam a implantação real. A política vigente C3/C4 separa habilitação comercial de White-Label, exclusiva MDS, de edição operacional de identidade permitida pelo contrato atual. O revisor deve confrontar a especificação inicial do piloto com essas autorizações posteriores, sem reinterpretar automaticamente o documento antigo como nova restrição.

## Envio seguro ao GitHub — proposta, não execução

1. Revisor distinto recebe este pacote e registra SHA, riscos e parecer. Não houve convite/mensagem externa nem autoaprovação.
2. Antes de autorizar envio, confirmar repo `mundodigitalsolucoes/mds-crm-saas`, SHA final, base 8aa1db0 e duas refs exatas. Verificar imediatamente os SHAs remotos e ausência/estado esperado dos destinos; **qualquer divergência suspende o envio**. Não se presume que a última leitura remota histórica continue válida.
3. Confirmar que eventos de ref/PR não acionam publicação externa/Coolify; nenhuma integração foi modificada para este ensaio.
4. Com autorização específica, enviar somente `review/block2-sanitized-base` e `audit/block2-sanitized` a partir da cópia isolada verificada, com criação condicionada ao estado esperado, sem sobrescrever refs. Nunca `--all`, `--mirror`, tags ou histórico antigo; sem force-push/merge/rebase com a base pública.
5. Abrir **Draft** da candidata contra `review/block2-sanitized-base`, não contra a linhagem pública antiga. Registrar runs reais dos quatro workflows, head/base, versão Node e SHA do checkout. Runs históricos da branch antiga não servem como CI desta candidata. Políticas do GitHub podem exigir habilitação/aprovação antes de executar; não presumir success.
6. O envio saneado não remove a exposição de refs/PRs/caches públicos antigos. A retirada histórica pública exige coordenação separada, sem reescrever o remoto durante C6.

## Rollback e piloto Ótica São Paulo

**C6 local:** se for necessário descartar apenas esta preparação, preparar novo commit restaurando os quatro workflows/infraestrutura ao estado de entrada, mantendo C0–C5 e suas correções de segurança. Não reescrever refs antigas nem apagar evidências. Nenhum rollback foi executado.

**Promoção futura, não autorizada:** registrar previamente imagem/SHA saudável, configuração efetiva e backup verificado sob responsabilidade do operador. Não chamar prestart/migrate deploy indiscriminadamente: há histórico Prisma antigo a reconciliar e migrations PostgreSQL aditivas de Instagram/Widget a revisar. Não reverter para versão que reabra as falhas C0/C5; se não houver imagem anterior segura, preferir correção adiante ou contenção explícita dos fluxos afetados. Não apagar tabelas/recibos, nonces consumidos, IDs de inbox ou pending/remote_unknown; não restaurar backup que reabra replay ou permita inbox duplicada. Reconciliar provider antes de qualquer recriação. Restaurar imagem/configuração somente com autorização e smoke de identidade/tenant/Widget/Instagram; sem rotação de TOKENS_SECRET ou mudança de credenciais nesta C6.

**Próxima ação:** autorizar separadamente o envio das duas refs saneadas para Draft/CI e indicar revisor independente. O contrato registrado da Ótica é **Atendimento + Vendas + White-Label, Marketing indisponível**. A navegação já foi testada, mas observe_only ainda permite acessos comerciais por URL/API quando a permissão operacional autoriza; logo, **o piloto comercial não pode ser declarado liberado**. Antes dele, revisar/resolver C5-03/C5-04, aprovar política/limites por canal e legado, homologar providers e rollback, registrar URL/SHA de destino e conceder autorização específica de piloto/enforcement/deploy. Não é necessário usar a conta real da Ótica para concluir a revisão local.
