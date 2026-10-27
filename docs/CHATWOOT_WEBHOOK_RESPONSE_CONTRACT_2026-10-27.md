# Chatwoot — contrato de criação do webhook

Base: `671b44157e11da331fcd900b07fde6b33c506f41`; branch `audit/block2-sanitized`. Preparação local somente, sem publicação/produção.

## Causa e diff mínimo

O POST real informado pelo responsável retorna `{payload:{webhook:{id,name,url,account_id,subscriptions,secret}}}`. O provisionador procurava id/url na raiz, interpretando criação concluída como resultado inconclusivo. O fixture anterior devolvia webhook na raiz e mascarava a incompatibilidade; seu GET também usava lista na raiz em vez do template `payload.webhooks`.

A regressão foi reproduzida antes da correção com PostgreSQL descartável e servidor HTTP sintético: o POST criou um webhook, mas o provisionador retornou `webhook_requires_review`.

Única alteração da aplicação, **2 adições e 1 remoção** em `src/lib/integrations/chatwoot-provision.ts:229`: ler JSON como response, extrair response.payload.webhook somente quando response/payload são objetos. As verificações existentes de objeto, ID positivo e correspondência da URL continuam aplicadas ao objeto extraído. O campo secret do envelope não é registrado, exposto ou persistido. Não há fallback para objeto na raiz do POST.

Comparação mecânica com a base confirmou que, revertendo essas duas linhas para a leitura anterior, o arquivo inteiro fica idêntico. Portanto permanecem inalterados: parser GET (incluindo payload.webhooks), intenção durável anterior ao POST, CAS, lease, isolamento, tratamento de resultado desconhecido, ordem de ativação e validações do provisionador. Nenhum endpoint ou mecanismo de recuperação manual foi criado.

## Fixtures e regressões

`tests/helpers/synthetic-chatwoot.mjs` agora serializa exatamente os campos id/name/url/account_id/subscriptions/secret e os envelopes GET payload.webhooks / POST payload.webhook. O secret é uma sentinela sintética sem credencial real. O formato interno usado para controlar o teste permanece separado da serialização HTTP.

`tests/chatwoot-onboarding-postgres.test.mjs`: nove casos novos. Aceitação do envelope real e persistência de ID único; resposta perdida reconciliada pelo GET sem outro POST; ID zero/negativo/inválido, URL divergente, webhook ausente, payload ausente e objeto enganoso na raiz. Todos os negativos mantêm integração inativa, intenção persistida e proibição de novo POST quando a listagem posterior não confirma o registro. Um GET conclusivo pode reconciliar o registro já criado, sem recriá-lo. As sentinelas secret não aparecem em logs, DTO ou data persistido.

## Resultados desta execução

- Antes: regressão com contrato real simulado falhou como esperado na fonte 671b441.
- Depois: **667/667** testes Node/TypeScript/PostgreSQL, zero falhas/skips/TODOs; **39** de onboarding, incluindo os nove novos. Regressões anteriores de proprietário, concorrência, perda de resposta, isolamento, webhook e status preservadas.
- **14 cenários HTTP aprovados em Next dev --webpack**, com PostgreSQL/Platform API sintéticos; inclui signup, Super Admin, SSO/NextAuth restrito ao tenant, GET405 e reconciliação sem duplicação. A listagem global continua simulada em HTTP500.
- TypeScript, next typegen, Prisma validate, ESLint dos três arquivos alterados e diff check: exit0.
- **Build de produção não aprovado nesta execução.** `npm run build -- --webpack` falhou ao obter Inter de fonts.googleapis.com. Diagnóstico sem desativar TLS: `curl: (56) CONNECT tunnel failed, response 403`. Não houve alteração de layout/fontes, dependências ou controles de rede para contornar o bloqueio.

O HTTP dev foi executado com adaptação temporária exclusivamente no launcher da cópia isolada (start → dev --webpack), mantendo todas as asserções. O arquivo foi restaurado byte a byte no finally. Não foi alterado no repositório, nem esse resultado equivale a HTTP next start ou build de produção aprovado.

Schema preparado com Prisma db push --skip-generate somente em PostgreSQL 16 descartável local. Nenhuma migration executada. Todos os arquivos são sintéticos e a rede do provider é restrita a loopback. Evidências: [JSON sanitizado](evidence/CHATWOOT_WEBHOOK_RESPONSE_CONTRACT_2026-10-27.json). Logs privados locais em `/workspace/mds-crm-onboarding-evidence/chatwoot-webhook-contract-2026-10-27/`, sem alegação de link público.

## Preservação e riscos remanescentes

Signup e Super Admin continuam importando o mesmo serviço oficial; seus handlers não foram alterados. Sem mudanças em Atendimento/iframe, rota de credenciais, webhook operacional, providers, domínio, autenticação, sessões, módulos, schema, Dockerfile ou workflows. `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados.

Nenhuma chamada à instalação Chatwoot real, nem às contas #32, #38, #39 ou #40. As contas #39/#40 já possuem webhooks segundo o responsável; não repetir criação para testar este patch. Um resultado remoto desconhecido continua sem autorização para replay. Não foi homologada a abertura de sessão/iframe real.

Falta repetir o build de produção em ambiente com acesso permitido ao Google Fonts e executar CI/homologação real somente após autorização. **Código aceita o envelope real nos testes isolados; onboarding em produção não homologado.** Sem push, merge, deploy, alterações de dados/credenciais/infraestrutura ou aprovação de gates/piloto nesta execução.
