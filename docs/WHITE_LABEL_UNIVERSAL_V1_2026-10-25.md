# White-Label universal V1 — validação local

Referência: `fc123488eab556f29241312af8abbe5b9e0e462b`, branch `audit/block2-sanitized`.
Execução local de 25/10/2026. Sem push, merge, deploy, migration de produção ou alteração de clientes reais. A PR #15 não foi atualizada.

## Auditoria diferencial e plano executado

Documentos considerados: Documento Mestre, Arquitetura Oficial, Core Protegido, Regras de Implementação, Metodologia, Status Atual, Isolamento de Providers e Decisão Mestre Comercial de 20/10/2026. As restrições atuais prevalecem sobre instruções antigas de push/deploy. Não foi iniciado outro motor comercial, de branding ou autenticação.

| Superfície | Já existia | Lacuna e alteração |
| --- | --- | --- |
| Resolução | `getOrgBranding`, `resolveCommercialEntitlements`, validação da sessão/organização | Reutilizados; sem cache global de identidade e sem resolver paralelo |
| Persistência | `Organization.name/logo/favicon/primaryColor/secondaryColor` | Reutilizada; nenhuma coluna ou migration nova |
| Sidebar | Marca por tenant, navegação comercial e permissões | Logo expandida de 44×44 para área de até 190×56, proporcional; compacto 40×40 com favicon; contraste adaptativo |
| Assets | Sanitização de URL/cor | Fallback para falha inclusive anterior à hidratação; sem proxy de imagens/SSRF no servidor; `referrerPolicy=no-referrer` |
| Favicon MDS | Referência `/favicon.ico` | Caminho inexistente substituído pelo asset disponível `/images/favicon.png`; testes conferem bytes reais |
| Cores | Duas cores persistidas | Tokens semânticos restritos a `[data-crm-brand]`, sem `:root` global; sidebar, ativo, hover/foco, ações primárias/secundárias, links, badge de plano, bordas/textos/superfícies |
| Operação | Cores funcionais de status/etapas | Mantidas; nenhuma query/ação de Leads/Kanban/Agenda modificada; somente classe do badge de plano no Dashboard |
| Editor MDS | PUT separado de plano/limites e auditoria | Nome editável, URLs normalizadas, prévia, restauração explícita; componente isolado por ID ao trocar organização |
| Escrita concorrente | Transação com auditoria | CAS de `features` + `deletedAt`; revogação/desativação concorrente retorna 409, sem edição/auditoria parcial |
| Cliente | PATCH visual permitido para organizações sem adicional | Nova política expressa: todo cliente recebe 403 para edição comercial; tela de identidade somente leitura. Configurações operacionais continuam em seus handlers |
| Erros | Fallback padrão Next | Erro dentro do shell, sem exibir mensagens internas; 404 com identidade da sessão validada e padrão MDS para anônimo |

O favicon é também o ícone compacto; não foi criado outro campo. `name` é o campo existente da organização, não uma razão social separada. Branco/preto/neutros dos tokens são escolhas técnicas de contraste/fallback; não há paleta específica para a Ótica no produto. Os valores laranja dos testes pertencem exclusivamente às fixtures.

## Segurança e compatibilidade

- Sessão validada por `checkAuth`/contexto existente antes da resolução; organização removida não recebe identidade privada.
- A capability `white_label` permanece independente dos módulos. Nem owner nem admin de cliente acessam o backend do Super Admin.
- GET/POST operacionais, engines, providers, OAuth, webhooks, sincronização, schema/migrations, dependências e Dockerfile não foram modificados.
- Identidade não é gravada em cookies/localStorage. O estado persistido da Sidebar continua sendo apenas recolhimento/navegação.
- Login anônimo usa MDS: não foi criado seletor público de tenants, consulta por e-mail ou domínio não verificado. Após login, a marca vem da organização autenticada.
- Troca de identidade sem deploy: salvar pelo Super Admin e recarregar a sessão/tela do cliente. Não foi implementado push em tempo real para abas abertas.
- `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados. Estes testes não ativam bloqueio comercial em organizações reais.

## Validação reproduzida

- Node 22.21.1; PostgreSQL 16 novo, descartável, exclusivamente `127.0.0.1:5432/mds_crm_dev`.
- Código copiado para `/tmp/mds-wl-v1-*` sem `.env.local` ou arquivos de credenciais. Segredos de autenticação gerados em memória; providers sem credenciais.
- `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.mjs`: **567/567**, zero falhas/skips/TODOs.
- Matriz real HTTP: **84 cenários** = sete conjuntos de módulos × duas identidades × três papéis × duas organizações; edição própria/comercial e edição estrangeira negadas, persistência MDS validada.
- Nove probes reais: Dashboard C0, Dashboard comercial, branding, cross-tenant C5, URLs/APIs C5, Tarefas/OS, comentários GET/POST, comentários DELETE e upload/download privado. Todos com exit 0.
- Concorrência PostgreSQL: edição visual vs revogação/desativação e falha de auditoria; nenhuma alteração parcial.
- `node node_modules/next/dist/bin/next build --webpack`: aprovado. `tsc --noEmit --incremental false` e `prisma validate`: aprovados.
- ESLint nos arquivos alterados: zero erros, seis avisos. Cinco avisos de variáveis já existentes no handler administrativo; um aviso de `<img>` no componente novo. O elemento nativo evita criar um proxy/allowlist de imagens externas e permite fallback; nenhuma regra foi desativada.

Os testes TSX exigiram IPC local liberado. A chamada inicial `node --import tsx --test` no sandbox reportou apenas arquivos, e não foi contabilizada como evidência de testes internos. Os 567 casos acima são da execução efetiva pelo CLI TSX com permissão local.

O build isolado inicialmente falhou pelo symlink de `node_modules` (Turbopack) e pela fonte Inter/proxy. A execução aprovada usa dependências copiadas, Webpack e a CA oficial do ambiente; TLS não foi desabilitado. Isso comprova o build Next, **não** um build Docker completo na VPS.

### Chromium

**174/174 verificações, 50 capturas, zero erros JavaScript não tratados e três recusas de configuração insegura.**

Resultados finais e contagens: ver `docs/evidence/WHITE_LABEL_UNIVERSAL_V1_2026-10-25.json`.

Harness versionado: `tests/branding-universal-browser.mjs`. Exige `BLOCK2_WL_DISPOSABLE=true`, banco loopback descartável, cópia do código em `/tmp/mds-wl-v1-*`, servidor de teste na porta 3100 e Chromium/Playwright. `BLOCK2_PLAYWRIGHT_MODULE` pode apontar à instalação de testes; nenhuma dependência de runtime foi adicionada. `BLOCK2_BRANDING_REPORT_DIR` define a pasta de evidências sintéticas.

Antes de iniciar o servidor isolado, preparar os seis assets sintéticos `public/images/wl-fixture-{a,b,c}.svg` e `wl-icon-{a,b,c}.svg`; o Next inventaria arquivos estáticos no startup. Não apontar o harness ao checkout de produção. O launcher local/evidências integrais ficam em `/workspace/mds-crm-onboarding-evidence/white-label-v1`, sem promessa de link público de download.

Cenários: organizações A/B com marcas distintas e C com MDS; desktop/mobile; Sidebar aberta/recolhida; Dashboard, Leads, Kanban, Agenda, identidade e 404; troca de sessão e logout real; prévia/salvamento/restauração pelo editor; assets ausentes; onboarding completo por APIs de plano → organização → branding → owner → login.

A sincronização inicial `networkidle` foi substituída por DOM/fontes, pois Kanban faz polling. IPs sintéticos distintos evitam esgotar o rate limit existente; o rate limit não foi alterado. Logout é o botão real, com sessão anônima comprovada, em vez de remoção de cookies em meio a requisições. O cliente HTTP Playwright não trata cookies Secure de loopback como o Chromium: a edição final foi validada por fetch no próprio navegador autenticado. Nenhuma asserção de autorização/persistência foi reduzida.

## Checklist de homologação e deploy futuro

1. MDS cria/vincula um plano com os módulos explícitos e `white_label`, sem propagação inadvertida a outros clientes.
2. Criar organização e owner pelas telas existentes; conferir limites e campos protegidos. Não recriar organizações atuais.
3. Salvar nome/logo/favicon/cores em **Identidade visual — controle MDS**, separadamente do plano; verificar prévia, auditoria e recarga do cliente.
4. Conferir desktop/mobile, logo horizontal/ícone compacto, favicon/título, contraste, estados vazios/404, logout e segunda organização.
5. Conferir owner/admin/comum e permissões parciais; confirmar que White-Label não acrescentou Marketing ou outro módulo.
6. Para a Ótica: Atendimento + Vendas + White-Label, sem Marketing no menu; o bloqueio nominal de URL/API exige a aprovação de rollout comercial já pendente. Não habilitar enforcement global por este trabalho.
7. Antes de qualquer deploy no mesmo recurso Coolify: aprovação explícita, SHA/imagem de rollback exclusivo CRM, backup/configurações/segredos/providers preservados e Auto Deploy controlado. Não alterar Chatwoot/Evolution/n8n.
8. Construir a imagem do novo SHA; preservar CMD direto do Next e executar migrations somente se houver autorização separada (este bloco não adiciona nenhuma). Validar volume privado de anexos e corte legado antes de tratar a exposição pública como resolvida.
9. Publicação futura somente após autorização de envio/revisão/CI/deploy; esta rodada não atualiza branches remotas ou PR.

Rollback da implementação: reverter o commit deste bloco ou retornar à imagem CRM estável registrada antes da intervenção. Não requer downgrade de schema nem restauração da VPS. Mudanças visuais administrativas futuras devem ter seus valores anteriores registrados para restauração pontual; não restaurar todo o banco para desfazer uma paleta. Não reabrir anexos estáticos públicos no rollback.

## Riscos e aceites

- Homologação visual do responsável e teste operacional real dos canais ainda necessários; providers não foram conectados ou alterados nesta rodada.
- Branding dentro do iframe Chatwoot segue as limitações/imagem do provider; tokens CSS do CRM não atravessam o iframe.
- Assets HTTPS externos dependem do host escolhido; fallback local está coberto, mas a disponibilidade/privacidade do host deve ser avaliada pela MDS. Logos/favicons são ativos intencionalmente públicos, não anexos internos.
- Cores de status/Kanban permanecem funcionais; não houve redesenho de módulos.
- CI remota deste novo commit e build Docker completo não executados; aguardam autorização/ambiente apropriado.
- Anexos públicos legados, volume privado e rollout comercial do piloto continuam com seus aceites específicos pendentes.
- Este resultado não aprova G1–G6 nem libera automaticamente o piloto.

## Leitura das tentativas e limitações auxiliares

O `http-summary.json` local preserva nove probes HTTP aprovados e uma tentativa visual que falhou ao presumir a primeira página do painel. O resultado visual final está em `browser-summary.json` (exit 0) e `visual.json` (completed=true). O JSON versionado consolida essas evidências do mesmo build; não apaga nem trata a tentativa anterior como aprovada.

A página 404 exige metadata no layout raiz: a resolução passou a ser dinâmica e validada pela sessão, incluindo rotas públicas quando existe uma sessão válida. Há consultas adicionais por requisição; nenhum cache público de tenant foi introduzido.

A notificação nativa do timer Pomodoro ainda usa um ícone legado (`/favicon.ico`), fora do favicon da aba corrigido e das telas homologadas aqui. O timer não foi refatorado: também possui um erro/aviso de lint preexistentes fora do conjunto modificado. Este detalhe visual auxiliar não é certificado por este relatório.

## Arquivos deste bloco

- `docs/WHITE_LABEL_UNIVERSAL_V1_2026-10-25.md`
- `docs/evidence/WHITE_LABEL_UNIVERSAL_V1_2026-10-25.json`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/error.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/settings/branding/page.tsx`
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/app/api/organizations/route.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`
- `src/components/BrandLogo.tsx`
- `src/components/OrganizationBrandingEditor.tsx`
- `src/components/Sidebar.tsx`
- `src/lib/branding-values.ts`
- `tests/branding-governance-postgres.test.mjs`
- `tests/branding-presentation.test.ts`
- `tests/branding-universal-browser.mjs`
- `tests/branding-universal.test.ts`
- `tests/branding-white-label-http.mjs`
