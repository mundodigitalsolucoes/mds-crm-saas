# Bloco02 — CI do corte de anexos e auditoria da candidata

**Integração local de CI validada. Sem push, atualização da PR15, merge, deploy ou mudança de produção. Nenhum gate/piloto aprovado.**

Referência inicial7a90a595f960c79ec5b2a4b449ccb5925eff0348, audit/block2-sanitized, árvore inicialmente limpa. Commit funcional desta rodada **f2c4b71e19450098bfc5d7c16da4a97b2fa5196b**. Este relatório e resumo de evidências ficam no commit documental seguinte, sem reescrever os14 commits anteriores. Resultados funcionais vinculados a f2c4b71 e fingerprints dos arquivos; a mudança posterior é documental.

## Auditoria dos14 commits pendentes

PR GitHub #15 consultada READ ONLY: aberta/Draft, head17b11d901a30b78be8d84d1ba18ee1d22df175e7; base review/block2-sanitized-base em8aa1db0b893b042967c3905a3582916b713cf9ab. Head remoto é ancestral da candidata. Sem merge/rebase com linhagem pública antiga ou envio de refs/tags. Não se presume que o remoto continuará igual na próxima execução.

| Commit | Escopo encontrado |
|---|---|
| a27316c |P2 comentários: permissões e vínculo sob locks; testes de revogação/transferência |
| 061b7fe |Compatibilidade de permissões parciais e guards comerciais pontuais; filtro de recursos/dependências e navegação coerente |
| f0acc3e |Inventário/matriz comercial e documentação de pendências |
| 7d4bcf7 |Subtarefas herdam autorização comercial da tarefa persistida |
| 786233c |Evidências do lote granular e dependências protegidas |
| 46f8b7d |Quatro helpers com exceção expressamente autorizada; pares compatíveis e contexto transacional |
| 8c750be |Identidade/tenant/permissão continuam exigidos independentemente do modo comercial |
| cb31230 |Comentários/anexos vinculados ao recurso canônico e tenant, antes dos efeitos |
| 7bd515d |Relatório Lote2 e bloqueador estático explicitamente registrado |
| 17ffff8 |Privado para novos anexos, GET autenticado, serializers e dry-run sem apply |
| 7c6400b |Testes de storage/HTTP; seis negativos legados continuam exigindo bloqueio |
| f787175 |Evidências Lote3 e plano de corte/recuperação |
| 86be031 |Simulação sintética de migração/corte/restart/rebuild/recuperação privada |
| 7a90a59 |Limpeza seletiva de oito fixtures e preservação/recuperação dos demais registros |

Diff entre remoto e7a90a59:53 arquivos, majoritariamente evidências/documentação. Mudanças funcionais correspondem aos lotes autorizados; não encontrei arquivo inesperado fora desses escopos. A exceção de helpers foi autorização anterior explícita, não refatoração nova desta CI. Não houve modificação de schema/dependências/providers/startup/infra nesses14 commits. Auth base, checkPermission, policy, branding e os arquivos de Dashboard não receberam alteração no delta; correções de recurso/autorização são aditivas e têm regressões funcionais reexecutadas. Isso não é aprovação universal de todas as rotas.

Scan dos2.621 objetos alcançáveis da candidata inicial: zero ocorrências dos quatro valores expostos conhecidos, comparados só em memória; zero padrões fortes de chave privada/token GitHub/AWS/Slack. Nenhum valor/hash de credencial foi impresso ou armazenado no relatório. .env.example documenta apenas a raiz privada vazia. Scan heurístico não prova inexistência universal de qualquer segredo desconhecido. Guard de histórico no commit funcional: baselines protegidos alcançáveis, unsafeAncestry=false, forbiddenPaths=0.

C0–C5:155 Node/PostgreSQL e387 TypeScript PASS; seis probes HTTP de Dashboard/comercial/White-Label/cross-tenant/acesso direto/Tarefas-OS PASS. O harness168 preserva anexo/tenant/permissões/comercial e comentários na recuperação; testes HTTP de comentários complementam os negativos P1/P2. Arquivos de branding/motor comercial/policy permanecem intactos; observe_only e manifesto vazio não foram ativados por env, query ou papel.

## Arquivos desta implementação

| Arquivo | Mudança |
|---|---|
| .github/workflows/block2-postgres-concurrency.yml |Acrescenta apenas job attachments-cutover, com serviço PostgreSQL16 próprio e artefatos; conteúdo anterior do workflow preservado integralmente |
| scripts/block2-attachments-cutover-ci.mjs |Entrada CI executa seis recusas e o harness; exige168 asserts únicos PASS e cenários essenciais; publica JSON estruturado e fingerprints de código |
| docs/BLOCK2_CUTOVER_CI_READINESS.md |Auditoria e resultados desta rodada |
| docs/evidence/BLOCK2_CUTOVER_CI_RESULTS.json |Resumo verificável vinculado ao commit funcional/arquivos |

O harness existente NÃO foi modificado; SHA de código permanece igual ao validado em7a90a59. Não houve mudança na aplicação, Prisma, Dockerfile, dependências, infraestrutura real ou regras de autorização para fazer a CI passar. Não se removeu nem converteu FAIL legado em PASS.

## Contrato do novo job

Reutiliza workflow PostgreSQL existente, com job separado para não alterar o serviço/user block2 já usado pelos testes antigos. Serviço postgres:16, usuário mds_dev, database mds_crm_dev, senha literal fictícia de CI, porta127.0.0.1:5432. Sem volumes do host, ambientes de deploy ou secrets de produção; permissions contents:read, checkout do SHA exato sem tags/persistência de credenciais. Não usa npm start/prestart migratório. Timeout25min.

npm ci --ignore-scripts e prisma generate são preparação de dependências/client, antes do teste. O teste roda env -i com PATH, opt-in synthetic-local-only e URL loopback descartável. O harness cria namespace aleatório próprio, usa diretórios temporários próprios e remove-os. DDL/schema push ocorre somente nesse namespace de teste, nunca em banco real. Instalação de pacotes pode usar registries; a execução da simulação bloqueia tráfego externo JS/TCP/TLS/HTTP/fetch/DNS/UDP e usa fonte sintética local, sem providers. Não é sandbox de kernel contra código nativo arbitrário; datasource nativo Prisma é fixado no loopback validado e não há credencial/mount real disponível ao job.

Recusas executáveis: sem opt-in, host externo, banco errado, schema injetado, variável real de autenticação presente e argumento de diretório externo. Cada uma deve sair1 no ponto correto, antes de fixtures/conexão. A execução válida deve sair0, retornar168 asserts únicos todos PASS, além dos cenários essenciais de política inalterada, rede negada, rollback/preservação e recovery sem público. Erro, timeout, JSON inválido ou assert ausente falha a CI. Não há continue-on-error ou filtro para esconder FAIL.

Artefatos summary.json, simulation.json e refusals.json publicados com upload-artifact v4, if:always, retenção7dias e erro se evidência ausente. Somente fixtures/status/fingerprints de código, nunca stderr/env bruto, senha/token ou hashes de credenciais. Expectativa168 é pinada: adicionar cenário no futuro exige revisão explícita do contrato, não baixar o limiar. Evidência contém SHA e hashes do workflow/entrada/harness; nenhum artefato de dados reais é produzido.

## Validação local

A instância PostgreSQL anterior não estava disponível. A primeira tentativa falhou fechada, depois das seis recusas, antes de fixtures. Tentativa de obter binário via índices de pacote não produziu instalação; snapshot de pacotes retornou403. Foi usada imagem postgres:16 já disponível no daemon LOCAL, em container novo exclusivo, dados em tmpfs, porta loopback e sem mounts/volumes existentes. Isso reproduz a versão de serviço definida na CI, sem tocar containers reais. Falha inicial não foi contada como PASS.

| Verificação | Resultado |
|---|---|
| Mesma entrada do workflow, no commit funcional f2c4b71 |168/168 +6/6 recusas PASS, exit0; dois builds isolados, restart/rebuild e recuperação |
| node scripts/block2-c6-ci.mjs node |155/155 PASS,0 skip/TODO; PostgreSQL real descartável e mocks de providers |
| npx tsx --test tests/*.test.ts |387/387 PASS |
| node scripts/block2-c6-ci.mjs http |Seis probes C0–C5 PASS, com NextAuth/HTTP real |
| HTTP comentários |115/115 PASS:62 DELETE +53 GET/POST; sem dados cruzados/efeitos indevidos |
| npm run build |PASS, Prisma generate + Next build; sem deploy/migrate |
| npx tsc --noEmit |PASS |
| Lint C0–C6 de71 arquivos |0 erros,8 avisos herdados, sem supressão; script novo0 erros/0 avisos |
| actionlint1.7.7, quatro workflows |PASS; checagem YAML/expressões, shellcheck/pyflakes não instalados e explicitamente desabilitados nessa ferramenta |
| Histórico saneado |PASS; unsafeAncestry=false/forbiddenPaths=0 |

Artefatos locais completos: /workspace/mds-crm-onboarding-evidence/cutover-ci, inclusive artifacts/simulation.json e artifacts/refusals.json. O SHA funcional e fingerprints permitem comparar o código testado com o commit documental posterior. Não se alega execução no GitHub do SHA novo: sem push, apenas reprodução LOCAL da entrada/job. Executor GitHub/checkout/artifact upload ainda precisam execução remota autorizada.

## Riscos e condições para atualizar a PR15

1. Revalidar imediatamente antes do envio: branch/HEAD/árvore, segredos/objetos alcançáveis, base e ref de auditoria remotas, ausência de tags/refs antigas e gatilhos de deploy/preview. Se remoto mudou/divergiu, parar. As consultas desta rodada não aprovam um envio futuro.
2. Autorizar explicitamente atualização somente de audit/block2-sanitized; preservar review/block2-sanitized-base e PR15 Draft. Sem force/all/mirror/tags, merge/rebase com linhagem pública antiga ou mudança de main.14 commits auditados + commit funcional CI + commit documental ficam pendentes até esse aceite.
3. Após envio autorizado, quatro workflows (seis jobs com o novo job) devem ser acompanhados no SHA exato, com168+6 e artefatos presentes. Pull_request synchronize contra base saneada é gatilho; filtros de push não garantem todos. Nunca atribuir checks de17b11d9 ao SHA novo.
4. Revisão independente por pessoa/agente distinto, focada em scope dos14 commits, auth/tenant, guard indireto, limpeza/grafo, storage/headers e recuperação, canais/receipts, legado comercial/White-Label e CI. Nenhuma solicitação externa foi enviada nesta rodada.
5. URLs públicas reais legadas ainda não foram cortadas; infraestrutura/mount/root, backup/restore, startup migratório e eventos assíncronos continuam pendentes. A simulação só bloqueia URLs sintéticas de sua própria topologia. Recibos pending/remote_unknown não autorizam replay, e200 de webhook não prova processamento.
6.55 APIs/quatro layouts do recorte comercial anterior permanecem pendentes; modo observe_only não garante bloqueio real de Marketing. Não ativar enforcement ou confundir CI verde com aceite de rollout/piloto.

Sem produção, push, merge, deploy, alteração do Coolify ou dados reais. G1–G6 e Ótica São Paulo continuam sujeitos a evidências/aceites próprios, sem aprovação automática.
