# Autorização — correções locais com causa confirmada

Base candidata: cb1884e. Sem produção, merge, push ou deploy.

## Papel antigo na sessão

Auditoria: `validateSessionUser` validava a identidade e o tenant no banco, mas o contexto devolvido mantinha `session.user.role` do JWT. Um usuário atualmente admin, com claim anterior owner, passava pelo guard administrativo e criava outro admin pelo convite. Reprodução com handler real, hash e PostgreSQL descartável: HTTP 200 quando esperado 403, em `auth-role-before.log`.

Correção mínima: após validar a associação ativa, atualizar somente o papel da cópia local da sessão com `dbUser.role`. Todas as demais decisões de permissão e políticas comerciais permanecem iguais. O teste de boundary compara o arquivo inteiro ao baseline após retirar exatamente essa adição, ignorando apenas newline final. Não libera outras alterações ao core.

Validação: testes de handlers reais e banco, com transporte de sessão, email e provisionamento simulados. C03-01 a C03-08 cobrem hash válido/inválido, cookie HttpOnly, segredo ausente/fraco, JWT adulterado/expirado/algoritmo/papel incorretos, admin removido/e-mail alterado, logout do cookie e negativa de provisionamento anônimo antes de banco/provider. C04 cobre criação concorrente sem tenant órfão, identidades ativas/removidas intactas, recuperação concorrente, reset único, recuperação de removidos negada, convite legítimo e três papéis com claim owner antigo. Dez testes agrupam esses cenários; todos passaram. Login real NextAuth e APIs de leads também passaram em smoke HTTP separado. Mocks de cookies não são comprovação de todos os detalhes do browser/middleware; revogação de cópia roubada de JWT após logout não foi implementada nem certificada.

## Webhook Asaas sem token configurado

Auditoria: a autenticação só era executada quando ASAAS_WEBHOOK_TOKEN existia. O teste de handler sem token retornou HTTP 200; esperado 503. Correção restrita ao início do handler: segredo ausente retorna 503, cliente sem token/código incorreto retorna 401, comparação de bytes usa timingSafeEqual. Os dois nomes de header existentes continuam válidos. O teste de boundary compara todo o processamento a partir de `req.json()` ao baseline original, desconsiderando apenas newline final; nenhum evento comercial, status, limite ou plano foi alterado.

Três testes passam sem acesso a banco, cobrança ou provider. Nenhum pagamento foi simulado como real. A produção não foi consultada; antes de eventual rollout, o responsável deverá verificar a existência segura da configuração do webhook. Não se presume que essa credencial exista e não foi solicitada em chat. Isso é autenticação do webhook, não autorização para enforcement comercial.

## Providers e limites

Quatro testes adicionais executam lifecycle/handlers/adapters reais com PostgreSQL e provider mocks: IDs Evolution de outro tenant negados antes do provider, QR respeita tenant/provider e três papéis, adapter Google escolhe credenciais pelo tenant da sessão, URL Google hostil é rejeitada. Não altera lifecycle ou credenciais globais. Não certifica todos os fluxos de todos os providers.

Rollback local por git revert do commit desta correção; nenhum dado/schema depende da atualização de papel ou da autenticação Asaas. Um recuo reabre os riscos descritos, portanto só é aceitável com as rotas afetadas bloqueadas e revisão de segurança. Nenhum rollback foi executado em produção. A política `observe_only`, APPROVED_ENFORCEMENTS vazio, helpers Chatwoot e processamento comercial permanecem intactos.
