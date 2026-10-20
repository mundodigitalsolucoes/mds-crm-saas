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
