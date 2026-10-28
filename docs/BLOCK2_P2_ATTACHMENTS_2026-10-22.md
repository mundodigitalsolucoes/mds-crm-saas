# Bloco 02 — correções locais P2 de anexos — 2026-10-22

**Não homologado. Sem push, merge, deploy, migrations em produção ou alterações no Coolify.** PR #15 permanece sem atualização nesta execução. Branch `audit/block2-sanitized`; baseline `b1623d1`. PostgreSQL 16 descartável, loopback, dados e arquivos sintéticos; Node 22.21.1. Não foram consultados arquivos de clientes.

## Correções e causa-raiz

### P2-01 — referência escalar preservada

Commit `406adf2`. O preflight da simulação verificava relações de Leads, mas ignorava `Attachment.entityType='lead' / entityId`, que não tem FK. O snapshot dos anexos podia continuar idêntico enquanto o Lead era apagado, deixando relação órfã.

Reprodução executável com Prisma/PostgreSQL: antes, preflight aceitou a limpeza, anexo permaneceu e Lead desapareceu dentro da transação; rollback restaurou os registros. Depois, o preflight recusou a mesma classificação antes da exclusão. O guard considera referências preservadas independentemente do tenant declarado no anexo, evitando liberar uma relação histórica inconsistente.

Arquivos: `tests/attachments-legacy-cutover-http.mjs`, `scripts/block2-attachments-cutover-ci.mjs`, `.github/workflows/block2-postgres-concurrency.yml`. Acrescentadas seis verificações; as 168 anteriores foram mantidas. Cobertura negativa de anexo preservado, integridade, par explicitamente descartável, falha intermediária/rollback, exclusão filho-antes-do-pai, bytes privados e elegibilidade original. Atualizados contador e nome do job para **174**, sem criar executor de produção.

### P2-02 — multipart antes da autenticação

Commit `fea005b`. O POST chamava `request.formData()` antes de autenticar ou verificar tamanho. Probe do handler real transpilado, com dependências de sessão simuladas: baseline processou multipart e retornou 400 antes de consultar a sessão; correção retornou 401 sem parse. Esse comparativo é de handler, não HTTP de baseline.

Arquivos: `src/app/api/attachments/route.ts`, `tests/attachments-upload-body.test.mjs`, `tests/attachments-upload-http.mjs`.

A implementação reutiliza `checkAuth` e `checkPermission`: sessão/usuário/organização ativos antes de ler o corpo; admissão antecipada exige alguma permissão edit aplicável entre tasks/leads/projects. Essa união não concede acesso à entidade: como entityType está dentro do multipart, sua permissão exata e a autorização comercial/transacional continuam obrigatórias depois do parse limitado e antes de gravar. Não foi alterada autenticação global nem o motor comercial.

Envelope limitado a 10 MiB + 64 KiB, incluindo ausência de Content-Length; limite do arquivo permanece 10 MiB. Content-Length excessivo é recusado antes da leitura. Tipo/boundary inválidos são recusados; leitura excessiva é interrompida/cancelada antes do parser. Deadline de leitura de 15 segundos. Respostas controladas 400/401/403/408/413/415 conforme o caso; tamanho acima de 10 MiB passou de 400 para 413. Não há alteração de schema/providers.

## Execução local

| Verificação | Resultado |
| --- | --- |
| `node scripts/block2-attachments-cutover-ci.mjs`, com opt-in sintético e banco local explícito, ambiente limpo | **174/174 + 6/6 recusas PASS**; inclui preservação dos 39 modelos, providers/configurações/OAuth/recibos e rollback/restart |
| `node scripts/block2-c6-ci.mjs node` | **167 PASS**, zero falhas/skip/TODO; inclui 12 testes de upload antes do parser |
| `npx tsx --test tests/*.test.ts` | **387 PASS**, zero falhas/skip/TODO |
| `node scripts/block2-c6-ci.mjs http` | **6/6 probes PASS**: C0, comercial/Dashboard, White-Label, cross-tenant, acesso direto e Tarefas/OS |
| `tests/comments-delete-http.mjs` e `tests/comments-tenant-http.mjs` em servidor Next real | **62 + 53 cenários PASS** |
| `tests/attachments-upload-http.mjs` em servidor Next real + PostgreSQL | **11/11 PASS na execução final** |
| `npm run build` | PASS; Prisma Client + Next build, sem executar `npm start`/prestart ou migrations |
| `npx tsc --noEmit` | PASS |
| ESLint dos três arquivos P2-02 com `--max-warnings 0` | zero erros e avisos |
| `node scripts/block2-c6-ci.mjs lint` | zero erros nos 73 arquivos; oito avisos herdados, sem supressão |
| `node scripts/block2-c6-ci.mjs history` | base saneada e correções protegidas alcançáveis; linhagem insegura ausente; zero caminhos proibidos |

HTTP final: anônimo 401; sem edit 403; permissão de outro recurso 403; formato incorreto 415; multipart inválido 400; entidade estrangeira 404; arquivo excessivo 413; permissão revogada 403; chunked excessivo 413. Todas as recusas sem nova linha de anexo. Uploads de 32 bytes e 10 MiB: POST 201, download 200 com tamanho correto, DELETE 200. O teste chunked mantém a exigência de 413 e reprova globalmente em falha de transporte.

Build/suítes e simulação foram executados com os mesmos bytes funcionais posteriormente consolidados em `fea005b`. A simulação registra SHA intermediário `07a5242`, antes do amend local restrito ao teste HTTP (ordem dos casos e restauração da permissão sintética após testar revogação); o harness e aplicação permaneceram iguais. A última execução HTTP utilizou o teste final. Evidências estruturadas: [JSON local versionado](evidence/BLOCK2_P2_ATTACHMENTS_2026-10-22.json). Logs completos privados permanecem em `/workspace/mds-crm-onboarding-evidence/p2-fixes/`; não são resultados remotos da CI.

## Riscos residuais e condição de implantação

- Em execução inicial, upload chunked excessivo produziu `ECONNRESET` no cliente durante cancelamento. Na última execução retornou 413; isso não comprova comportamento uniforme de todos os runtimes/proxies. A ocorrência permanece registrada. Não houve remoção do cancelamento nem redução das asserções de limite/zero parse.
- O limite da aplicação restringe bytes consumidos/retidos por este handler antes do multipart. Não certifica buffering prévio no Next/proxy, limite global de concorrência, alocações do parser nem proteção completa contra exaustão por conexões paralelas. Antes de implantação, exigir limite de corpo no ingresso (10 MiB + 64 KiB para este endpoint), timeout/rate/concurrency limits, validação de requisições chunked e sem Content-Length e testes no runtime efetivo. Nenhuma configuração real foi alterada. Uploads de branding/canais não foram globalmente limitados por esta alteração.
- URLs estáticas legadas de produção continuam bloqueador até corte autorizado; um download autenticado novo não protege URLs antigas. Volume privado durável, root, backups e bloqueio seletivo do legado seguem dependentes da intervenção futura.
- O harness não classifica registros reais automaticamente nem autoriza limpeza. O guard só protege a simulação autorizada; não foi instalado executor de limpeza em produção.
- Cobertura comercial restante e ativação nominal continuam sujeitas à matriz/plano C5; global `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados. Não foi certificada a operação de providers reais nem segurança de todas as dependências.

## Efeito nos gates

| Gate | Atualização desta rodada |
| --- | --- |
| G1 | Autenticação antecipada do upload e regressões positivas; sem aprovação integral de G1 |
| G2 | Recusas operacionais/comerciais mantidas; multipart autenticado e limitado; requer validação dos limites no ingresso real |
| G3 | Lead/anexo preservado não pode ficar órfão na simulação; HTTP entre tenants negado; legado público e persistência real continuam pendentes |
| G4 | Regressões locais preservadas; nenhuma alteração OAuth/webhooks; não substitui homologação real |
| G5 | Contratos e White-Label preservados; nenhuma ativação comercial; gate não aprovado |
| G6 | Evidência local ampliada; CI remota destes commits, revisão independente, infraestrutura/corte e aceite continuam pendentes |

Nenhum gate ou piloto aprovado. Próximo envio à PR #15 exige autorização posterior. Rollback de código é local/reviewável; qualquer rollback futuro de implantação deve manter o bloqueio das URLs públicas e preservar o armazenamento privado.
