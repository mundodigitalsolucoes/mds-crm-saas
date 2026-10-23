# Bloco 02 — startup sem migrations implícitas — 2026-10-23

Baseline `d20fc98`, branch local `audit/block2-sanitized`. PR #15 não atualizada. Sem push/merge/deploy, alterações de Coolify, produção, volumes reais, schema ou arquivos de migration. `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados.

## Causa e correção

Antes: Docker `CMD ["npm", "start"]` acionava `package.json` → `prestart: prisma migrate deploy` → `start: next start`. Assim, startup/restart podia aplicar migrations no banco configurado antes de servir a aplicação.

Depois, Dockerfile usa exec form:

```dockerfile
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
```

Mantidos `WORKDIR /app`, `ENV PORT=3000`, `EXPOSE 3000` e todos os COPYs de assets, .next, Prisma Client/node_modules, schema/migrations e configuração Next. O Next lê PORT do ambiente, sem fixar outra porta na linha de comando.

Removido somente o hook `prestart` de package.json. O comando `start: next start` permanece para compatibilidade e também não aplica migrations. `migrate:deploy: prisma migrate deploy`, `migrate:dev` e `db:push` continuam comandos explícitos, sujeitos a autorização separada; não são comandos de startup. `postinstall` e build mantêm Prisma generate, que gera o client e não aplica migrations. Nenhuma dependência ou lockfile foi alterado.

A imagem pública node:22-alpine foi obtida apenas para validação local. Seu Config.User é vazio (padrão root); herda `docker-entrypoint.sh`. O arquivo foi inspecionado em contêiner novo, read-only, sem rede/mounts: somente normaliza argumentos e executa `exec "$@"`, sem migration. O Dockerfile não acrescenta ENTRYPOINT. Configurações/overrides efetivos do Coolify não foram acessados ou alterados.

## Validação funcional isolada

`tests/startup-restart-http.mjs` exige opt-in e PostgreSQL loopback:5432/mds_crm_dev, sem query parameters, argumentos de paths ou conexão externa configurável. O teste cria diretório temporário e copia o conjunto de runtime: package/lock, configuração, .next e prisma; usa dependências locais por symlink e somente um asset público de fixture. Não copia .env, anexos, credenciais, mounts ou arquivos de clientes. Processo filho recebe ambiente explícito com segredos sintéticos e banco descartável. Não é executor de produção.

O teste extrai o CMD real do Dockerfile e executa: (1) startup do CMD; (2) desligamento SIGTERM do grupo e novo startup do mesmo CMD; (3) alternativa npm start. PORT é efêmero. Login NextAuth real e Prisma/PostgreSQL reais, organização/usuário/Lead fictícios. A mesma sessão e o mesmo Lead permanecem após restart. Asset estático é comparado byte a byte por digest de conteúdo sintético.

Um preload bloqueia chamadas CLI de migrations e registra tentativas. Controle negativo executa somente uma chamada interceptada e comprova que o detector bloqueia antes de executar Prisma. O contador é então zerado para as inicializações reais. Os três ciclos tiveram **zero tentativas CLI**, sem logs de migrate, esquema de colunas idêntico e tabela `_prisma_migrations` ausente antes e depois. Não foi aplicada migration: apenas `prisma db push --skip-generate` preparou previamente o schema no PostgreSQL descartável, conforme guard C6/opt-in; isso não ocorreu no startup.

| Comando / verificação | Resultado |
| --- | --- |
| `npm run build` | PASS: Prisma Client + Next build |
| `npx tsc --noEmit` | PASS |
| `node tests/startup-contract.test.mjs` | 2/2 PASS |
| Harness startup/restart com banco descartável explícito | **24/24 PASS**, controle negativo, três inicializações, Prisma/HTTP/assets e zero migrations |
| `node scripts/block2-c6-ci.mjs node` | **169 PASS**, zero falhas/skip/TODO |
| `npx tsx --test tests/*.test.ts` | **387 PASS**, zero falhas/skip/TODO |
| `node scripts/block2-c6-ci.mjs http` | **6/6 probes PASS**: C0, comercial/Dashboard, branding, cross-tenant, acesso direto, Tarefas/OS |
| ESLint dos dois testes novos com max-warnings=0 | PASS, zero erros/avisos |
| Build Docker completo em contexto saneado | **BLOQUEADO**: índices Alpine v3.24 retornam HTTP403 em `apk add openssl libc6-compat`, antes do build da aplicação |

Evidências estruturadas: [24 verificações](evidence/BLOCK2_STARTUP_RESTART_2026-10-23.json). Logs completos locais em `/workspace/mds-crm-onboarding-evidence/startup-fix/`, sem publicação na PR/CI remota. O primeiro lint apontou um import não usado no teste; foi removido, lint final aprovado. `next-env.d.ts` gerado pelo build foi restaurado.

## Limitações e auditoria de alternativas

- O teste funcional usa Node22 Linux local, não uma imagem Alpine final. O build Docker foi efetivamente tentado em contexto derivado de git archive saneado com somente Dockerfile/package.json sobrepostos. Não houve cópia de .env real. A falha dos índices não comprova inexistência dos pacotes: índices não foram obtidos. Não foram alterados mirrors, pacotes, imagem-base ou TLS para contornar o bloqueio. Antes de promoção, completar o build Docker e smoke/restart da imagem exata em ambiente isolado com acesso autorizado ao Alpine.
- O detector e o snapshot são evidência dos caminhos executados, não prova universal contra todo SQL arbitrário. Código produtivo alterado restringe-se a CMD e remoção do lifecycle; autenticação, providers, schema e autorização não foram modificados.
- Busca de comandos de startup em Dockerfile, package.json, scripts, workflows e compose não encontrou outro encadeamento implícito para migrate deploy. Compose não sobrescreve o CMD da aplicação. Testes/workflows existentes iniciam Next diretamente. Comandos explícitos de migrations continuam disponíveis, não autorizados para produção.
- Overrides externos de startup, hooks de deploy do Coolify ou wrappers fora do repositório permanecem não verificados. Antes de implantação, confirmar comando efetivo e ausência desses hooks; schema necessário deve estar reconciliado por operação separada autorizada. Sem schema compatível, o servidor pode iniciar e rotas falharem; não reintroduzir migrations automáticas como fallback.
- Imagem-base node:22-alpine é flutuante; esta inspeção não fixa o digest de futuras builds. Armazenamento privado durável, limites de proxy/runtime e corte de URLs públicas legadas permanecem pendentes. Nenhum desses controles foi alterado aqui.

Rollback de código deve preservar startup sem migrations implícitas. Reverter ao CMD/npm com prestart antigo reintroduz o risco e não deve ser usado como recuperação operacional automática. Nenhum gate G1–G6 ou piloto aprovado.
