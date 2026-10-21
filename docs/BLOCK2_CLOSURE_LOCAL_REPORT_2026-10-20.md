# Bloco 02 — relatório consolidado de auditoria e validação local

**Decisão: NÃO HOMOLOGADO. Nenhum gate G1–G6 aprovado formalmente.** Sem merge, push, deploy, publicação ou alteração em produção. Dados, usuários e credenciais usados nos testes são fictícios; providers foram simulados. O único PostgreSQL utilizado foi `mds_crm_dev` em loopback.

A avaliação usa os documentos oficiais `BLOCK2_CLOSURE_EXECUTION_2026-10-19.md` e `BLOCK2_CLOSURE_GATE_2026-10-19.md`, encontrados por leitura do histórico e da branch remota `feature/modular-plans-entitlements`. Base efetivamente avaliada: **cb1884e413203baa123ca94dfb0a4c4635b6502a**, em branch local **audit/block2-closure**, no mesmo checkout isolado. Não houve merge da candidata em main. As evidências anteriores de main (`47bbccc`) são históricas e não foram atribuídas à candidata. O defeito de assignee estrangeiro de main já estava corrigido na candidata e foi confirmado negado por HTTP 400.

| Gate | Evidências obtidas | Status e pendências |
| --- | --- | --- |
| **G1 — Autenticação/C03-C04** | Handlers reais, PostgreSQL, bcrypt e JWT reais: login admin, cookie HttpOnly, segredo ausente/fraco, senha/JWT/algoritmo/papel inválidos, admin removido/e-mail alterado, logout de cookie, negativa de provisionamento anônimo; signup concorrente sem tenant órfão; usuários/tenants removidos não reativados; emissão/consumo concorrentes de reset e convite legítimo. Login NextAuth real também validado por HTTP | **Validação local positiva; não homologado.** Transporte de sessão/cookies/email/providers nos testes de handlers é simulado. Revisão independente e validação integral de browser/middleware permanecem pendentes. Logout não foi certificado como revogação de cópia roubada de JWT |
| **G2 — Autorização** | Inventário: 116 arquivos, 177 métodos, 50 páginas/layouts; nenhum literal `use server` encontrado. Artefato por método usa AST e registra sinais, sem presumir proteção. Três papéis e tenant divergente testados. Corrigida elevação por papel antigo no JWT e autenticação Asaas sem segredo | **PARCIAL.** O inventário original aponta 47 linhas para revisão manual; isso é heurística, não 47 vulnerabilidades. Falta revisão completa por método, recursos indiretos e exceções documentadas, além de matriz de operações sensíveis |
| **G3 — Multi-tenancy/providers** | Dois tenants, contas Chatwoot com mesmo nome de inbox, isolamento de leads via HTTP, QR e quatro operações de lifecycle Evolution negando IDs estrangeiros antes do provider, rejeição de Cloud no QR, adapter Google por tenant e rejeição de URL hostil. Meta/Widget com banco real e mocks | **BLOQUEADO.** Widget duplica inbox após sucesso remoto + perda da reserva por outro escritor. Reconciliação e identidade duráveis da operação ainda faltam. Não há comprovação integral de todos os caminhos de cada provider |
| **G4 — Instagram/replay** | Autorizada preparação PostgreSQL/migration para revisão e teste local. Hash de nonce, consumo atômico, limite de emissão, vínculo ativo de usuário/tenant, HMAC preservado, recibos de webhook duráveis por identidade de mensagem. Nove testes reais de banco/handlers aprovados, incluindo concorrência e reentrega com outro cliente Prisma | **CANDIDATO LOCAL, NÃO HOMOLOGADO.** Produção não autorizada. Pending/remote_unknown bloqueiam retry e precisam de reconciliação; não existe garantia de entrega exatamente uma vez. Retenção/operação, falhas remotas e validação real dos providers exigem revisão |
| **G5 — Entitlements** | `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados byte a byte. Suítes de contratos/legado executadas. Nenhuma política, limite, plano ou bloqueio comercial novo foi ativado | **PRESERVADO, NÃO APROVADO PARA ENFORCE.** Matriz comercial, recursos compartilhados, compatibilidade e rollout por tenant continuam sujeitos às decisões do planejamento. A correção Asaas alterou somente autenticação; o processamento dos eventos permanece igual ao baseline |
| **G6 — Homologação final** | Build, Prisma e typecheck aprovados; instalação idempotente; evidências PASS/FAIL/TODO registradas; workflow preparado com bloqueio de TODO de segurança; planos de rollback documentados | **BLOQUEADO.** Widget, lint global, vulnerabilidades de dependências, CI remoto não confirmado, revisão por responsável distinto e ensaio/aceite de rollback continuam pendentes |

## Resultados executados

Ambiente: Node 24.19.0, npm 11.9.0, Next 16.2.6, Prisma 5.22.0, PostgreSQL 16. Comandos da aplicação executados em `/workspace/mds-crm-saas`.

| Comando/verificação | Resultado |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` e `npx prisma generate` | PASS; lockfile preservado, sem bypass de TLS/checksum |
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS final, status 0 |
| `npm run build` | PASS, status 0; 156 páginas geradas e quatro workers |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, sem skip/todo/falha |
| `BLOCK2_TEST_DATABASE_URL` local + `node --import tsx --test tests/*.test.cjs tests/*.test.mjs` | **89 PASS e 1 TODO executado com asserção falhando**; nenhum skip. O retorno 0 do runner por TODO NÃO aprova a segurança |
| Smoke HTTP autenticado, `.cache/bloco02-smoke.cjs` | **22 PASS**; CSRF/login/sessões, leads, IDOR, assignee estrangeiro negado, usuário removido e rate limit. Agenda: um evento para oito POSTs simultâneos, um 201 e sete 409 |
| Comando equivalente ao novo workflow: `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, seguido da barreira de TODO | Runner registra a falha conhecida; **barreira de aceite retorna 1**, como esperado |
| `npm run lint -- --output-file .../eslint-final.json --format json` | Ferramenta compatível executa; **218 erros e 77 avisos** no projeto completo. Nenhuma regra foi desativada |
| ESLint nos arquivos de código/testes/configuração alterados | PASS, status 0 |
| Auditoria npm | 49 dependências sinalizadas: 2 críticas, 37 altas, 8 moderadas, 2 baixas. Next e next-auth críticos. Evidência reaproveitada com lockfile idêntico; não se afirma exploração de todos os advisories |
| `bash .cache/install-cloud.sh` atualizado | PASS repetido, status 0; histórico selecionado preservado e diff local vazio |
| `npx prisma migrate status` | Status 1 esperado por duas migrations de dados deliberadamente pendentes |
| YAML do workflow e `git diff --check` | PASS |
| GitHub Actions via `gh run list` e diagnóstico `curl` | CONNECT 403 no proxy de `api.github.com`; estado remoto dos novos commits **não confirmado**, nenhum workflow disparado |

O typecheck identificou dois parâmetros CAS nullable incompatíveis com o schema não nulo; corrigidos somente os tipos. Depois do build, o cache `.next/dev` herdado de main conflitava com tipos da candidata. Esse cache gerado foi preservado em `/tmp`, e o typecheck final passou com os arquivos rastreados intactos. A alteração automática de `next-env.d.ts` pelo Next foi restaurada; nenhum erro de fonte foi escondido por configuração.

## Widget — falha crítica transversal comprovada

O teste executa o handler real com Prisma/PostgreSQL. Depois de o POST remoto retornar sucesso, um escritor concorrente substitui `Organization.settings` sem a reserva. A confirmação e a gravação de erro por CAS falham corretamente para não sobrescrever dados atuais, mas a referência da operação é perdida. Uma nova chamada emite outro POST: **2 em vez de 1**. A asserção permanece falhando como TODO explícito, com barreira de aceite bloqueante no workflow preparado. Isso não é teste aprovado nem reconciliação concluída.

A correção segura aplicada ao Widget saneia erros brutos Chatwoot em respostas e preserva os códigos/status locais. Reserva pré-POST, timeout com reconciliation_required, 404 sem criação substituta e conflito de agentes foram testados. Não foi implementada adoção por nome, desbloqueio por idade ou retry cego. A solução completa requer identidade de operação independente de settings, correlação verificável no provider e fluxo de reconciliação autorizado/testado. Ver `BLOCK2_WIDGET_LOCAL_VALIDATION_2026-10-20.md`.

## Migration local e rollback

Aplicadas somente `0_baseline`, `20260321000000_add_deleted_at_organizations`, `20260902000000_add_public_booking` e a nova `20261020230000_instagram_security_storage`. Esta última foi preparada e aplicada apenas localmente após a autorização explícita do usuário. Não foram alteradas migrations históricas nem usados migrate deploy/dev ou npm start.

As duas migrations MDS de seed/reassign continuam não executadas e não foram marcadas artificialmente como aplicadas. A dívida do histórico que omite outros campos/tabelas continua aberta; a reconciliação de schema feita em onboarding é exclusiva do banco descartável e não é um plano de migração de produção. Ao final, zero organizações de teste e zero registros das novas tabelas permaneceram no banco.

Rollback proposto nos relatórios de Widget, autenticação e G4: reverter os commits específicos somente com os fluxos afetados bloqueados, pois voltar ao comportamento anterior reabre as vulnerabilidades. Preservar tabelas/recibos/evidências; não apagar pending/remote_unknown ou liberar replay. A migration é aditiva e tabelas podem permanecer sem uso durante recuo de código; remoção exige decisão própria e backup. Não houve rollback real em produção nem aprovação desse plano para execução.

Como as validações não passaram integralmente, nenhuma publicação foi preparada para execução e nenhuma URL externa de destino foi presumida. Destino, versão anterior, backups e ensaio de rollback devem ser apresentados ao responsável antes de qualquer autorização futura.

## Git, credenciais e configuração

Nenhum `.env` ou segredo local foi incluído nos commits. `.env.local` e `.cache` estão ignorados; os segredos técnicos locais foram gerados sem imprimir valores. `.env.backup` **já estava rastreado** e contém campos que exigem revisão segura e rotação se forem reais. Não foram usados para acesso externo nem apagados silenciosamente; não se certifica ausência de credenciais históricas no repositório.

O core operacional de Atendimento/iframe, credenciais globais Chatwoot, adapters e demais lifecycle, política comercial, checkLimits e lockfile permanecem iguais à base candidata. A alteração pontual no guard legado foi necessária para impedir elevação por claim antigo, tem reprodução antes/depois e teste que preserva todos os demais bytes do arquivo. O processamento comercial Asaas está pinado por teste separado. Os doze documentos canônicos foram preservados e suas verificações passaram.

`install_script` e `start_skill` foram atualizados no rascunho e a instalação foi repetida. `api.github.com` foi adicionado às três regras customizadas existentes, preservando os presets, somente no rascunho; é necessário revisar/salvar essa liberação para retestar leitura do CI. Isso não foi aplicado/publicado nem comprova autorização REST. Não foi solicitado token apenas porque a CLI falhou. Sem publicação, não há evidência de restauração em uma nova tarefa. Os commits são locais e não foram enviados ao remoto.

## Commits locais e evidências

- `617cfd3` — saneamento de erros Widget e provas de conflito com PostgreSQL.
- `48c4190` — storage OAuth/webhook Instagram e migration para revisão/teste local.
- `d7ddde3` — tipos corretos dos snapshots CAS do Widget.
- `fdbdb5c` — papel atual do banco, autenticação Asaas, lint compatível, regressões e workflow preparado.
- O commit deste relatório é adicional; a lista completa com SHAs está no artefato `COMMITS.txt` e em `git log cb1884e..HEAD`.

Evidências: `/workspace/mds-crm-onboarding-evidence/candidate/`. Incluem logs de testes e build/typecheck, JSON de lint/auditoria, inventários originais e por método, TAP da falha conhecida e barreira bloqueante, reprodução de papel antigo e Asaas antes das correções, smoke HTTP, migrations e instalação repetida. Os testes com providers usam mocks explicitamente e não demonstram compatibilidade com uma instalação real.

Bloqueios para a próxima etapa: corrigir/reconciliar o Widget sem duplicação; revisar integralmente G2 e cenários restantes G1/G3; definir operação/retensão/reconciliação dos recibos G4; tratar lint/dependências e credenciais históricas; confirmar CI no SHA final; obter revisão independente e aceite formal. Não ativar enforce, não usar produção e não promover o candidato enquanto esses bloqueios estiverem abertos.

---

## Adendo — correção dos bloqueadores de homologação, 20/10/2026

Este adendo atualiza os resultados acima sem apagar a evidência histórica. **Decisão atual: NÃO HOMOLOGADO; nenhum gate aprovado formalmente.** Branch `audit/block2-closure`, mesmo checkout isolado. Os cinco commits originais de 617cfd3 a d541622 permanecem ancestrais, sem reescrita. Nenhum merge, push, deploy, publicação ou acesso a banco de produção foi realizado.

### Correções e comparação

| Item | Antes (d541622) | Resultado desta rodada |
| --- | --- | --- |
| Widget, perda da reserva | Dois POSTs; TODO de segurança executado e falhando | Operação persistente independente dos settings; recuperação por ID com GET/PATCH; 16 testes funcionais PASS, zero TODO, incluindo a asserção original |
| Auditoria npm | 49 dependências, 2 críticas | 17 dependências, **zero críticas**, 14 altas, 2 moderadas, 1 baixa |
| Versões efetivas do lock | next 16.2.6; next-auth 4.24.14 | next **16.3.8**; next-auth **4.24.15**, somente essas duas dependências diretas selecionadas |
| Lint global | 218 erros / 77 avisos | **182 erros / 77 avisos**, retorno 1; 36 erros corrigidos, nenhum diagnóstico novo |
| Identidade removida em auth/me | HTTP 200 reproduzido | Seis rotas pessoais usam associação ativa de checkAuth; 54 combinações negativas e 18 legítimas passaram em dois testes agrupados |
| Inventário de autorização | 177 métodos com sinais heurísticos | Todos os 177 métodos classificados por contrato/guard/exceção, 116 arquivos e 50 páginas/layouts; isso não prova todos os ramos nem substitui revisão independente |
| Suite Node/PostgreSQL | 89 PASS e 1 TODO falhando | **101 PASS**, zero falha/skip/TODO |
| Suite TypeScript | 171 PASS | **171 PASS**, zero falha/skip/TODO |
| Aceite equivalente ao workflow | Bloqueado pelo TODO | Barreira específica de TODO passou; CI remoto do novo SHA continua não executado |

Widget: a tabela aditiva WidgetInboxOperation vincula tenant, ConnectedAccount, conta/URL e identidade remota. Ela é reservada antes de enviar, e o ID remoto é salvo antes do CAS final. Foram auditados 27 pontos de escrita de Organization em 16 arquivos. Substituição do JSON não autoriza novo POST. Timeout/crash sem ID deixa pending/remote_unknown e exige reconciliação operacional; não existe adoção por nome, desbloqueio por idade ou criação substituta após 404. Testes reais de handler e PostgreSQL cobrem concorrência, conflitos CAS antes/depois do despacho, nova conexão de banco, PATCH existente, soft delete em momentos distintos, erro saneado e isolamento. Provider e transporte de autenticação nesses testes são simulados; Chatwoot real ainda não foi homologado. Detalhes e limites: [reconciliação durável](BLOCK2_WIDGET_DURABLE_RECONCILIATION_2026-10-20.md).

Dependências: os dois alertas críticos eram de Next e NextAuth diretos; a cadeia peer Next → NextAuth também propaga severidade. Versões corrigidas, ranges, GHSA, impacto condicionado à configuração e integridade constam em [dependências críticas](BLOCK2_CRITICAL_DEPENDENCIES_2026-10-20.md). Não foi explorado RCE. O teste isolado com o pacote oficial anterior reproduziu URIError para Bearer malformado; a versão corrigida retorna null. A aplicação usa CredentialsProvider, não EmailProvider; o aviso crítico de normalização de e-mail não foi descrito como fluxo local explorável. Next 16.3.8 cobre os ranges críticos e demais avisos do pacote sem escolher automaticamente a versão mais nova. Mudanças transitivas/plataforma no lock decorrem dessa seleção, não de audit fix global. As 17 dependências remanescentes continuam dívida explícita.

Lint: todos os 295 diagnósticos iniciais foram comparados por âncora de código com cb1884e e d541622; já estavam no candidato anterior aos cinco commits. Origem é classificação textual, não certificação semântica. Relevância para segurança é eixo separado: 53 diagnósticos iniciais em APIs/helpers sensíveis, dos quais restam 44 para revisão, sem presumir 44 vulnerabilidades. Foram corrigidos os erros do incremento e os bloqueadores diretamente alterados: tipos NextAuth/Instagram/notificações, const de signup, nomes locais de module, testes ESM mantendo asserções e carregamento inicial do Widget com cancelamento. As demais 259 mensagens (182 erros, 77 avisos) são preexistentes; nenhuma regra foi desativada. Detalhes: [G2 e lint](BLOCK2_G2_LINT_REVIEW_2026-10-20.md); classificação individual em lint-classification.json.

### Comandos executados e evidência final

Diretório externo de evidências: `/workspace/mds-crm-onboarding-evidence/blockers/`. Somente variáveis locais carregadas; BLOCK2_TEST_DATABASE_URL aponta ao mesmo PostgreSQL descartável. Logs não contêm valores de credenciais. Resultados intermediários falhos foram preservados, e os arquivos com sufixo final ou followup identificam as verificações conclusivas.

| Comando/verificação | Resultado e artefato |
| --- | --- |
| HEAD HTTPS da raiz de binaries.prisma.sh | TLS/conectividade responderam; raiz retorna 404, não é endpoint de engine (prisma-connectivity.log) |
| `curl --head --fail` do checksum oficial da engine Prisma fixada | HTTP 200, status 0; prisma-engine-connectivity.log |
| `npm install --save-exact next@16.3.8 next-auth@4.24.15` | PASS; dependency-install.log, metadados oficiais e dependency-changes.json |
| `npm ci --cache /workspace/.npm-cache` | PASS, lock reproduzido, 502 pacotes, validação TLS/integridade preservada; npm-ci.log e setup-repeat-final.log |
| `bash .cache/install-cloud.sh` atualizado e repetido | PASS, Prisma Client 5.22.0 gerado e diff de schema vazio; setup-repeat-final.log |
| `npx prisma validate` | PASS; prisma-validate.log |
| `npx prisma migrate status` | Retorno 1 esperado: somente as duas migrations históricas MDS de dados continuam pendentes; migrate-status.log |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | 101 PASS; node-tests-final.tap; barreira de zero TODO em todo-gate-final.log |
| `npx tsx --test tests/*.test.ts` | 171 PASS; tsx-tests-final.log |
| `node --import tsx --test tests/block2-personal-routes-postgres.test.mjs` após ajuste de tipo | 2 PASS (72 combinações); personal-routes-followup.tap |
| `npm run lint -- --output-file .../lint-after.json --format json` | Retorno 1: 182 erros e 77 avisos; lint-after.json e classificação por diagnóstico |
| ESLint nos 25 arquivos JS/TS existentes alterados desde d541622 | PASS; changed-files-lint.log; configuração/regras intactas |
| `npm run build` após ajustes finais | PASS, Next 16.3.8; build-final.log |
| `npx tsc --noEmit` após o build | PASS; typecheck-final.log; alteração gerada de next-env.d.ts restaurada |
| Reinício via `NEXTAUTH_URL` local + `npx next start --hostname 127.0.0.1 --port 3100` | Build atualizado servindo; server.log; sem usar prestart/npm start |
| `node .cache/bloco02-smoke.cjs` | **22 PASS**, login real sem HTTP 500, tenants/IDOR/permissões/assignee e agenda concorrente; http-smoke.log e http-smoke-results.json |
| Consulta final de limpeza PostgreSQL | Zero organizações, OAuth states, webhook receipts e Widget operations de teste restantes |
| Auditoria dos caminhos adicionados e boundary protegido | Nenhum .env/helper local/chave privada novo; .env.local e .cache ignorados; core e política comercial intactos desde d541622; git-boundary-final.json |

O smoke repetido demonstra uma única reserva de agenda para oito solicitações, sete 409 e um 201. A autenticação passou no build atualizado com sessões reais por HTTP. Isso não certifica todos os browsers ou integração de e-mail real. Os nove testes G4 com banco real continuam incluídos nos 101: consumo único de state concorrente entre oito consumidores, callback real com Meta chamado uma vez, tenant/usuário/expiração, indisponibilidade do store, assinatura inválida, ausência de identidade, envio concorrente, replay após nova instância de cliente, resultado incerto e ID igual em tenants distintos. Nenhum teste de código-fonte foi usado isoladamente para declarar a correção do Widget ou persistência G4.

### Gates após as correções

| Gate | Evidência atual | Situação restante |
| --- | --- | --- |
| G1 | Login HTTP real, testes de admin, reset, sessão, tokens e concorrência; regressão Bearer malformado corrigida | Validação local positiva; **não aprovado**. Revisão independente, browser/middleware e e-mail real pendentes |
| G2 | Revisão por método concluída no inventário; seis rotas pessoais corrigidas e matriz PostgreSQL positiva | **Não aprovado**. Verificação independente de ramos/ações indiretas, contratos públicos e exceções de produto pendente |
| G3 | Correção durável do Widget, 16 testes funcionais, isolamento entre tenants e bindings | **Não aprovado**. Chatwoot/Evolution e demais providers reais isolados, reconciliação operacional de resultado sem ID e revisão de referências legadas pendentes |
| G4 | Nove testes funcionais de persistência, assinatura, replay e concorrência no PostgreSQL local; 101 testes gerais positivos | **Não aprovado**. Validação Meta real e processo operacional de pending/remote_unknown, retenção/limpeza e revisão independente pendentes |
| G5 | observe_only preservado; APPROVED_ENFORCEMENTS vazio; suites de boundary/compatibilidade positivas | **Não aprovado formalmente**. Nenhum enforcement comercial foi autorizado ou ativado |
| G6 | Instalação repetível, schema local coerente, typecheck/build/smoke/suites positivos, relatório atualizado | **Bloqueado** pelo lint global, 17 dependências sinalizadas, ausência de CI remoto no novo SHA/revisão independente/providers reais e aceite de rollout/rollback |

Persistência: cinco migrations selecionadas estão aplicadas localmente, incluindo a nova `20261020234500_widget_durable_operation`. As duas de dados MDS continuam pendentes e não foram marcadas como aplicadas. Nenhuma migration histórica foi editada. A reconciliação extra de schema feita no onboarding continua exclusiva deste banco descartável; não converte o histórico em plano de produção.

Git/segredos: não foram adicionadas credenciais nem arquivos de configuração local. `.env.backup` já estava rastreado antes desta rodada: permanece risco anterior, exigindo revisão/rotação segura se contiver material real. Valores não foram expostos nem utilizados. O aviso Next sobre images.domains legado permanece registrado no startup; configuração de imagens/restrição de destinos exige revisão antes do rollout, fora desta correção pontual.

### Commits e reversão para revisão

Incrementos locais preservando os cinco originais: `c772fbb` (identidade durável Widget), `23f158e` (dependências críticas), `8ed774c` (G2 e lint). O commit que contém este adendo conclui os dois ajustes focados de lint e a documentação; seu SHA deve ser lido com `git log -1`, evitando referência circular dentro do próprio commit.

Rollback proposto, não executado: suspender provisionamento e fluxos afetados antes de reverter incrementos; preservar IDs, operações e recibos duráveis, inclusive estados incertos; não apagar tabelas nem permitir replay para destravar. Reverter as dependências restaura ranges vulneráveis, e reverter G2 volta a aceitar identidades removidas: qualquer recuo exige restrição dessas superfícies e revisão de segurança. Antes de futuro rollout, identificar versão/artefato anterior, destino, backup e restauração, ensaiar em ambiente isolado e submeter o plano ao responsável. A migration aditiva pode permanecer durante recuo de código. Não há autorização para executar rollback ou migrations em produção.

O rascunho reutilizável de onboarding foi atualizado com a quinta migration, comandos de teste ESM e estado final; salvar rascunho não publica nem aplica configuração. Os commits permanecem locais e não tiveram restauração em nova tarefa certificada. Como todos os gates ainda não passaram, não foi preparada publicação nem inventada URL de destino. Não é solicitada aprovação de deploy nesta etapa.

---

## Adendo — preparação da revisão independente, 20/10/2026

**Candidato funcional reavaliado:** `3f4ef1bfeb60a104e4e17e116462d24f301a3050`, branch `audit/block2-closure`. Os nove commits acumulados foram revisados e preservados. O novo incremento desta rodada contém somente preparação de eventos CI de PR, documentação e evidência sanitizada; não muda lógica da aplicação, dependências, schema ou migrations. Seu HEAD é o commit que contém este adendo (`git log -1`), sem referência circular no próprio conteúdo. **Nenhum gate aprovado; push/PR bloqueados pela verificação histórica de segredos.**

### Escopo dos nove commits

| Commit | Escopo revisado e vínculo com o Bloco 02 |
| --- | --- |
| 617cfd3 | Saneamento de erro Chatwoot e testes PostgreSQL do Widget; G3 |
| 48c4190 | Nonce OAuth de uso único e recibos de webhook Instagram, modelos/migration aditivos e testes; G4 |
| d7ddde3 | Tipos não nulos do CAS Widget, sem mudar regra de negócio; G3/G6 |
| fdbdb5c | Papel atual do banco, webhook Asaas fail-closed, ESLint compatível, testes e evidências G1–G4 |
| d541622 | Relatório consolidado e bloqueios G1–G6 |
| c772fbb | Operação durável Widget independente de settings, vínculos de provider, migration aditiva e testes; G3 |
| 23f158e | Atualização pontual Next/NextAuth e regressão do Bearer malformado; G1/G6 |
| 8ed774c | Associação ativa em seis rotas pessoais, tipos/lint e testes ESM com asserções preservadas; G2/G6 |
| 3f4ef1b | Fechamento de dois erros focados de lint e relatório de resultados; G6 |

Revisão dos patches: 52 arquivos no incremento dos nove, sem feature comercial adicional ou refatoração global. As duas migrations adicionam somente tabelas/índices/FKs de storage de segurança. Históricas não foram editadas. A alteração de checkPermission é o endurecimento documentado do papel atual no banco, já autorizado e testado; não é ativação de enforcement. Demais políticas/core protegido não foram ampliados. Exceções do teste de boundary admitem apenas novos modelos/relações/helpers autorizados. Helpers, fixtures e credenciais CI são técnicos/fictícios; não foi usado banco de produção.

### Verificação do histórico e bloqueio de envio

`git ls-remote origin refs/heads/audit/block2-closure refs/heads/feature/modular-plans-entitlements` confirmou base **cb1884e413203baa123ca94dfb0a4c4635b6502a** e ausência da ref audit remota. Nenhuma divergência detectada; verificar de novo antes de qualquer futuro push. API GitHub autenticada acessível nesta rodada (o CONNECT403 anterior é histórico, não bloqueio atual). Nenhuma ref foi enviada/modificada no GitHub.

**Não é possível confirmar o item “ausência de credenciais, .env e temporários no histórico”.** `.env.backup`, introduzido em dfdf0a5 antes dos nove commits, contém DATABASE_URL com senha, NEXTAUTH_SECRET, TOKENS_SECRET e META_APP_SECRET não-placeholder. Validade externa não foi testada; tratar como candidatos sensíveis até confirmação de revogação/rotação pelo responsável. Campos de API Chatwoot/Gemini desse arquivo são placeholders em português e não foram contados como vazamentos comprovados. `.env.example` é template, não arquivo local adicionado pelo incremento.

Varredura de 1.576 blobs alcançáveis: correspondências dos quatro candidatos acima apenas no blob antigo de .env.backup; zero novas correspondências desses valores e zero novos padrões de chave privada/token GitHub/Google/AWS nos objetos dos nove commits. Nenhum caminho .env, dump, chave, log ou helper temporário foi adicionado pelos nove. Isso é scanner heurístico + comparação exata, não prova universal de ausência de segredos/PII/dados de produção. No histórico anterior também há build.log e src/app/(app)/leads/page.tsx.backup; não atribuir sua inclusão aos nove. Não foi identificado dump de produção novo; a ausência absoluta de dados de produção no histórico não foi certificada. Nomes/blobs e metadados, sem valores, constam de history-audit.json/env-history-metadata.json fora do Git.

O primeiro push foi interrompido preventivamente por falha dessa condição de segurança, não por divergência remota ou rejeição de aprovação automática. Não se removeu arquivo histórico nem se reescreveram commits: exclusão no HEAD não limpa ancestrais. Saneamento real exige decisão separada, coordenação de refs/colaboradores e rotação quando aplicável; não é autorizado implicitamente pela solicitação de PR. Plano e texto da PR estão em [preparação da PR Draft](BLOCK2_DRAFT_PR_REVIEW_REQUEST_2026-10-20.md).

### Verificações repetidas, sem produção

Evidências atuais: `/workspace/mds-crm-onboarding-evidence/independent/`. O HEAD funcional acima é o alvo dos testes; as mudanças posteriores são documentação/evidência e gatilhos CI, com YAML validado e regressão de segurança repetida. Node local é 24; workflows usam 22, ainda não executados neste SHA. Não confundir equivalência de comandos com CI GitHub aprovada.

| Verificação | Resultado real |
| --- | --- |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, DB local explícito | **101 PASS**, zero fail/skip/TODO; node-tests.tap |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, zero fail/skip/TODO; tsx-tests.log |
| `npm run build` | PASS; build.log |
| `npx tsc --noEmit` após o build, alteração gerada next-env.d.ts restaurada | PASS; typecheck.log |
| `npx prisma validate` e migrate diff schema local `--exit-code` | PASS, diff vazio; prisma-validate.log/prisma-diff.log; nenhuma migration executada nesta rodada |
| Reinício do build por `npx next start` sem prestart; smoke HTTP real | **22 PASS**, incluindo login, tenants, IDOR, restrição de papel, rate limit e agenda concorrente; http-smoke-results.json |
| `npm run lint -- --output-file .../lint.json --format json` | Retorno1, **182 erros/77 avisos**; zero diagnósticos novos por âncora de código contra cb1884e |
| Auditoria atual `npm audit --json` | Retorno1, **46 pacotes: 0 críticos,40 altos,3 moderados,3 baixos**; npm-audit.json |
| Auditoria da base, mesmo momento, lock isolado fora do checkout (`--package-lock-only --ignore-scripts`) | Retorno1, **49 pacotes: 2 críticos,37 altos,8 moderados,2 baixos**; npm-audit-base-current.json |
| YAML dos quatro workflows e permissões | PASS; pull_request somente contra feature/modular-plans-entitlements, contents:read, sem pull_request_target, jobs de teste existentes preservados |
| `npm run test:security` após preparar gatilhos | **12 PASS**; security-workflow-followup.log; não substitui suites funcionais |
| Boundary/inventário de autorização após preparar gatilhos | PASS; boundary-followup.log; controles protegidos preservados |
| Limpeza final PostgreSQL | Zero organizations/OAuth states/receipts/Widget operations; database-cleanup.log |

O resultado atual **46 substitui o agregado17 anterior para esta execução**;17 permanece evidência histórica. O lock não foi alterado nesta rodada. A agregação npm inclui metavulnerabilidades propagadas; não foi presumida publicação de29 advisories novos. Comparação pareada atual: nenhum pacote sinalizado novo e nenhuma URL de advisory direto nova; nanoid/sharp/uuid deixaram a lista. Os 17 pacotes históricos têm versões idênticas às da base. Next/NextAuth/PostCSS alterados anteriormente mantêm riscos herdados, já existentes. Não se afirmou que todo aviso restante é inalcançável ou que ausência de pacote novo prove ausência de regressão funcional.

A [classificação de riscos](BLOCK2_INDEPENDENT_RISK_REGISTER_2026-10-20.md) detalha os182 erros e77 avisos por regra, os17 pacotes históricos por versão/cadeia/impacto, e o agregado atual. [Registro sanitizado por diagnóstico e pacote](evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json) permite revisão sem depender de helpers ignorados. Todos259 diagnósticos restantes já têm âncora no candidato original;44 estão em fronteiras sensíveis, prioridade de revisão, não44 vulnerabilidades comprovadas. Nenhuma atualização em massa ou exceção de lint foi feita.

### GitHub Actions e revisão independente

Consulta real à API: C03-C04 Security Regression da **base cb1884e** terminou success, run [39364369568](https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/runs/39364369568). Runs anteriores de outros SHAs incluem falhas; não foram atribuídas ao HEAD atual. A branch audit retornou **zero runs**. Não houve workflow_dispatch, porque a branch/commit não foi enviado. Não existe aprovação CI do HEAD local.

Os quatro workflows existentes antes desta rodada só disparavam em push da branch feature ou manualmente. Foram preparados eventos pull_request contra a base, sem segredos reais, escrita de conteúdo ou jobs de deploy. Abrir Draft PR futuramente deverá permitir os jobs de autorização, handlers/PostgreSQL, C03-C04 e build, sujeito às políticas/ativação do GitHub. Nada foi disparado agora nem descrito como verde.

**Pedido formal de revisão ainda não enviado.** A API de colaboradores retornou somente mundodigitalsolucoes, a própria conta autenticada, e não há CODEOWNERS rastreado. Nenhuma pessoa distinta foi identificada para solicitar review, e não se tentou autoaprovação. O texto com escopo G1–G6 e prioridades está pronto no documento de PR; é necessário indicar reviewer/time independente com acesso após tratar o bloqueio histórico. Não foram criados issue, e-mail ou mensagem externa alternativos.

| Gate | Atualização nesta rodada | Estado |
| --- | --- | --- |
| G1 | Suites de autenticação/tokens e login HTTP repetidos positivos | Sem aprovação formal; browser/e-mail e revisão independente pendentes |
| G2 | Patches dos guards e classificação de métodos/riscos revisados; regressões positivas | Sem aprovação formal; revisão independente de caminhos indiretos/exceções pendente |
| G3 | 16 casos Widget funcionais incluídos na suite positiva, isolamento e vínculos preservados | Sem aprovação; providers reais e procedimento de resultado remoto incerto pendentes |
| G4 | Nove casos funcionais PostgreSQL de state/assinatura/replay repetidos positivos | Sem aprovação; Meta real, retenção/reconciliação operacional e revisão independente pendentes |
| G5 | Sem alteração de observe_only ou APPROVED_ENFORCEMENTS vazio | Sem aprovação formal; nenhum enforcement ativado |
| G6 | Revisão dos nove, build/typecheck/testes e pacote de revisão local concluídos | **Bloqueado** por histórico sensível/artefatos antigos, lint global,46 pacotes sinalizados, ausência de CI deste SHA e reviewer independente |

Não houve merge, push, deploy, publicação ou migrations em produção; nem alteração de serviços/credenciais reais. Para prosseguir no GitHub, o responsável deve decidir tratamento de `.env.backup` histórico e confirmar rotação/revogação quando aplicável, além de indicar revisor distinto. Sem essa decisão, não se afirma condição satisfatória para o envio condicionado. A verificação remota deverá ser repetida imediatamente antes do primeiro push e qualquer divergência interromperá o envio.

---

## Adendo — retomada autorizada e candidata saneada, 20/10/2026 (America/Sao_Paulo)

**Decisão: candidata preparada para revisão local, Bloco 02 ainda NÃO HOMOLOGADO. Nenhum gate formalmente aprovado.** O responsável confirmou que `.env.backup` foi criado intencionalmente para testes e que os valores atuais conferidos no Coolify são diferentes ou ausentes. Essa informação permite continuar a homologação sem rotação indiscriminada de produção. Não é prova técnica de que valores antigos estejam revogados em todos os serviços. Nenhuma alteração de credenciais/Coolify/produção foi feita.

### Preservação, credenciais e saneamento

`audit/block2-closure` permanece exatamente em **59da966edfcc627c074b8c47a8bb50c314ad90a3**, conservando todos os commits originais. A nova ref local **audit/block2-sanitized** contém a linhagem filtrada. Base local saneada: **8aa1db0b893b042967c3905a3582916b713cf9ab**, ref `audit/block2-sanitized-base`. Código/testes verificados: **cf45f38edbef8c475c90d801b0d75423b1e1499d**; o commit deste adendo acrescenta apenas documentação/evidências. HEAD final é identificado por `git log -1` e execution-record.json, sem referência circular.

Git-filter-repo2.47.0 foi executado somente sobre a ref candidata, sem reescrever branches remotas ou a auditoria original. Foram eliminados dos ancestrais da candidata `.env.backup`, `build.log` e o backup antigo de leads. Conferidas **783 correspondências de árvore**: no passo de filtragem, a única diferença era esses três caminhos. As dez correções/documentações originais possuem equivalentes com mesmo conteúdo funcional. [Mapa de linhagem](evidence/BLOCK2_SANITIZED_LINEAGE_2026-10-20.json). SHAs ancestrais mudaram; dois baselines nos testes foram remapeados para commits de conteúdo equivalente e todas as asserções foram mantidas. Não houve alteração de core, contratos comerciais, lock, schema ou migrations nesta retomada. A correção nova do Widget abaixo é a única alteração funcional adicional.

A varredura da linhagem candidata não encontrou os quatro valores expostos nem padrões de chave privada/GitHub/Google/AWS. `.env.example` permanece como template. Não se certificou ausência universal de segredo de formato desconhecido ou PII. As refs antigas continuam intencionalmente no repositório local e o histórico público permanece inalterado: **não enviar --all, --mirror, tags ou a branch antiga**.

Comparação por HMAC efêmero, com chave e impressões digitais somente em memória, inclusive busca de coincidências em outros nomes de variáveis locais: DATABASE_URL/NEXTAUTH_SECRET/TOKENS_SECRET diferentes; chave AES efetiva também diferente; META_APP_SECRET ausente; nenhuma coincidência nas configurações locais disponíveis. O nome operacional Instagram no código é META_INSTAGRAM_APP_SECRET, que também deve ser considerado na verificação manual de ambientes. Coolify/providers não estão vinculados às ferramentas desta sessão; nenhuma sondagem com as credenciais antigas foi feita. **Validade em serviços externos não acessíveis: indeterminada.** Não foi declarada atividade nem revogação global sem prova. Declaração do responsável e comparações são registradas separadamente no [resumo sanitizado](evidence/BLOCK2_SANITIZED_VALIDATION_2026-10-20.json).

### Corrida do Widget reproduzida e corrigida

A primeira reexecução completa registrou **100 PASS/1 FAIL**. O perdedor da reserva durável podia persistir erro no JSON ainda original antes do CAS do criador, impedindo a criação (zero POST em vez de um). Não foi observada duplicação nesse caso, mas era falha de disponibilidade do mesmo fluxo do Bloco 02. O novo teste determinístico pausa o criador antes do CAS, executa o perdedor e comprova a invalidação antes da correção.

Correção mínima em ae77a5d: resposta WIDGET_INBOX_RECONCILIATION_REQUIRED sem posse da reserva não persiste erro nos settings compartilhados. Reserva durável, autorização, identidade remota e bloqueio de resultado incerto permanecem. O teste exige HTTP409 do perdedor, snapshot intacto, HTTP200 do criador e exatamente um POST; **17 testes funcionais Widget passaram**. Nenhuma asserção/TODO foi removida.

Uma segunda execução teve **101 PASS/1 FAIL** somente por regex estática que exigia indentação de seis espaços em expectedSettings. cf45f38 passou a conferir o argumento dentro da chamada persistRuntimeError independentemente da indentação; preserva a condição CAS e não relaxa controle de acesso. O resultado final é **102 PASS**, zero falha/skip/TODO. Logs das duas falhas foram mantidos em resumption/node-tests.tap, widget-race-before.log e node-tests-source-assert-before.tap, separados do resultado final.

### Verificações finais nesta candidata

Artefatos: `/workspace/mds-crm-onboarding-evidence/resumption/`. Código/testes correspondem a cf45f38; documentação/evidências posteriores não alteram runtime. Segredos e hashes de segredos não foram colocados em Git, documentos ou logs. Somente PostgreSQL descartável loopback mds_crm_dev e providers simulados nos testes de handlers. Smoke usa sessões HTTP reais com dados fictícios.

| Comando/verificação | Resultado real e evidência |
| --- | --- |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | **102 PASS**, zero fail/skip/TODO; node-tests-final.tap |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, zero fail/skip/TODO; tsx-tests-final.log |
| Suite funcional Widget isolada | **17 PASS**; widget-race-after.log; novo caso determinístico falhou antes |
| `npm run build` após correção funcional | PASS Next16.3.8; build-final.log |
| `npx tsc --noEmit` após build | PASS; typecheck-final.log; next-env.d.ts gerado restaurado |
| Prisma validate e migrate diff local `--exit-code` | PASS, diff vazio; prisma-validate.log/prisma-diff.log; nenhuma migration aplicada nesta rodada |
| `npx prisma migrate status` | Retorno1 esperado pelas duas migrations MDS históricas de dados ainda pendentes; migrate-status.log |
| `npx next start`, sem npm start/prestart, e smoke autenticado | **22 PASS**, login sem500, IDOR/tenant/assignee/permissão, rate limit e um201/sete409 na agenda concorrente; http-smoke-results.json |
| ESLint dos quatro arquivos de código/teste alterados no saneamento/correção | PASS; scoped-lint-final.log |
| `npm run lint -- --output-file .../lint.json --format json` | Retorno1, **182 erros/77 avisos**, nenhum diagnóstico novo por âncora; lint.json |
| `npm audit --json` | Retorno1, **46 pacotes:0 críticos/40 altos/3 moderados/3 baixos**; npm-audit.json |
| Auditoria repetida do lock original, fora do checkout, `--package-lock-only --ignore-scripts` | Retorno1,49 pacotes/2 críticos; npm-audit-base-current.json; nenhum pacote sinalizado novo na candidata |
| Revisão G2 por método repetida |116 arquivos,177 métodos,50 páginas/layouts,zero não classificados; g2-review.json; revisão estática não prova todos os ramos |
| Quatro workflows YAML | PASS, permissões read-only e gatilhos PR preservados; nenhum job remoto executado |
| Bundle de candidata/base importado em bare separado, sem objetos compartilhados | PASS: baselines saneados disponíveis, objeto da auditoria antiga ausente, caminhos removidos e valores expostos não alcançáveis; standalone-bundle-check.json |
| Limpeza final PostgreSQL | Zero organizations/OAuth states/receipts/Widget operations de teste; database-cleanup.log |

O registro individual de **182 erros/77 avisos** e **46 pacotes** foi atualizado para a candidata saneada: [riscos](BLOCK2_INDEPENDENT_RISK_REGISTER_2026-10-20.md), [dados por diagnóstico/pacote](evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json). Continuam44 diagnósticos em fronteiras sensíveis, não44 vulnerabilidades comprovadas. Nenhuma regra desativada nem atualização em massa. O17 anterior permanece apenas snapshot histórico. Aviso images.domains legado permanece risco/configuração a revisar; nenhum exploit foi executado.

### G1–G6 e condições de aceite restantes

| Gate | Verificação concluída no escopo autorizado | Pendência para aceite formal |
| --- | --- | --- |
| G1 | Login HTTP real e suites de admin, sessões, reset/tokens/convites/concorrência positivos | Browser/e-mail reais e revisão independente; logout não certificado como revogação de JWT roubado |
| G2 | Revisão por método repetida; guards/papel atual e54 combinações negativas/18 legítimas de recursos pessoais positivos | Revisão independente de ramos/recursos indiretos e exceções públicas; classificação não é autorização de produto |
| G3 | Multi-tenant/providers simulados positivos;17 testes funcionais Widget, inclusive novo interleaving determinístico | Providers reais isolados, referências legadas e procedimento de resultado sem ID ainda sem homologação |
| G4 | Nove testes reais PostgreSQL de nonce, callback, assinatura, replay e isolamento incluídos na suite positiva | Meta real, retenção/limpeza e operação de pending/remote_unknown ainda sem aceite |
| G5 | Suites de entitlements/boundary positivas; observe_only e APPROVED_ENFORCEMENTS vazio confirmados | Aceite independente da matriz/legado; nenhum enforcement autorizado ou ativado |
| G6 | Candidata saneada portável, testes/typecheck/build/smoke e documentação concluídos localmente | Lint/dependências, reviewer independente, CI do SHA enviado e decisão de destino/base/promover continuam pendentes |

Nenhum gate foi marcado aprovado. As pendências externas não foram substituídas por testes de código-fonte ou pela confirmação do arquivo de testes. Não há acesso autorizado a providers reais isolados nesta sessão para certificar esses fluxos; nenhuma operação de produção foi tentada.

### Apresentação para autorização de envio — nada enviado

Candidata **audit/block2-sanitized**, base local **audit/block2-sanitized-base**. Bundle local inclui exclusivamente essas duas refs, não a auditoria antiga. O SHA final está no commit deste relatório e execution-record.json. A base remota feature/modular-plans-entitlements foi novamente consultada e continua em cb1884e; nenhuma branch audit remota foi encontrada. Nenhuma divergência remota foi incorporada ou resolvida automaticamente.

**Uma PR direta contra a base pública não saneada não é o plano proposto:** a reescrita muda o merge-base, mistura linhagens e não remove a exposição nas outras refs públicas. Para envio futuro, autorizar um destino isolado com ambas as refs saneadas ou um plano separado/coordenado de saneamento da base remota. Os quatro workflows ainda filtram PRs para feature/modular-plans-entitlements; se for escolhido outro nome de base, ajustar e validar o filtro antes do envio. Não criar repositório, alterar base remota ou enviar refs sem a nova autorização. Mesmo eventual envio da candidata não limpa sozinho histórico público/caches/PRs antigos.

Parecer solicitado a uma pessoa distinta deve revisar os artefatos desta candidata, casos críticos de reserva/timeout/replay/tenant, origem e alcance de lint/dependências, exceções públicas e rollback. A conta autenticada é o único colaborador conhecido; nenhum reviewer independente foi inventado, nenhum pedido remoto enviado e nenhuma autoaprovação emitida. CI da base cb1884e anteriormente verde não vale como CI desta candidata; **CI remota do SHA saneado: NÃO EXECUTADA**.

Rollback proposto para revisão, não executado: suspender o fluxo afetado antes de recuar, preservar identidades/recibos duráveis e nunca apagar pending/remote_unknown para liberar POST. Reverter a correção do perdedor da reserva reabre a falha de disponibilidade; reverter guard/dependência reabre riscos corrigidos. Tabelas aditivas devem permanecer durante eventual recuo; qualquer remoção depende de plano próprio/backup. Nenhum merge, push, deploy, migration em produção, alteração no Coolify ou enforcement comercial foi realizado.

---

## Adendo — continuidade oficial e auditoria da frente comercial, 20/10/2026

HEAD de entrada **18507ac**, árvore limpa; mesma candidata saneada. Nesta execução foram reconfirmados **102 testes Node/PostgreSQL,171 TypeScript,22 checks HTTP, build, typecheck e schema diff**, todos positivos;17 casos funcionais Widget e9 de persistência Instagram continuam incluídos. Lint global permanece182 erros/77 avisos, com diagnósticos idênticos aos anteriores; auditoria46 pacotes,zero críticos. **Nenhum gate G1–G6 formalmente aprovado.** Nenhuma fonte funcional, teste versionado, schema, dependência, provider ou política foi alterada.

As duas novas decisões documentais remotas c4cd327/12e0e67 foram lidas e incorporadas somente por conteúdo, sem importar ancestrais. O tip remoto atual é12e0e67, não cb1884e; ambos os novos commits alteram apenas um documento cada. Nada foi mesclado, rebaseado ou enviado. A origem dos documentos e as dez correspondências da auditoria original foram verificadas; core protegido e observe_only permanecem intactos.

Entregas separadas: **[A — reconfirmação do encerramento e G1–G6](BLOCK2_CLOSURE_RECONFIRMATION_2026-10-20.md)** e **[B — diferencial comercial local e menor plano de adaptação](COMMERCIAL_DIFFERENTIAL_LOCAL_AUDIT_2026-10-20.md)**. [Evidências sanitizadas de matriz/comparação](evidence/BLOCK2_COMMERCIAL_AUDIT_2026-10-20.json). Logs atuais em /workspace/mds-crm-onboarding-evidence/commercial-audit/.

Os12 arquivos comerciais comparados com a fonte remota da auditoria são idênticos. A infraestrutura já existe; faltam conexões e governança específicas. A matriz de fundamento teve14 cenários/126 decisões puras positivas, mas a Sidebar real em SSR para owner divergiu do menu contratado em12/14 casos e manteve logo MDS nos7 casos White-Label. Isso não foi descrito como frente comercial homologada. As seis suspeitas remotas foram classificadas com código local e testes de sondagem; nenhuma feature/refatoração comercial foi iniciada.

Próxima ação: revisão independente de A/B e decisão sobre base/destino saneado para futura CI. Proposta de implementação mínima está em B, sem antecipar Blocos3–5, preços/cobrança/domínio ou conectar WhatsApp real. Sem merge, push, deploy, migrations em produção, credenciais reais, mudanças no Coolify ou ativação de enforcement; APPROVED_ENFORCEMENTS vazio.

---

## Adendo — plano mínimo para aprovação e revisão crítica, 20/10/2026

Referência de entrada **f1975c9**, candidata saneada, árvore limpa. Nenhuma aplicação, schema, dependência ou enforcement foi alterado. Foram preparados [plano de arquivos/testes/commits C0–C6](COMMERCIAL_MINIMUM_EXECUTION_PLAN_2026-10-20.md), [revisão crítica verificável](BLOCK2_EVIDENCE_CRITICAL_REVIEW_2026-10-20.md) e [estratégia GitHub com duas refs novas saneadas no mesmo repositório](BLOCK2_SANITIZED_GITHUB_REVIEW_STRATEGY_2026-10-20.md).

**Novo bloqueador P1 de G1/G2:** sondagem HTTP real no build local, com NextAuth/PostgreSQL e fixture descartável, mostrou /dashboard200 com o Lead fictício ainda presente após remover usuário e após remover organização. Outro usuário com leads.view=false recebeu403 em /api/leads e200 com o Lead em /dashboard. Não foi alegado acesso cross-tenant; trata-se de identidade/permissão ignorada pelo Dashboard. Probe retorna1 por falha de segurança e não por setup. Os22 checks anteriores não cobriam essas páginas: seus PASS não provam esse caso. **Não corrigido nesta execução, pois o pedido exige plano para aprovação. C0 deve ser o primeiro commit autorizado.** Observe_only não justifica esses acessos operacionais.

Integridade dos9 artefatos anteriores confirmada, árvore funcional18507ac=f1975c9. Nova execução26 testes de contratos/boundary/inventário/observação:26 PASS, sem falha/skip/TODO. Matriz comercial repetida:14/126 fundamentos,12 divergências owner e7 logos MDS; ressalva importante: o SSR não injeta ativos de branding por tenant, portanto7 logos MDS não são7 testes completos de aplicação de marca personalizada. Fonte constante comprova a lacuna; próximos testes precisam de logos/paletas fictícios distintos.

G1/G2 agora têm bloqueador funcional explícito, não somente falta de parecer independente. G3/G4 mantêm evidências locais anteriores e pendências de provider/operacional; G5 permanece em observação e G6 não atendido. Lint182/77 e46 pacotes são resultados anteriores cuja integridade foi conferida, não nova consulta npm nesta rodada. Não há CI da candidata enviada. Nenhum gate aprovado.

Esta revisão crítica pelo agente da continuidade **não substitui parecer independente por responsável distinto**. A API de colaboradores retornou apenas a conta autenticada; nenhum reviewer foi inventado, nenhuma autoaprovação nem solicitação remota foi realizada. [Evidência sanitizada](evidence/BLOCK2_MINIMUM_PLAN_REVIEW_2026-10-20.json); logs novos em /workspace/mds-crm-onboarding-evidence/minimal-plan/.

Estratégia proposta: futura criação das refs audit/block2-sanitized e review/block2-sanitized-base(8aa1db0), PR Draft entre ambas, sem merge ou reescrita de main/feature. Os4 filtros CI precisam da nova base antes do envio; C6 cobre essa preparação. Qualquer divergência remota interrompe o procedimento. Nenhum envio é autorizado por este adendo. Plano de código, envio/PR e promoção/enforcement exigem decisões separadas; manifesto continua vazio e observe_only preservado.

## 2026-10-21 — C0 autorizado: segurança do Dashboard

Referência real confirmada: `audit/block2-sanitized`, HEAD inicial `be26c813231602e14e33c12866a9e1d9baba6781`, árvore limpa. Somente C0 implementado. Evidência versionada: `docs/evidence/BLOCK2_C0_2026-10-21.json`; contém resultados e SHA-256 dos artefatos de execução (não de segredos). Artefatos completos locais em `/workspace/mds-crm-onboarding-evidence/c0/`.

### Alteração e fronteiras

- `src/app/(app)/layout.tsx`: `checkAuth` antes da consulta de favicon, organização ativa e identificação tipada; a falha de autenticação não é absorvida pelo fallback visual.
- `src/app/(app)/dashboard/page.tsx`: validação própria por `checkAuth` (o RSC pode executar em paralelo ao layout), seguida de permissões operacionais existentes `leads/projects/tasks/os/users.view` antes das respectivas consultas. Não cria permissão Dashboard. Contagens, conversão, listas e barras de uso não são consultadas nem renderizadas sem a permissão correspondente.
- Tarefas/follow-ups excluem vínculos com Leads/Projetos não autorizados, vínculos de outra organização e responsáveis removidos ou de outro tenant. Preserva as consultas e apresentação dos recursos autorizados. O nome do responsável continua sob a autorização de tarefas, como na API existente.
- `tests/dashboard-c0.test.ts`: nove testes de execução do código real com infraestrutura isolada: nenhuma consulta a recurso negado, tenant em todas as consultas, rejeição antes de consultar no layout/página e rejeição de mudança de contexto.
- `tests/dashboard-c0-http.mjs`: teste funcional com Next compilado, NextAuth real e PostgreSQL descartável. Somente fixtures sintéticas, limpeza no finally, cookies/senha apenas em memória. Executar explicitamente; não depende da descoberta `*.test.mjs`.

### HTTP antes/depois

| Cenário | Antes (`be26c81`) | Depois C0 |
|---|---|---|
| Usuário removido com cookie anterior | 200, Lead exposto | 307 para login, Lead ausente |
| Organização removida com cookie anterior | 200, Lead exposto | 307 para login, Lead ausente |
| Usuário sem Leads | API 403; Dashboard 200 com Lead | API 403; Dashboard 200 sem Lead, indicadores de Leads ou follow-up vinculado |
| Proprietário legítimo | 200 com Lead próprio | 200 com Lead, tarefa e follow-up próprios |
| Outra organização, inclusive vínculo cruzado proposital | Não medido no probe inicial | Marcadores ausentes da resposta |

As verificações examinam o corpo HTTP completo, incluindo payload RSC, não apenas elementos visíveis. A remoção é feita antes da requisição ao Dashboard, sem chamar uma API intermediária que atualize o cookie e mascare a falha.

### Comandos e resultados

Variáveis carregadas de `.env.local` ignorado, sem imprimir valores; os testes PostgreSQL usam `BLOCK2_TEST_DATABASE_URL` apontando exclusivamente para o mesmo banco local descartável. Nenhuma migration necessária.

| Comando | Resultado |
|---|---|
| `node .cache/c0-before.cjs` | Retorno 1 esperado: reproduz os três vazamentos; `http-before.json` |
| `npm run build` | PASS, geração Prisma e build Next; aviso preexistente de `images.domains` |
| `npx next start --hostname 127.0.0.1 --port 3100` | Servidor local do build; sem `npm start`/prestart/migration |
| `node tests/dashboard-c0-http.mjs` | PASS; `http-after.json` |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | 102 PASS, zero fail/skip/TODO |
| `npx tsx --test tests/*.test.ts` | 180 PASS, zero fail/skip/TODO (171 anteriores + 9 C0) |
| `node .cache/bloco02-smoke.cjs` | 22 PASS: autenticação, administração, autorização, isolamento e concorrência |
| `npx tsc --noEmit` | PASS após restaurar somente a alteração automática de `next-env.d.ts` |
| `npx eslint` nos quatro arquivos de código/teste alterados | Zero erro/aviso |
| `npx eslint . --format json` | FAIL: 181 erros e 77 avisos, ante 182/77; removido o `any` do layout, nenhuma nova regra desativada |
| `npm audit --json` | Retorno 1: 46 alertas (40 high, 3 moderate, 3 low, zero critical); dependências intactas |
| `git diff --check` | PASS |

A primeira tentativa Node sem `--import tsx` não forneceu a execução válida dos módulos TypeScript; a execução final acima, com loader e banco explícitos, é a evidência considerada. Não houve alteração de dependências para contornar testes.

### Gates e riscos residuais

C0 corrigido e verificado localmente para os cenários acima. G1 e G2 **não aprovados**: isto não certifica todas as rotas/sessões ou todas as permissões do produto. G3/G4/G5 não recebem aprovação nova por esta entrega; os testes existentes de isolamento, Widget e Instagram foram reexecutados na suíte Node. G5 permanece `observe_only`, com `APPROVED_ENFORCEMENTS` vazio e arquivo de política intacto. G6 segue pendente de revisão independente, CI remota e demais critérios do encerramento.

O layout compartilhado agora recusa identidades inativas também nas demais páginas do grupo `(app)`; os componentes protegidos e as APIs existentes não foram modificados. Testes HTTP usam cliente sem navegador: não certificam navegação visual, cache de uma aba já aberta ou revogação retroativa de dados já enviados. A validação é por requisição e não serializa uma exclusão concorrente com todas as consultas; não equivale a revogação transacional global. Continuam pendentes lint global, dependências e homologação ampla. C1–C6 não iniciados. Sem push, merge, deploy, produção, Coolify, rotação de credenciais ou alteração de histórico. O commit desta entrega é identificável por `git log -1 --format=%H -- docs/evidence/BLOCK2_C0_2026-10-21.json`.

## 2026-10-21 — C1 + C2: navegação e indicadores contratuais

Autorização específica C1/C2 posterior ao C0; HEAD inicial confirmado `192a110025a29e2a8cd4b5bce5595165e1bfca22`, branch `audit/block2-sanitized`, árvore inicialmente limpa. Esta autorização atualiza a proposta anterior de apenas prévia contratual: **a apresentação local passa a respeitar a assinatura mesmo em observe_only**, conforme solicitado. Não promove o enforcement comercial de páginas/APIs. White-Label/C3–C6 permanecem fora do escopo.

### Arquivos e contratos reutilizados

- C1, commit `7f02b38`: `src/lib/authorization/application-context.ts` e `tests/commercial-application-context.test.ts`. Adaptador servidor sem parâmetros do cliente, sem cache global, usando checkAuth/checkPermission, getOrganizationEntitlements → resolveCommercialEntitlements → FEATURE_CATALOG e modeForOrganization. DTO serializável mínimo (identidade, módulos, decisões view e modo), sem sessão completa, tokens, configuração de integrações ou novo modelo de dados. Erro de leitura/identidade divergente falha fechado.
- C2: `src/app/(app)/layout.tsx` entrega essa projeção à Sidebar após validar novamente a identidade; `src/components/Sidebar.tsx` cruza contrato servidor e permissões existentes. Owner conserva privilégio operacional, mas nunca adiciona módulo ausente. Atendimento exige também atendimento.view; configuração de Atendimento exige contrato e integrations.view. Dashboard/Configurações/Ajuda seguem compartilhados. Follow-ups cruza leads.view e tasks.view, em vez de oferecer um link cuja API exige uma permissão ausente.
- `src/app/(app)/dashboard/page.tsx`: consulta o mesmo resolver existente antes das queries; cruza Vendas/Marketing com as permissões C0. Não duplica parser, catálogo, resolver ou authorizer. Dados negados não são buscados nem enviados ao RSC. Isolamento dos vínculos e validação independente da página C0 preservados.
- Agrupamento de apresentação mantido da Sidebar atual: Vendas = Leads/Kanban/Agenda/Follow-ups/Metas; Marketing = Projetos/OS/Tarefas/Relatórios; Atendimento independente. No Dashboard, Leads/conversão/follow-ups seguem Vendas; projetos/OS/tarefas seguem Marketing; utilização de membros permanece compartilhada sob users.view. Vínculos de tarefas com outro módulo exigem também autorização e contrato daquele recurso. Isso não redefine o contrato global de Tasks/Agenda/OS, suas APIs ou suas regras de escrita.
- Ajustes locais necessários ao lint da Sidebar: persistência de recolhimento como store do navegador com useSyncExternalStore e seções derivadas do pathname, sem setState síncrono em efeitos; cores/logo/branding intactos. As decisões servidor só são usadas quando a identidade da sessão corresponde ao DTO.
- Testes novos: `tests/commercial-sidebar.test.ts` (renderização do componente real), `tests/commercial-dashboard.test.ts` (execução da página real com spies antes de query) e `tests/commercial-dashboard-http.mjs` (HTTP real + NextAuth + PostgreSQL local).
- `tests/dashboard-c0.test.ts` recebe apenas mocks dos novos imports, preservando as asserções anteriores. A fixture de `tests/dashboard-c0-http.mjs` declara os três módulos explicitamente, evitando presumir direitos pelo plano trial. `tests/authorization-boundaries.test.ts` permite somente o **novo** adaptador C1; todos os arquivos preexistentes do motor e as fronteiras históricas continuam protegidos.

### Matriz verificável

Cada linha foi coberta por três papéis (owner/admin/user) e dois tenants: **42 cenários de contrato, 42 de markup real da Sidebar e 42 de HTTP Dashboard**. Na renderização, usuários restritos variam entre Leads negado e Tasks negado; no HTTP, usuário restrito tem Leads negado e demais permissões explícitas. Fixtures sintéticas são apagadas no finally.

| Contratado | Seções comerciais na navegação | Indicadores comerciais do Dashboard, sujeitos a view e vínculos |
|---|---|---|
| Atendimento | Atendimento | Nenhum indicador de Vendas/Marketing |
| Vendas | Vendas | Leads, conversão e follow-ups |
| Marketing | Marketing | Projetos, OS e tarefas |
| Atendimento + Vendas | Atendimento, Vendas | Vendas |
| Atendimento + Marketing | Atendimento, Marketing | Marketing |
| Vendas + Marketing | Vendas, Marketing | Vendas e Marketing |
| Atendimento + Vendas + Marketing | Todas | Vendas e Marketing |

O cenário legado é reproduzido com snapshot explícito dos três módulos; não certifica o cadastro de cada cliente MDS existente. Recursos compartilhados continuam sob suas permissões. Configuração vazia, JSON inválido ou só White-Label/módulo planejado não gera módulos por fallback de plano/owner (três cenários HTTP adicionais). White-Label não vira módulo nem altera branding.

### Execuções e evidências

Evidência versionada: `docs/evidence/BLOCK2_C1_C2_2026-10-21.json`, com a matriz individual, resultados C0, hashes dos quatro arquivos de implementação e dos artefatos. Logs completos em `/workspace/mds-crm-onboarding-evidence/c1-c2/`. Hashes são de arquivos de código/evidência, não de credenciais.

| Comando | Resultado final |
|---|---|
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, BLOCK2_TEST_DATABASE_URL local explícito | 102 PASS; zero fail/skip/TODO |
| `npx tsx --test tests/*.test.ts` | 281 PASS; zero fail/skip/TODO: 180 anteriores + 45 contexto + 42 Sidebar + 14 seleção de queries |
| `npm run build` | PASS, Prisma generate e Next build; sem migration; aviso preexistente images.domains |
| `npx next start --hostname 127.0.0.1 --port 3100` | Build final no loopback; não utiliza prestart |
| `node tests/commercial-dashboard-http.mjs` | 42 cenários PASS + 3 configurações inválidas; 28 GETs diretos /leads e /projects com owner permanecem 200 em observe_only |
| `node tests/dashboard-c0-http.mjs` | PASS: removidos → 307 sem dados, Leads negado → API 403 e Dashboard sem Leads; dados próprios e isolamento preservados |
| `node .cache/bloco02-smoke.cjs` | 22 PASS, incluindo autenticação, tenant, mass assignment, concorrência, sessão forjada e limitação de tentativas |
| `npx tsc --noEmit` após restaurar somente next-env.d.ts gerado | PASS |
| `npx eslint` nos arquivos de implementação/teste alterados | Zero erros; um aviso preexistente no img da Sidebar; nenhuma regra desativada |
| `git diff --check` | PASS |

A primeira suíte TS detectou a fronteira histórica que também abrangia arquivos novos; a exceção nominal do adaptador autorizado resolveu a incompatibilidade sem liberar o motor existente. A primeira matriz HTTP não obteve a sessão de fixture (TypeError em login, antes dos cenários); o cliente foi corrigido com asserção explícita de sessão e IP fictício separado por cliente, como a regressão HTTP existente. A causa exata daquela sessão ausente não foi certificada; os resultados finais foram obtidos isoladamente no build final. Falhas iniciais não são contadas como cenários aprovados.

### Limitações, gates e rollback

- Sem testes de browser completo: Sidebar renderizada de verdade com infraestrutura de sessão/rotas simulada; Dashboard/APIs testados por HTTP real. Recolhimento mobile, persistência entre abas e atualização de menu numa sessão já aberta exigem homologação visual. Mudanças de assinatura exigem nova renderização/refresh do layout; não foi adicionado mecanismo global de invalidação.
- Contratos legados sem módulos explícitos deixam de exibir módulos/indicadores na apresentação. Isso segue o resolver e a autorização atual; inventário de cadastros reais continua necessário antes da publicação. Nenhuma assinatura foi alterada por este lote.
- URLs e APIs continuam sob os controles existentes em observe_only: esconder navegação não certifica bloqueio de acesso direto. C5 não iniciado. G1/G2/G3/G4/G5/G6 não recebem aprovação formal por estes resultados; revisão independente e CI remota permanecem pendentes. Alertas globais de lint/dependências registrados no C0 não foram resolvidos neste lote.
- Core protegido, providers, schema, migrations, motor comercial, catálogo/resolver, manifesto e APIs permaneceram intactos. APPROVED_ENFORCEMENTS segue vazio. Nenhuma credencial, .env ou artefato temporário integra os commits; evidência versionada contém só resultados/metadados sem segredos.
- Rollback proposto, não executado: reverter o commit C2 restaura a apresentação do C0; depois reverter C1 remove o adaptador sem consumidores. Preservar C0. Sem mudança de dados a desfazer. O commit C2 é identificável por `git log -1 --format=%H -- docs/evidence/BLOCK2_C1_C2_2026-10-21.json`.
- Sem push, merge, deploy, produção, Coolify ou migrations. C3–C6 não iniciados.

## 2026-10-21 — C3 + C4: White-Label existente e governança MDS

HEAD inicial real `d626bffe6596f455a598465c7027a606ba18fa50`, branch `audit/block2-sanitized`, árvore inicialmente limpa. Preservados C0 (`192a110`), C1 (`7f02b38`) e C2 (`d626bff`). Execução exclusivamente local e restrita a C3/C4. C3: commit `39facc0`. O commit C4 desta entrega é identificável por `git log -1 --format=%H -- docs/evidence/BLOCK2_C3_C4_2026-10-21.json`.

### Política verificada antes de restringir operações

A API existente de organizações permite editar nome/logo/favicon/cores a owner/admin com `settings.edit`; essa política **foi preservada**, inclusive sem White-Label. Esses campos não habilitam capacidade comercial. Apenas o snapshot explícito `Organization.features`, interpretado pelo resolver existente, habilita `white_label`. Nome do plano, papel elevado ou escolha de cores não concedem essa capacidade. Sem White-Label o shell aplica MDS, mas conserva as configurações armazenadas para uma habilitação futura. O nome empresarial continua no campo existente, sem criar um segundo modelo de identidade.

A MDS já controla planos e sincronização de features por autenticação Super Admin separada. C4 acrescenta uma operação explícita e isolada de habilitar/desabilitar somente `white_label` no editor administrativo atual, sem editor de planos paralelo nem campo novo no banco. Clientes não podem usar essa administração nem gravar `features/whiteLabel` pela API tenant. Configurações operacionais autorizadas continuam disponíveis.

### Arquivos de implementação

| Escopo | Arquivos e alteração |
|---|---|
| C3 — helper existente | `src/lib/branding.ts`: lê organização ativa do tenant validado, resolve a capacidade comercial pelo resolver existente e retorna marca MDS ou valores sanitizados. Sem cache global ou busca de imagens no servidor |
| C3 — valores e validação compartilhados | `src/lib/branding-values.ts`: move o contrato OrgBranding existente, defaults MDS reais, validação de assets e CSS seguro para um módulo puro reutilizável. `src/lib/validations/branding.ts`: schema estrito da edição existente; aceita HTTPS sem credenciais ou caminhos locais seguros, cores hex6; rejeita campos comerciais/injeção |
| C3 — shell atual | `src/app/(app)/layout.tsx`: reutiliza o helper, mantém checkAuth/contexto C1, aplica favicon, CSS e metadata; `src/components/Sidebar.tsx`: recebe logo/nome/cores da mesma organização e preserva a seleção comercial C2. `src/app/(app)/dashboard/page.tsx`: somente título passa a herdar a marca, sem mudanças nas consultas ou permissões |
| C3 — aparência existente | `src/app/(app)/settings/branding/page.tsx`: informa a capacidade comercial, mantém edição e preview local, remove o preview global que alterava CSS da aplicação antes de salvar e usa os defaults canônicos no reset. O favicon efetivo é aplicado pelo layout após reload, não pelo formulário sem verificar capacidade |
| C3/C4 — API tenant existente | `src/app/api/organizations/route.ts`: reutiliza schema seguro, mantém permissões e role atuais; GET informa whiteLabelActive sem expor features brutas. PATCH não aceita autoativação nem organização arbitrária |
| C4 — administração existente | `src/lib/validations/admin.ts`: somente o boolean opcional whiteLabel foi acrescentado ao schema estrito. `src/app/api/admin/organizations/[id]/route.ts`: PUT exige Super Admin, aceita a alteração comercial separadamente, preserva todos os demais identificadores, usa CAS no snapshot e transação com auditoria; contratos inválidos/inativos/conflitantes retornam 409. DELETE e providers byte a byte preservados |
| C4 — editor atual MDS | `src/components/OrganizationWhiteLabelControl.tsx`, embutido em `src/app/admin/organizations/page.tsx`: lê contrato atual e salva somente whiteLabel, sem syncFromPlan. O operador é avisado de que uma sincronização posterior do plano pode substituir o snapshot, conforme o comportamento administrativo já existente |

Ajustes de lint ficaram nas telas alteradas: carregamento assíncrono com cancelamento de respostas obsoletas, tipos explícitos e remoção de setState síncrono em efeitos. Busca, paginação, edição, exclusão e salvamento do editor administrativo mantêm os handlers existentes; sua homologação visual completa não foi substituída por testes HTTP.

### Testes e evidência funcional

Evidência versionada: `docs/evidence/BLOCK2_C3_C4_2026-10-21.json`; contém cada cenário HTTP, negações comerciais, resultados C0, contagens, hashes dos arquivos e dos logs. Artefatos completos em `/workspace/mds-crm-onboarding-evidence/c3-c4/`. Hashes são de código/evidências, não de segredos.

| Matriz/caso | Evidência e resultado |
|---|---|
| Sete combinações não vazias de Atendimento/Vendas/Marketing × MDS/White-Label × owner/admin/user × dois tenants | **84 cenários** de execução do helper e renderização da Sidebar real; **84 cenários HTTP** de Dashboard com autenticação real. Capability independente dos módulos; logo/alt/cores/favicon do tenant correto; MDS sem adicional |
| Persistência e governança | Owner/admin efetuam quatro PATCHs visuais autorizados, com persistência verificada. Usuário comum é recusado mesmo com settings.edit concedido na fixture, preservando a regra de papel existente. Campos features/whiteLabel, organização arbitrária e URL com credenciais são rejeitados |
| Administração comercial por cliente | Seis tentativas, três papéis × dois tenants: HTTP **307 para /admin/login**, sem acesso à operação Super Admin. A asserção inicial esperava 401 e falhou; foi corrigida para comprovar a negação real da camada de middleware existente e o destino exato, sem mudar o produto |
| Super Admin real | Login separado em `/api/admin/auth`, cookie administrativo real, **29 alterações comerciais auditadas**; white_label isolado, módulos e identificadores legados preservados. Contrato inválido e alteração combinada com plano são recusados |
| Concorrência e falha de auditoria em PostgreSQL | Três testes de execução do PUT real: CAS perdido → 409 sem sobrescrever módulos; falha da auditoria → 500 com rollback da capacidade; sucesso conserva identificador opaco e registra ator Super Admin com userId nulo. Organização removida → 409 |
| Imagens e favicon | Quatro recuperações de assets locais com HTTP 200, usando arquivos/URLs distintos por tenant. Testes de renderização verificam src/alt/cores; HTTP verifica CSS, favicon e prop de logo entregue à Sidebar. Não são imagens de clientes reais |
| C0 | Usuário removido e organização removida: **307 sem Lead**. Usuário sem Leads: API **403**, Dashboard **200 sem Lead/indicadores**; dados autorizados e isolamento mantidos |
| C1/C2 | **42 cenários HTTP** comerciais + três configurações inválidas; **28 acessos diretos** a Leads/Projetos preservam observe_only. A renderização contratual/permissões existente também foi reexecutada na suíte TS |
| Regressão geral | **22 cenários HTTP PASS**, incluindo sessões, administração, tenant, mass assignment, permissões, concorrência de agenda e limitação de tentativas |

Testes adicionados: `tests/branding-presentation.test.ts`, `tests/branding-governance-postgres.test.mjs`, `tests/branding-white-label-http.mjs`. Ajustados `tests/dashboard-c0.test.ts` e `tests/commercial-sidebar.test.ts` apenas para os imports novos. Em `tests/authorization-boundaries.test.ts`, a exceção do novo schema de branding e da alteração administrativa autorizada é limitada por asserção adicional: o schema admin deve ser idêntico ao anterior removendo somente a linha whiteLabel; o DELETE deve permanecer byte a byte idêntico.

### Comandos finais e resultados

Execução com Node **v24.19.0**, Next compilado e PostgreSQL descartável de loopback. `.env.local` ignorado foi carregado sem impressão; o servidor local usou chave administrativa de teste gerada em memória, e fixtures/credenciais sintéticas foram removidas. Não certifica Node 22/CI remoto.

| Comando | Resultado |
|---|---|
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, BLOCK2_TEST_DATABASE_URL local explícito | **105 PASS**, zero fail/skip/TODO (102 anteriores + 3 governança) |
| `npx tsx --test tests/*.test.ts` | **368 PASS**, zero fail/skip/TODO (281 anteriores + 85 branding/validação + 2 fronteiras) |
| `npm run build` | PASS; gera Prisma Client e build Next, não executa migrations; permanece aviso preexistente images.domains |
| `npx next start --hostname 127.0.0.1 --port 3100` | Servidor local do build final; sem npm start/prestart |
| `node tests/branding-white-label-http.mjs` | PASS; 84 cenários + governança, persistência, assets e auditoria |
| `node tests/dashboard-c0-http.mjs` | PASS no build final; o probe conserva o campo histórico de referência be26c81, mas esta execução está vinculada ao manifesto C3/C4 |
| `node tests/commercial-dashboard-http.mjs` | PASS: 42 cenários + configurações inválidas e URLs diretas |
| `node .cache/bloco02-smoke.cjs` | 22 PASS |
| `npx tsc --noEmit` após restaurar somente next-env.d.ts gerado | PASS |
| `npx eslint` nos arquivos alterados | **Zero erros, oito avisos preexistentes**: três img e cinco variáveis da sincronização de plano anterior; nenhuma regra desativada |
| Verificação das fixtures após o último teste | Zero organizações branding/governance/commercial e zero Super Admins de teste restantes |
| Diff do core/policy/providers/schema/Leads/Kanban contra d626bff e `git diff --check` | Diff protegido vazio e verificação sem erros; DELETE adicionalmente testado |

As primeiras verificações de lint detectaram efeitos síncronos já existentes nas telas editadas; foram corrigidos localmente. A primeira expectativa HTTP 401 para administração foi substituída por prova do redirect de negação existente. Esses resultados iniciais não foram contados como cenários aprovados.

### Limitações, riscos residuais e gates

- Sem navegador completo ou homologação visual humana: não certifica cache de favicon, foco do editor de cores, contraste de toda combinação customizada, troca entre abas ou todos os fluxos visuais da administração. A prova combina renderização real dos componentes com infraestrutura simulada e HTTP real da aplicação; não é apenas teste de código-fonte.
- Branding é aplicado ao shell autenticado, CSS compartilhado, logo/alt e metadata, incluindo Dashboard. Login público, domínio próprio, estilos/títulos literais de páginas operacionais protegidas e identidade interna do Chatwoot/WhatsApp permanecem fora deste lote. Não houve reconstrução operacional.
- Snapshots legados sem white_label explícito exibem MDS; assets armazenados são preservados. Inventariar contratos reais antes da publicação, sem inferir direitos pelo plano/papel. Uma sincronização administrativa de plano continua podendo substituir features; o operador MDS recebe aviso. Contratos malformados exigem revisão antes do toggle.
- Assinatura/branding precisam de reload para refletir uma alteração em uma aba já aberta; não foi criado cache global nem mecanismo novo de invalidação. O preview fica local à página, sem contaminar CSS global ou favicon de outra organização.
- Dependências não foram alteradas; os alertas de lint/dependências globais documentados anteriormente continuam pendentes e não foram auditados novamente neste lote.
- G1/G2: regressões e negativos C0/C4 comprovados localmente, **sem aprovação integral**. G3: isolamento de branding comprovado em dois tenants, sem substituir homologação de providers. G4: suíte existente Instagram/PostgreSQL passou, sem nova aprovação. G5: apresentação White-Label e autoridade MDS verificadas; `observe_only` e `APPROVED_ENFORCEMENTS` vazio preservados. G6: revisão independente, CI remota e homologação visual permanecem pendentes. **Nenhum gate G1–G6 é declarado aprovado por C3/C4.**
- Sem push, merge, deploy, produção, Coolify ou migrations; sem C5–C6. Nenhum arquivo .env, credencial real, dado de produção ou log temporário foi adicionado aos commits. As strings adversariais de testes e credenciais geradas em memória são exclusivamente sintéticas.

Rollback proposto, não executado: reverter C4 e depois C3 para retornar ao C2, preservando C0 e dados existentes; não há schema/migration a desfazer. A capacidade pode ser desabilitada por operação MDS autenticada, com auditoria, sem apagar assets, caso essa ação seja autorizada no ambiente alvo. A política comercial global não foi promovida por este lote.

## 2026-10-21 — C5: auditoria de URLs/APIs; aceite de segurança reprovado

Referência real: `audit/block2-sanitized`, HEAD inicial `5f0f8a9905be91aa1e68ccd00e9602c346e6a5ee`, árvore inicialmente limpa. C0–C4 e seus commits foram preservados. **Rollout bloqueado.** A aplicação e o motor comercial permaneceram idênticos a esse HEAD; as falhas abaixo já estavam presentes no início da auditoria. C5 acrescenta inventário, testes e evidência, sem correção dos handlers.

Matriz completa, classificações por operação e plano de correção: [BLOCK2_C5_ACCESS_AUDIT_2026-10-21.md](BLOCK2_C5_ACCESS_AUDIT_2026-10-21.md). Manifestos: `docs/evidence/BLOCK2_C5_SURFACES_2026-10-21.json` e `docs/evidence/BLOCK2_C5_RESULTS_2026-10-21.json`. Artefatos completos: `/workspace/mds-crm-onboarding-evidence/c5/`. Hashes referem-se a código/evidências, nunca a credenciais.

### Falhas confirmadas

1. **C5-01 — P1, isolamento de relações:** Tarefas e OS aceitam referências estrangeiras apesar do filtro tenant na entidade principal. Três papéis autorizados no recurso principal reproduziram **30 gravações HTTP 201/200**, com vínculo estrangeiro persistido e dados relacionados devolvidos. **12 leituras HTTP 200** também expuseram relações estrangeiras persistidas, modelando legado inválido. Houve **nove notificações para responsável de outro tenant** na fixture. Rotas: GET/POST `/api/tasks`, GET/PUT `/api/tasks/[id]`, GET/POST `/api/os`, GET/PUT `/api/os/[id]`. Exigem validação de referências antes de escrever/notificar e proteção de leitura das relações históricas.
2. **C5-02 — P1, permissão relacionada:** em **28 cenários** o usuário sem leads.view recebe 403 de `/api/leads`, mas o nome do Lead vinculado aparece em `GET /api/tasks`. O Dashboard C0 continua sem esse dado. A autorização de Tarefas não pode certificar automaticamente todos os dados relacionados; a política por recurso precisa ser aplicada no servidor.
3. **Cobertura comercial parcial:** 116 arquivos API, 177 operações e 28 páginas inventariados. **35 operações** usam guards de módulo; **22** observam canal sem bloquear; **120** não mostram integração direta ou delegam controles, incluindo administração/plataforma/protocolos públicos, que não devem receber bloqueio comercial indiscriminado. O manifesto sozinho não cobre todo o produto.
4. **Compatibilidade antes de promoção:** permissões parciais válidas para Atendimento são negadas pelo futuro motor devido à exigência artificial da chave leads; pares compartilhados tasks/os/agenda/goals/reports não estão homologados no motor. Snapshots vazios/inválidos não herdam o plano; trial vencido e identificadores opacos têm diferenças de tratamento entre legado/módulos/canais. Não houve migração, sync automático ou alteração de contratos para ocultar essas diferenças.

### Resultados executados

| Verificação | Resultado e limite |
|---|---|
| `node tests/c5-direct-access-http.mjs` | **Exit 1 / segurança reprovada:** 84 cenários (sete conjuntos × MDS/White-Label × três papéis × dois tenants), 924 GETs de páginas, 840 leituras API, oito controles anônimos e três configurações legadas. O comportamento observe_only foi confirmado; **28 falhas** de permissão relacionada não foram tratadas como PASS |
| `node tests/c5-cross-tenant-http.mjs` | **Exit 1 / segurança reprovada:** **42 expectativas seguras falharam**, além de nove notificações estrangeiras. Sem TODO/skip. Rerodado no build final |
| `node --import tsx --test tests/c5-commercial-guards-postgres.test.mjs` | Cinco testes PASS: **1.344 requests em ambos os modos** isolados; 17 operações reais de handlers param antes de recurso/provider; identidade, permissão, tenant e diagnósticos de compatibilidade. Não equivale a testar todos os métodos com provider real |
| `npx tsx --test tests/c5-commercial-pages.test.ts` | 15 PASS: 140 chamadas de layouts reais em modos isolados + compatibilidade de identificadores |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | **110 PASS**, zero fail/skip/TODO. Os probes HTTP standalone acima são gates separados e continuam falhando; esse total não aprova C5 |
| `npx tsx --test tests/*.test.ts` | **383 PASS**, zero fail/skip/TODO |
| Regressões HTTP C0–C4 | C0 PASS, inclusive no build final: removidos 307 sem dados e permissão Leads preservada. White-Label: **84 cenários PASS**, 29 mudanças comerciais auditadas; smoke: **22 PASS**. C1/C2 também cobertos pela nova matriz contratual |
| `npm run build` e `npx tsc --noEmit` após restaurar next-env.d.ts gerado | PASS, Node v24.19.0; aviso preexistente images.domains. Sem migration |
| Lint dos cinco arquivos de código/testes adicionados | Zero erros/avisos; nenhuma regra alterada |
| Inventário legado existente, `--fixtures` / `--database` | Fixtures diagnosticadas; leitura PostgreSQL local em transação READ ONLY, com **zero organizações reais disponíveis**. Não certifica clientes ou planos de produção |
| Isolamento do estágio | `modeForOrganization` permanece observe_only. Query mode=enforce não promove HTTP real. Injeção de modo somente no VM dos testes; APPROVED_ENFORCEMENTS segue vazio |
| Limpeza e fronteiras | Zero organizações/Super Admins/atividades órfãs dos probes restantes. A limpeza corrigiu o descarte de 18 atividades sintéticas órfãs das primeiras execuções, por marcador exato no banco descartável. Diff de aplicação, schema, dependências e workflows contra 5f0f8a9 vazio |

### Arquivos, limites e próximo aceite

Adicionados `scripts/block2-c5-access-inventory.mjs`, `tests/c5-commercial-guards-postgres.test.mjs`, `tests/c5-commercial-pages.test.ts`, `tests/c5-direct-access-http.mjs`, `tests/c5-cross-tenant-http.mjs`, a matriz C5 e os dois manifestos. Atualizados somente este relatório e `docs/BLOCK2_ACCESS_MATRIX.md`. Nenhum handler, provider, guard de produção, configuração comercial, .env, credencial ou workflow foi alterado.

As evidências distinguem fonte estática, HTTP real, isolamento de teste e falha confirmada. Shell HTTP 200 não comprova acesso a dados nem bloqueio comercial. Os providers remotos e seus lifecycle não foram acionados; o exemplo positivo de Atendimento HTTP usa a leitura local do Widget. Logs completos permanecem locais. Não houve navegador completo, inventário de produção, CI remoto ou aprovação independente.

Antes de autorizar rollout, corrigir C5-01/C5-02 e fazer os probes retornarem zero; aprovar os contratos compartilhados e completar sua cobertura sem trocar permissões operacionais por permissões mais fracas; tratar compatibilidade dos registros reais e definir tenant piloto/monitoramento/rollback. Os arquivos mínimos de correção e os critérios estão na matriz C5. Desativar/ativar o motor comercial não resolve os dois P1 operacionais.

**G1–G6 não aprovados automaticamente.** G2/G3 têm falhas confirmadas; G5/rollout permanecem bloqueados por cobertura/compatibilidade; G6 requer revisão independente, CI e homologação restante. As regressões G1/G4 e C0–C4 passando não substituem o aceite C5 reprovado. C6 não iniciado. Sem push, merge, deploy, migrations ou alterações em produção/Coolify. O commit da auditoria é identificável por `git log -1 --format=%H -- docs/evidence/BLOCK2_C5_RESULTS_2026-10-21.json`.


## Atualização — C5 SECURITY: bloqueadores P0/P1 — 2026-10-21

Entrada confirmada `audit/block2-sanitized`, **5ec8ed1**, árvore limpa. Correção funcional **a9aa6ed6316b41bcfd7cedc1d52c3d4420187aa6**. [Relatório específico com arquivos, causas, matriz, comandos e limitações](BLOCK2_C5_SECURITY_FIX_2026-10-21.md); [evidências comparativas verificáveis](evidence/BLOCK2_C5_SECURITY_RESULTS_2026-10-21.json).

C5-01 foi tratado como **P0**, conforme a autorização atual; C5-02 como **P1**. A raiz estava restrita ao tenant, mas referências e joins não; permissões de Tarefas permitiam serializar Lead sem leads.view. Quatro handlers agora validam referências efetivas, escopam relações e contagens antes da resposta e escrevem tarefa/OS, atividades e notificações atomicamente. Locks PostgreSQL protegem raiz/referências durante a escrita; destinatários precisam ser ativos e autorizados no mesmo tenant. Tarefas com Lead não acessível não aparecem na resposta; PUT não permite desvincular o Lead para revelar os dados. Nenhuma mudança de motor comercial/autenticação/providers/schema/dependências.

| Evidência | Antes | Depois no código executado |
|---|---|---|
| Probes originais cross-tenant | 42 expectativas reprovadas, nove notificações ao outro tenant | **42/42 PASS**; 30 escritas estrangeiras **400**, seis listas **200 sem relações inválidas**, seis detalhes **404**; **zero notificações estrangeiras** |
| Matriz HTTP comercial original | 28 exposições de Lead via Tasks com Leads API 403 | **84/84 cenários PASS**, 924 páginas/840 leituras API; **zero exposições**, API Leads continua 403 para os restritos |
| Regressão HTTP nova Tarefas/OS | Cobertura positiva nova | **14 casos PASS**: 12 ciclos completos **201/200/200/200** em dois tenants/três papéis; dois GET/PUT de Lead restrito **404/404 sem alteração** |
| Node/PostgreSQL | 110 testes na auditoria C5 | **119 PASS**, zero fail/skip/TODO; nove novos testes funcionais reais de integridade/atomicidade/concorrência, sem substituir probes por testes de fonte |
| TypeScript | 383 PASS | **383 PASS**, zero fail/skip/TODO |
| Dashboard/White-Label/smoke HTTP | Positivos na rodada anterior | **PASS**; White-Label 84 cenários/29 ações auditadas; smoke 22 checks |
| Typecheck/build/lint do recorte | Positivos na rodada anterior | **PASS**, lint dos oito arquivos 0 erros/0 avisos; nenhuma regra relaxada |
| Limpeza READ ONLY | Fixtures descartáveis | **Zero fixtures de organizações/admins e atividades órfãs dos marcadores conferidos** |

Os probes originais não foram modificados. O cross-tenant foi reproduzido antes desta correção; o baseline de Leads é o artefato C5 preservado, com igualdade de fonte funcional entre 5f0f8a9 e 5ec8ed1 verificada. Os rótulos antigos referenceHead dentro dos scripts não representam o SHA executado; o manifesto novo registra o commit funcional real. Houve bloqueio transitório de sockets locais pelo sandbox numa conferência adicional; repetição autorizada em loopback passou, sem produção ou alterações de configuração.

**Situação:** C5-01/C5-02 corrigidos nos casos comprovados, sem declarar C5 ou gates aprovados integralmente. G1 mantém regressões positivas; G2/G3 têm os bloqueadores deste recorte resolvidos, com revisão ampla/independente e providers pendentes; G4 mantém regressões locais; G5/rollout continuam bloqueados por cobertura e compatibilidade C5-03/C5-04; G6 mantém pendências de revisão independente, CI e homologação restante. Dados históricos malformados não foram reparados; demais recursos compartilhados/subrotas não são certificados por analogia. Custos de locks/carga, ambiente Node 22/CI e providers reais não homologados. Lint e dependências globais anteriores não foram saneados neste lote.

`observe_only` e `APPROVED_ENFORCEMENTS = []` byte a byte preservados. Core protegido e providers sem alteração; a exceção do teste de congelamento limita-se aos dois handlers de Tarefas explicitamente autorizados. Sem push, merge, deploy, migrations, produção ou Coolify. C6 não iniciado. Commit documental identificável por `git log -1 --format=%H -- docs/BLOCK2_C5_SECURITY_FIX_2026-10-21.md`.


## Atualização — C6: CI saneada e pacote independente — 2026-10-21

Entrada **80ac574**, `audit/block2-sanitized`, árvore limpa. [Relatório e estratégia C6](BLOCK2_C6_REVIEW_PACKAGE_2026-10-21.md), [formulário independente pendente](BLOCK2_C6_INDEPENDENT_REVIEW_2026-10-21.md) e [evidências](evidence/BLOCK2_C6_RESULTS_2026-10-21.json). Base de revisão local **review/block2-sanitized-base = 8aa1db0** preparada; nenhuma ref remota criada.

Os quatro workflows agora contemplam a base saneada e candidata, checkout do SHA real sem tags/credencial persistida e somente conteúdo de leitura. PostgreSQL descartável + toda suíte Node/HTTP C0–C5; autorização com toda suíte TS, lint e guard do histórico; build com next typegen. Jobs dependentes de baselines usam profundidade positiva seletiva, sem fetch amplo de todas as refs públicas antigas. YAMLs e 25 passos shell conferidos; **nenhuma CI remota foi executada**.

Ensaio numa cópia Git importada somente de bundle saneado, **instalação limpa e Node v22.21.1**: **123 Node/PostgreSQL PASS**, **383 TypeScript PASS**, zero fail/skip/TODO; seis probes HTTP PASS; Prisma/typegen/typecheck/build PASS; C5 mantém 42 expectativas positivas, zero notificações estrangeiras e zero exposição de Leads nos 84 cenários. Lint conjunto de 37 arquivos: **zero erros/oito avisos herdados do HEAD de entrada**; infraestrutura nova C6 sem erros/avisos. Não se alteraram regras, aplicação, providers, schema, dependências ou enforcement. Preparo CI do banco já sincronizado ensaiado sem alteração de schema/migrations; limpeza READ ONLY positiva.

Revalidadas 783 correspondências do histórico saneado, sem divergências funcionais fora dos três caminhos removidos nem metadados de autor/data; quatro valores antigos ausentes dos blobs, sem valores/fingerprints armazenados. A auditoria original local permanece preservada. Pacote final somente leitura contém duas refs saneadas, patch/commits, matriz G1–G6, evidências antes/depois, riscos e rollback; import/clone seletivo e scan final constam do manifesto externo.

`npm audit` atual retornou **exit 1: 18 pacotes afetados, zero críticos/15 altos/2 moderados/1 baixo**. Lockfile idêntico à entrada: nenhum introduzido por C6. Risco runtime da cadeia Axios precisa triagem; não houve atualização fora de escopo. Oito avisos do conjunto não equivalem a nova regressão C6 nem a lint global resolvido.

**G1–G6 permanecem sem aprovação formal.** G6 tem preparação/evidências locais, mas depende de CI do SHA enviado, revisor distinto, riscos residuais e aceite explícito. G2/G3/G4 não são certificados para toda superfície/provider real. G5 mantém lacunas comerciais C5-03/C5-04; observe_only não garante Marketing negado por URL/API à Ótica. Próximo passo é autorização nominal para envio das duas refs saneadas/Draft e designação do reviewer; depois, tratar as condições do piloto Atendimento+Vendas+White-Label e registrar URL/SHA, limites e rollback antes de autorizar promoção.

Sem push, deploy, migrations em produção ou Coolify; APPROVED_ENFORCEMENTS vazio. Nenhum histórico público foi unido à candidata. O relatório registra a ocorrência de um fast-forward por comando merge exclusivamente na cópia descartável de ensaio, sem merge commit ou alteração da candidata; atualizações seguintes ocorreram por checkout destacado. Nenhum convite/mensagem externa foi enviado e nenhum parecer independente foi simulado.

## Atualização 21/10/2026 — P1 comentários / PR Draft #15, somente local

Referência inicial `f4866f5` confirmada, árvore limpa. O P1 de `src/app/api/comments/route.ts` foi reproduzido por HTTP/NextAuth/PostgreSQL: POST `201` com pai estrangeiro e GET `200` expondo resposta estrangeira. Após correção pontual: POST `400`, zero gravações; GET `200`, sem a resposta estrangeira, inclusive com relação histórica inválida semeada diretamente.

Resultados: HTTP comentários 53/53; Node/PostgreSQL 129/129 e subset final reforçado 6/6; TypeScript 383/383; seis probes HTTP C0–C5, typecheck e build PASS; lint dos três arquivos alterados sem erros/avisos. [Relatório, matriz G2/G3, limites e rollback](BLOCK2_COMMENTS_P1_FIX_2026-10-21.md), [evidência verificável](evidence/BLOCK2_COMMENTS_P1_RESULTS_2026-10-21.json). As evidências distinguem árvore testada e HEAD documental anterior ao commit.

G2/G3: P1 GET/POST corrigido localmente, sem aprovação dos gates. A inspeção identificou risco adjacente em `/api/comments/[id]` (lookup sem organização e DELETE owner/admin), não reproduzido/corrigido neste escopo; permanece pendência explícita para homologação. G6 depende da CI/revisão do novo SHA. Demais riscos e lacunas comerciais preservados. `observe_only` e `APPROVED_ENFORCEMENTS` vazio intactos. Nenhum push ou mudança na PR, produção, Coolify, schema ou workflows. Piloto não liberado; atualização da PR #15 depende de autorização.
