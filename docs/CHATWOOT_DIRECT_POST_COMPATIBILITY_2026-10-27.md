# Chatwoot — restaurar criação direta sem GET global obrigatório

Base local: `4e6993949f314b30a6961eacccf9a10701e84161`; contrato anterior comparado: `77f4eeb79427a1b949b8192b64dec50557a5402d`. Branch `audit/block2-sanitized`, sem alteração remota/PR.

## Causa e alteração mínima

Em `77f4eeb`, o provisionador iniciava `POST /platform/api/v1/accounts` com `name` e `locale:pt_BR`. Em `4e69939`, `accountList()` era aguardado incondicionalmente antes de qualquer criação. HTTP 500 fazia lançar `remote_inspection_unavailable`, sem chegar ao POST. O defeito foi reproduzido com PostgreSQL descartável e servidor HTTP sintético: duas falhas antes do ajuste (criação nova e retomada com ID conhecido); o negativo de resultado desconhecido já permanecia bloqueado.

Somente `src/lib/integrations/chatwoot-provision.ts` foi alterado na aplicação (6 linhas adicionadas, 2 removidas):

- Sem ID remoto e com checkpoint `preflight`: não consultar listagem global; persistir `account_creating` sob CAS e executar o POST original. Mantidos nome, locale, headers Platform API e marcadores de organização/operação adicionados pelo onboarding seguro.
- Com ID conhecido: listagem global passa a ser auxiliar. Se estiver indisponível, continua obrigatória a leitura específica `/platform/api/v1/accounts/:id`, com validação dos marcadores do tenant/operação e demais verificações existentes. Listagem disponível com marcadores duplicados/conflitantes continua bloqueando.
- Sem ID após uma tentativa: listagem conclusiva continua obrigatória para encontrar exatamente o marcador da operação. HTTP 500, ausência ou ambiguidade não permitem repetir o POST. Estado `preflight` nunca é restaurado após `account_creating`.
- POST de proprietário volta a enviar também `password_confirmation`, presente no contrato `77f4eeb`, com o mesmo segredo aleatório já criptografado no checkpoint. Não reutiliza senha CRM nem altera credenciais de identidades existentes.

Não houve retorno ao antigo upsert irrestrito ou scripts Rails. Preservados CAS do proprietário, intent de webhook, validação remota de identidade/membership/SSO, status negativo persistente e commit transacional de `ready`. Nome exibido não é identidade: criação nova não tenta inferir titularidade pela listagem/nome global; correlação e vínculos usam IDs/marcadores.

Cadastro gratuito e criação Super Admin já importam o mesmo serviço oficial e permanecem sem alterações de handlers. Não foi criado provisionador paralelo. Não há nova ação manual para concluir o caminho normal: os dois fluxos criam e validam automaticamente no teste isolado.

## Testes e evidências

Node 22.21.1, PostgreSQL 16 descartável, servidor Platform API sintético restrito a loopback e cópia Next.js sem .env reais. O schema foi preparado com Prisma db push --skip-generate exclusivamente nesse banco de teste; nenhuma migration/consulta em banco real.

| Validação | Resultado |
|---|---|
| Antes: três casos de compatibilidade | 2 falhas (novo/retomada), 1 negativo seguro aprovado |
| `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.mjs` | 658/658; zero falhas/skips/TODOs, incluindo 30 de onboarding |
| HTTP onboarding (`node --import tsx tests/chatwoot-onboarding-http.mjs`) | 14 cenários, GET global configurado permanentemente em HTTP 500 |
| Domínio (`node scripts/block2-domain-ci.mjs`) | 52 cenários + reinício real isolado |
| Regressões (`node scripts/block2-c6-ci.mjs http`) | 10 probes C0–C5 |
| `npm run build -- --webpack` | Exit 0 |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |
| Prisma validate, ESLint dos quatro arquivos alterados e git diff --check | Exit 0 |

Quatro novos casos PostgreSQL: criação direta sem GET inicial; retomada conhecida durante falha global; resposta perdida com proibição de novo POST enquanto GET retorna 500 e reconciliação posterior sem duplicar; GET global indisponível não contorna prova de tenant no endpoint específico.

O servidor sintético verifica igualdade password/password_confirmation sem guardar/imprimir o segredo. HTTP real Next.js comprova dois clientes criados pelo Super Admin e um pelo signup: exatamente três POSTs de conta, credenciais/SSO restritos ao tenant e erros/recuperação/status do patch anterior preservados. Não equivale a navegador/iframe em Chatwoot real.

Dois testes anteriores foram ajustados ao contrato novo, mantendo negativos: indisponibilidade agora é simulada no POST, cuja repetição continua proibida; conta ambígua é exercitada após resposta perdida e remoção de seus marcadores, sem novo POST. A antiga recusa de criação nova apenas por nome global deixou de ser pré-condição, pois exigia o endpoint quebrado. Duplicação de marcadores conhecidos, identidades estrangeiras, concorrência, webhook e ready negativo continuam cobertos sem afrouxamento de suas asserções.

[Evidência sanitizada](evidence/CHATWOOT_DIRECT_POST_COMPATIBILITY_2026-10-27.json). Logs locais em `/workspace/mds-crm-onboarding-evidence/chatwoot-direct-post-2026-10-27/` (não são links públicos). Diff mínimo da aplicação: `git diff 4e69939 -- src/lib/integrations/chatwoot-provision.ts` no commit desta entrega.

## Preservação, riscos e bloqueio

Sem alteração de iframe/credenciais operacionais, CORE, Evolution/Cloud/outros providers, inboxes, mensagens, webhooks operacionais, autenticação/sessões, domínio próprio, módulos, schema, migrations, Dockerfile, dependências ou CI. `observe_only` e `APPROVED_ENFORCEMENTS=[]` intactos. Nenhum dado real acessado ou alterado.

- Instalação Chatwoot 4.17.0 real **não acessada**. HTTP 500 real é evidência fornecida pelo responsável; a reprodução própria usa servidor sintético com esse comportamento. Aceitação de marcadores, confirmação do usuário, sessão e permissões reais precisam ser homologadas.
- Uma tentativa de POST com resultado desconhecido sem evidência conclusiva permanece bloqueada: nunca apagar/resetar checkpoint para tentar de novo. Isso protege contra duplicação e não substitui o provisionamento normal por recuperação manual.
- Se GET global falhar na retomada de ID conhecido, conflitos só visíveis em inventário global não podem ser inventariados; permanecem obrigatórias prova específica da conta, identidade/perfil, exclusividade local e CAS. Uma listagem disponível ainda é usada para detectar marcadores duplicados. Essa limitação de inventário não autoriza vincular recursos de terceiros.
- Listagem auxiliar de uma retomada pode aguardar o timeout existente de 15s. Criação nova não faz essa chamada.
- Comportamentos internos do upsert de usuário Chatwoot e demais ressalvas do relatório anterior não foram alterados. Build Next aprovado não certifica imagem Docker completa.

**Publicação/homologação real bloqueada, sem parecer de aprovação de publicação.** Requer autorização específica posterior para demonstrar no ambiente real: cadastro gratuito e Super Admin criando contas, proprietário abrindo Atendimento, dois tenants isolados e ausência de duplicação. Nenhum push, merge, deploy ou provisionamento real executado nesta missão. G1–G6 e piloto não aprovados.
