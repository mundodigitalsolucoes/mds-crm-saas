# Domínio Próprio Universal V1.1 — ativação persistente

Base remota confirmada: `5817b9ca40c2e5c8066d84ccf4eaf091d5f8ce6b`. Os ajustes posteriores de login off-white e modal foram preservados. O diagnóstico local anterior `de082c8` foi preservado também na ref local `backup/domain-v1-diagnostics-de082c8` e reaplicado como `fa27b2f` sobre essa base, sem publicação nem mistura com histórico antigo.

## Causa e solução

V1 gravava `verifiedUntil = min(certificado, agora + 24h)` e `domainIsActive` exigia que **esse prazo e o certificado observado** estivessem no futuro em toda requisição. Era uma autorização temporária, não uma ativação administrativa durável. O DTO e o painel também exibiam a expiração como perda do estado ativo.

V1.1 separa:

1. **Prova inicial:** TXT exato, IPv4 público autorizado, ausência de AAAA, TLS válido e prova criptográfica do roteamento permanecem no verificador sem alterações. A prova para primeira ativação permanece recente (até 24h e limitada pelo certificado). Uma prova antiga não pode ser usada para ativar um domínio ainda não autorizado.
2. **Ativação administrativa:** somente o Super Admin existente concede `active`. Novo estado registra `activatedAt`, `activationHostname` e `activationRevision`, vinculados à configuração verificada. Depois de ativado, o prazo antigo e a data do certificado observado não cancelam a ativação.
3. **Monitoramento:** reutiliza `verify`; grava `checkedAt`, resultado, última verificação bem-sucedida `verifiedAt` e auditoria. Nenhum worker, cron, conta de serviço ou infraestrutura adicional foi criado/ativado.

Não há novo motor comercial/autenticação, modelos Prisma, migration ou dependência. `custom_domain` segue independente de White-Label e dos três módulos. O request resolver continua conferindo organização ativa, assinatura, exclusividade, Host e origem do proxy; a sessão continua vinculada ao tenant e origem. O hostname novo também precisa corresponder ao carimbo de ativação; mudar a revisão invalida o carimbo.

## Regras de monitoramento e suspensão

- Domínio ainda não ativo: falha mantém `awaiting_dns/awaiting_https`, não concede acesso nem conserva prova utilizável.
- Domínio já ativo: uma falha de DNS, configuração ou HTTPS é registrada, mas **não renova prova nem derruba imediatamente o domínio**.
- `ownership_missing`, `pointing_mismatch` e `routing_mismatch` em domínio ativo expõem `securityReviewRequired` no DTO administrativo e alerta no painel. Isso exige revisão, não afirma automaticamente comprometimento.
- MDS confirma o incidente usando DNS autoritativo, resultado da rota/proxy e logs apropriados; usa `deactivate` para suspensão imediata, ou revoga a capacidade comercial. Não existe suspensão automática após um número arbitrário de falhas; essa política exige confirmação humana nesta versão.
- Suspensão/revogação são efetivas no backend em toda nova requisição. Nova concessão não reativa o estado antigo. Para recuperar domínio desativado, verificar novamente e ativar explicitamente. Substituir hostname gera nova configuração e invalida o antigo.
- Resultados de monitoramento aparecem na auditoria sem desafio, TXT, cookie, token ou segredo. `verificationResult` guarda somente `ok` ou código sanitizado; actor e hostname seguem o contrato administrativo existente.
- O proxy continua obrigado a servir HTTPS válido e renovar ACME. A data de certificado persistida é uma observação; não prova que um certificado renovado expirou. A aplicação não desliga validação TLS nem libera HTTP para compensar falhas. Certificado realmente inválido continua sendo recusado pelo verificador e deve ser tratado operacionalmente.

### Monitoramento periódico opcional

Após autorização operacional, um agendador existente poderá chamar o endpoint administrativo `PATCH /api/admin/organizations/[id]/domain` com `{action:"verify"}`, usando autenticação Super Admin protegida e nunca logs de cookies/segredos. Não há autenticação alternativa nem bypass de proxy. A frequência e o responsável serão definidos pela MDS. O painel já permite executar isso manualmente quando necessário; não existe obrigação diária para manter o acesso.

Não se deve tratar HTTP 200 como sucesso da verificação: conferir `status`, `error` e `securityReviewRequired`. Falha gera alerta para diagnóstico; perda confirmada exige ação administrativa. Não há cron presumido, automação de emissão de certificados ou configuração Traefik pelo banco.

## Compatibilidade legada e Ótica São Paulo

- Registro V1 `active` com desafio/revisão válidos e evidência histórica coerente (`checkedAt`, `verifiedUntil`, `certificateExpiresAt`) permanece ativo mesmo com a antiga janela vencida. Não é necessário reconfigurar hostname, gerar novo desafio, alterar TXT ou editar dados para migrar.
- Ausência de prova, datas incoerentes, registro apenas `verified/disabled/awaiting_*`, organização removida, entitlement ausente ou carimbo novo incompleto/divergente não concede acesso. Nenhum domínio é ativado somente porque `Organization.domain` está preenchido.
- Primeira operação de monitoramento em registro legado preserva a data da prova anterior em `verifiedAt`, inclusive quando falhar; um erro não apaga a evidência nem se transforma em sucesso fictício.
- A organização já ativa da Ótica São Paulo usa o mesmo caminho genérico. Não existe regra específica no código para seu hostname. Sua compatibilidade foi simulada com fixtures; os registros reais não foram consultados/alterados nesta execução. Estado real inválido ou não ativo não será promovido automaticamente.
- Canonical MDS e cookies/sessões por origem continuam iguais. Providers, inboxes, credenciais, OAuth, webhooks, arquivos reais e canais não foram alterados. `observe_only` e `APPROVED_ENFORCEMENTS=[]` intactos.

## Matriz de aceitação

| Cenário | Evidência executável |
| --- | --- |
| Ativação inicial válida e Super Admin | Probes HTTP existentes, novo carimbo e testes PostgreSQL |
| Mais de 24h | Estado persistido com prova histórica e antiga janela vencida, leitura/API autorizadas |
| Reinício real | Runner para somente seu Next local e inicia novo PID; login e dados próprios antes/depois, settings sem alteração |
| Desativação e revogação | PostgreSQL/HTTP; acesso negado e reconcessão sem ativação automática |
| Substituição | Host anterior recusado e novo depende de nova prova |
| Host desconhecido/tenant estrangeiro/sessão copiada | Probes HTTP existentes mantidos |
| Falha transitória | Monitoramento com erro, status ativo e acesso preservados; nenhuma renovação fictícia |
| Perda confirmada | Alertas para inconsistências; teste da suspensão MDS imediata e recuperação com nova prova |
| Estado legado | Sem gravação de migração; rejeição de presença arbitrária/ausência de prova |
| MDS e White-Label | Probes C0–C5 e branding atuais |

Os testes anteriores de expiração/falha foram atualizados somente onde a política V1.1 muda explicitamente: um domínio já ativo não deve mais cair por relógio ou falha isolada. Asserções negativas de ativação inicial, tenant, hostname, origem, CAS, SSL/SSRF e revogação foram preservadas/ampliadas. Testes DNS sintéticos anteriores continuam registrados.

**Resultados locais:** 626/626 testes Node/TypeScript/PostgreSQL; 52 cenários HTTP de domínio; login/dados HTTP 200 antes e depois de reinício real do Next; 10/10 probes HTTP C0–C5; build Next/Webpack, typecheck, lint e diff check aprovados.

Resultados finais, comandos e hashes constam em `docs/evidence/CUSTOM_DOMAIN_UNIVERSAL_V1_1_2026-10-26.json`. CI remota desta evolução depende de autorização de publicação; execuções antigas não comprovam este novo código. Build Docker completo em VPS não foi executado por esta frente.

## Publicação futura no Coolify existente — não executada

1. Autorizar o envio do SHA final e conferir refs/fast-forward/gatilhos de Auto Deploy antes do push. A branch local contém a base remota atual e o diagnóstico preservado; não usar force-push ou publicar refs de backup.
2. Executar os quatro workflows para o SHA exato, incluindo o job HTTP com reinício local; validar build Docker desse SHA sem segredos em ARG/camadas. Não confundir build Next com imagem Docker homologada.
3. Registrar imagem/SHA estável realmente implantado, configuração atual e backup específico do namespace `customDomainV1` por organização. Backup/rollback não pode sobrescrever settings de providers ou apagar usuários/dados. Não precisa de migration.
4. Mediante autorização de deploy, selecionar **o mesmo recurso CRM**, confirmar fonte/commit final, Dockerfile oficial e comando direto Next sem migrations. Preservar variáveis existentes de domínio/proxy, segredo privado, `NEXTAUTH_URL`, redes, serviço Traefik e volume privado. Não alterar outros serviços.
5. Planejar a interrupção permitida; verificar eventos de canais em trânsito conforme plano operacional existente. Publicar somente esse CRM; não recriar providers nem limpar banco. Nenhum ajuste DNS/TXT/hostname é exigido pela V1.1.
6. Validar o canônico, domínio já ativo, tenant correto, permissões, canais e auditoria. Confirmar persistência após restart e prazo histórico sem editar dados reais para simular tempo. Monitorar erros; não ativar enforcement comercial ou piloto por consequência deste deploy.

### Rollback

Preferir desativar o recurso por flag global, manter o canônico e corrigir/republicar a versão estável apropriada. Se voltar à V1, lembrar: seu schema JSON estrito rejeita campos V1.1 e a política de expiração reaparece. Não remover campos ou reativar automaticamente registros reais para forçar compatibilidade. Retirar/segurar routers customizados conforme procedimento autorizado, garantir fallback canônico e restaurar somente namespace de domínio por CAS/snapshot quando explicitamente aprovado; nunca settings inteiros de providers nem VPS inteira. A imagem antiga só deve receber hosts para os quais seu guard seja seguro.

## Limitações reais

Não há monitoramento ou suspensão automática em produção. O operador é responsável por confirmar alertas e suspender incidentes; auto-suspensão com quorum/retries exigiria política e autorização próprias. Roteamento dinâmico Traefik, TLS/ACME, backend privado e corte dos anexos legados mantêm suas condições operacionais anteriores. Nenhuma dessas infraestruturas foi alterada ou validada na VPS nesta rodada.

Nenhum merge, push, deploy, migration de produção, alteração DNS/Coolify ou aprovação automática de G1–G6/piloto.
