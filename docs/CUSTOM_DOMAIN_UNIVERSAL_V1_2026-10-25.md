# Domínio Próprio Universal — contrato operacional atualizado para V1.1

Atualização de 26/10/2026: ativação persistente. Ver `CUSTOM_DOMAIN_UNIVERSAL_V1_1_2026-10-26.md` para política vigente e novos testes. Resultados de 25/10 abaixo são históricos, não execuções da V1.1.

Base auditada: `1ea0a216792cfb7b1f850c318f6851f7de87e249`, branch local `audit/block2-sanitized`.
Data: 25/10/2026. Nenhuma alteração em DNS, Coolify, certificados reais, produção ou dados de clientes. Nenhum push/merge/deploy desta implementação.

## Contrato e arquitetura

Leitura considerada: Documento Mestre, Arquitetura Oficial, Core Protegido, Regras de Implementação, Metodologia e decisão-mestre comercial de 20/10/2026. O único commit recebido após a candidata anterior foi o ajuste da Sidebar em `1ea0a21`, preservado integralmente.

- `custom_domain` é uma capability disponível no `FEATURE_CATALOG`, independente de `white_label` e dos módulos. Não concede Atendimento, Vendas, Marketing ou permissões operacionais.
- O editor de planos já consome esse catálogo: o novo checkbox usa o contrato existente de `Plan.features`. A organização usa `Organization.features`; concessão não ativa hostname.
- Reutilizados `Organization.domain` (`@unique`) e `Organization.settings`. O namespace versionado `customDomainV1` armazena status, desafio público de posse, revisão, validade e vencimento do certificado. Nenhuma coluna, tabela, migration ou dependência nova.
- Estados: não configurado, aguardando DNS, aguardando HTTPS, verificado, ativo, desativado e erro. Verificar e ativar são comandos distintos. Substituir gera desafio novo e invalida o hostname anterior.
- Só o Super Admin MDS administra pelo novo endpoint `/api/admin/organizations/[id]/domain`, autenticado pelo verificador existente. Cliente owner/admin/comum não recebe autoridade comercial.
- Operações e auditoria são transacionais. CAS compara `settings`, `features`, hostname e organização ativa; lock PostgreSQL e unicidade impedem reservas concorrentes. Comparação case-insensitive também recusa duplicidades legadas. O resolver não escolhe arbitrariamente entre duas linhas equivalentes.
- JSON de providers e configurações desconhecidas é preservado. Falha de auditoria reverte a mutação. Concessão/revogação preserva ordem, duplicatas e identificadores comerciais legados.
- Sincronização de plano e propagação existentes invalidam o domínio **somente quando muda a presença de `custom_domain`**. Recontratar não reativa estado antigo. Nenhum processamento de webhook/Asaas foi editado; a função compartilhada `syncPlanLimits` mantém seus demais campos e regras.

## Hostname, proxy e sessão

Hostname é normalizado em ASCII/IDNA, minúsculas e sem ponto terminal; URLs, credenciais, portas arbitrárias, wildcard, IP e nomes locais são recusados. A correspondência é exata, nunca por substring/sufixo. O domínio canônico vem de `NEXTAUTH_URL`, que deve continuar apontando à MDS.

O hostname vem de `Host`, não de `X-Forwarded-Host`. Para hosts personalizados, o aplicativo exige uma origem de proxy autenticada: `X-CRM-Proxy-Key` deve ser sobrescrito pelo proxy com um segredo dedicado e `X-Forwarded-Proto` precisa indicar HTTPS. `X-Forwarded-Host`, quando presente, deve ser coerente após normalização; não escolhe tenant. O backend direto não deve ficar exposto à internet. Segredo não é enviado ao navegador nem pelo verificador HTTPS público.

O recurso fica desativado por padrão. Host desconhecido/pendente/inativo ou com ativação inválida é recusado com 421, sem dados. O canônico é preservado; não se redireciona um visitante de hostname arbitrário ao CRM. Mesmo com o recurso desativado, hosts não canônicos são recusados. Requisições sem autoridade são recusadas (400/421 conforme a camada HTTP).

A configuração existente do NextAuth foi adaptada, não substituída:

1. Credenciais em domínio personalizado só autenticam usuário da organização correspondente.
2. JWT novo contém origem e organização de login imutáveis. Atualização de membership/role/permissões continua usando o banco; mover o usuário não transfere a organização de emissão da sessão.
3. Sessão de outra origem/organização não é serializada ao frontend e não autoriza APIs. Isso continua valendo para tokens com origem customizada depois de desabilitar o recurso.
4. Cookies NextAuth permanecem host-only, sem `Domain` compartilhado. Com o recurso habilitado, são Secure/HttpOnly e usam os padrões SameSite do NextAuth. Sessões legadas continuam aceitas **apenas no canônico**, nunca como sessão de domínio customizado.
5. Redirects/callbacks de login/logout ficam no origin validado; URL externa é descartada. `NEXTAUTH_URL` não é reescrito globalmente por cliente.
6. Recuperação só emite/consome token do tenant do hostname; o link usa a origem validada. SMTP/Resend, remetente/template e providers de e-mail não foram alterados.
7. Login recebe apenas campos públicos do branding existente. White-Label sem domínio continua no canônico; domínio sem White-Label exibe MDS. Cadastro de outra organização não é oferecido/aceito no hostname do cliente.

Administração MDS, signup, widgets/recursos públicos por slug e callbacks/webhooks externos permanecem no canônico. A operação autenticada de Atendimento usa os handlers existentes. Cadastro/reconexão de canais que envolve OAuth deve continuar pelo canônico com login próprio; esta implementação não cadastra redirect URIs nos providers nem transfere cookies para concluí-los. Não altera engine/iframe, inboxes, credenciais, filas ou roteamento dos providers.

Hosts customizados não publicam `/uploads` legados; o otimizador de imagem não permite contornar isso. Branding deve usar assets intencionalmente públicos em `/images` ou HTTPS validado. Isso **não corrige** a exposição estática legada ainda pendente no domínio principal nem migra arquivos reais.

## Verificação de posse, TLS e aplicação correta

1. TXT `_mds-crm-verification.<hostname>` com `mds-crm=<desafio público gerado pela MDS>`.
2. Resolução A precisa apontar exclusivamente a IPv4 públicos presentes em `CRM_CUSTOM_DOMAIN_INGRESS_IPS`. CNAME pode apontar ao canônico, desde que a resolução satisfaça a condição.
3. Nesta V1, AAAA é recusado; não há allowlist IPv6. Se o CNAME herdar AAAA, usar A direto para o IPv4 autorizado, sem alterar o DNS do domínio MDS. Proxy/CDN que muda o endereço observado não está homologado.
4. DNS tem timeout e tentativas limitados. Private/loopback/link-local/metadata/multicast e IPs não autorizados não recebem conexão HTTPS.
5. HTTPS usa porta 443, IP previamente validado e fixado no lookup, SNI do hostname e validação TLS normal. Não segue redirect, não desabilita certificados e limita resposta a 4 KiB/timeout de 5 segundos.
6. `/.well-known/mds-crm-domain-check` responde a nonce fresco com HMAC vinculado a hostname/desafio/nonce. Isso confirma que a rota chega ao CRM com o proxy autenticado, além de possuir certificado válido. Endpoint não retorna usuário, configuração ou chave.
7. A prova inicial continua recente (até 24h, limitada pelo certificado) para permitir a primeira ativação explícita. **Essa janela nunca expira a ativação já concedida.** Domínio ativo permanece assim após 24h e reinícios. Falha isolada de monitoramento é auditada sem renovar a prova ou suspender automaticamente; perda de controle confirmada deve ser suspensa pela MDS com `deactivate`. Revogação comercial bloqueia imediatamente.

**Não há worker/cron automático habilitado.** Monitoramento posterior é opcional e reutiliza `verify`, sem obrigação de intervenção diária. HTTPS válido e renovação ACME continuam obrigatórios no proxy; `certificateExpiresAt` é a última observação, não um interruptor de acesso que ignora renovações reais. Ver a política de incidentes V1.1.

## Configuração futura na infraestrutura existente — não executada

| Campo/condição | Especificação |
| --- | --- |
| Aplicação | Mesmo recurso/contêiner/banco do CRM, porta interna 3000; nenhuma instância por cliente |
| `NEXTAUTH_URL` | Manter `https://crm.mundodigitalsolucoes.com.br` |
| `CRM_CUSTOM_DOMAINS_ENABLED` | `true` somente após aprovação e preparação do proxy; desligado/ausente recusa domínios customizados |
| `CRM_CUSTOM_DOMAIN_PROXY_SECRET` | Segredo novo, aleatório, dedicado, com no mínimo 48 caracteres; não reutilizar NEXTAUTH/ADMIN/TOKENS/provider secrets; não registrar em Git, build args ou respostas |
| `CRM_CUSTOM_DOMAIN_INGRESS_IPS` | IPv4 públicos reais da VPS/entrada MDS, separados por vírgula; não usar IP Docker, loopback ou valores dos testes |
| Proxy | Traefik com Host exato, TLS, `passHostHeader: true`, headers privados sobrescritos, encaminhamentos de visitantes removidos/não confiáveis |
| Backend | Porta interna não exposta diretamente à internet; validar rede/ACL existente sem presumir seu estado |
| Healthcheck | Enviar Host canônico; um healthcheck com hostname interno arbitrário passa a ser recusado |
| Arquivos | Volume privado/corte legado continuam com os requisitos anteriores; domínio não substitui proteção de anexos |
| Upload | Handler continua 10 MiB + envelope máximo de 64 KiB; cópia do middleware foi ajustada para 11 MiB. Proxy deve impor limite compatível, por exemplo 12 MiB, antes de encaminhar; não aumentar o limite do arquivo |

### Roteamento sem novo deploy do CRM por cliente

A aplicação não precisa de nova build, variável por cliente ou deploy por organização. O proxy ainda precisa conhecer cada hostname/certificado.

Para cumprir literalmente **sem novo deploy do aplicativo**, a infraestrutura deve suportar configuração dinâmica/hot reload do Traefik, por exemplo file provider observado e referência ao serviço CRM já existente. Isso NÃO foi verificado na VPS. Se o fluxo disponível no Coolify apenas modificar labels e exigir recriar o aplicativo, o requisito de zero deploy por novo domínio continuará bloqueado até autorizar/configurar um mecanismo dinâmico no proxy existente.

Template conceitual para revisão operacional (não copiar os placeholders como valores reais):

```yaml
http:
  routers:
    crm-cliente-identificador:
      rule: "Host(`crm.cliente.com.br`)"
      entryPoints: ["<ENTRYPOINT_HTTPS_CONFIRMADO>"]
      service: "<SERVICO_CRM_EXISTENTE>@docker"
      middlewares: ["mds-custom-domain-origin@file"]
      tls:
        certResolver: "<RESOLVER_ACME_CONFIRMADO>"
  middlewares:
    mds-custom-domain-origin:
      headers:
        customRequestHeaders:
          X-CRM-Proxy-Key: "<SEGREDO_PRIVADO_FORA_DO_GIT>"
          X-Forwarded-Proto: "https"
          X-Forwarded-Host: ""
```

O middleware de headers pode ser compartilhado entre routers. Remover/reescrever encaminhamentos recebidos do visitante; não habilitar confiança irrestrita em forwarded headers. Resolver, serviço, entrypoint, file provider, caminho observado e permissões precisam ser coletados na infraestrutura real. Não são nomes confirmados. A regra precisa encaminhar todo o hostname ao mesmo CRM, sem override de login para outro serviço.

O certificado é emitido/renovado pelo mecanismo ACME configurado no proxy, não pela gravação no banco. Verificar A/CNAME, porta 80/443, CAA e emissão antes de ativar. Não remover controles DNS/TLS para forçar sucesso.

### Piloto Ótica São Paulo

Hostname pretendido: `crm.oticasaopaulorp.com.br` — usado somente neste checklist, sem regra específica no aplicativo.

1. Preservar organização, usuários, contratos, White-Label, credenciais e vínculos existentes. Confirmar Atendimento + Vendas + White-Label e contratar `custom_domain` explicitamente, sem Marketing adicional.
2. Abrir a organização no Super Admin → Domínio próprio. Configurar o hostname; deverá ficar **aguardando DNS**, não ativo.
3. Solicitar ao responsável DNS o TXT exibido pelo sistema em `_mds-crm-verification.crm.oticasaopaulorp.com.br` e CNAME de `crm.oticasaopaulorp.com.br` para `crm.mundodigitalsolucoes.com.br`, ou A para o IPv4 autorizado se necessário. Não copiar desafio de outro tenant.
4. Com autorização específica, configurar router HTTPS no proxy existente e confirmar emissão/validação do certificado e injeção de headers. Não iniciar outro CRM.
5. Verificar pela aplicação: posse, apontamento, TLS e prova do CRM precisam passar. Status **verificado** ainda não é ativo.
6. Acionar **Ativar domínio verificado**. Validar login anônimo com marca da ótica, login/logout/recuperação, owner/admin/comum e rejeição de sessão de outra origem.
7. Conferir MDS canônico, cliente B, Leads/Kanban/Atendimento e ausência de dados cruzados. Canais/OAuth continuam com seu procedimento canônico; não alterar Chatwoot/Evolution/Meta por causa do domínio.
8. Confirmar renovação ACME e responsável por alertas/incidentes. Monitoramento periódico é opcional; nenhuma revalidação manual diária é exigida para manter o domínio ativo.
9. Respeitar os bloqueios existentes de anexos legados e rollout comercial. `observe_only` e `APPROVED_ENFORCEMENTS=[]` foram preservados; esta frente não autoriza enforcement de Marketing, piloto ou produção.

## Rollback seguro

- Preferir desativar o domínio no Super Admin, manter o canônico operacional e confirmar 421 no hostname removido. Só então remover o router/DNS/certificado quando autorizado; não liberar outro tenant automaticamente.
- Substituir hostname gera desafio novo; o endereço anterior deixa de resolver o tenant. Desativar/remover não apaga usuários, dados, inboxes, tokens ou configurações de providers.
- Um domínio de organização removida permanece reservado até revisão MDS; não há tomada automática de hostname de tenant inativo.
- Kill switch `CRM_CUSTOM_DOMAINS_ENABLED` desligado bloqueia custom hosts, sem converter JWTs customizados em sessões canônicas. Reentrada pelo canônico exige seu próprio login/cookie; sessões canônicas legadas seguem compatíveis.
- Para voltar à imagem anterior `1ea0a21`, primeiro retirar os routers customizados e restringir ingress ao canônico: a imagem antiga não implementa esses guards. Reversão exclusiva do CRM, sem restaurar VPS inteira/banco/canais. Nenhuma migration precisa ser revertida.
- Não restaurar exposição pública de anexos como parte do rollback.

## Evidências e resultados locais

Ver `docs/evidence/CUSTOM_DOMAIN_UNIVERSAL_V1_2026-10-25.json` para resultados e fingerprint dos arquivos testados.

- Node 22.21.1, PostgreSQL 16 novo em loopback, apenas fixtures; código isolado em `/tmp/mds-domain-v1-*` sem `.env` reais.
- Suíte Node/TypeScript/PostgreSQL completa: **612/612 aprovados**, zero falhas, skips e TODOs, execução pelo CLI TSX. Testes originais de planos mantêm os valores e passam a conferir cada uma das três organizações na transação.
- Host HTTP real é enviado por `node:http`: o `fetch` do Node 22 normaliza Host para o endereço de conexão e não foi usado para simular autoridade. Credenciais de teste, cookies e chave do proxy não são publicados nos resultados.
- Network boundary positivo de DNS/certificado é injetado somente no factory do manager para testes. Transporte HTTPS é testado com mock de baixo nível, verificando lookup fixo, SNI, validação TLS, limite e ausência de redirects/credenciais. **Nenhum DNS, certificado ou proxy real da Ótica foi homologado.**
- Job `scripts/block2-domain-ci.mjs`: 50 cenários HTTP aprovados localmente, inclusive sessão/origem/organização imutável, troca de membership, plano/reconcessão, permissões e recuperação.
- Job `scripts/block2-c6-ci.mjs http`: 10 probes legados/de rollback, incluindo comentários e upload/download, sem enfraquecer as asserções originais. O novo workflow mantém PostgreSQL descartável e permissões de token somente leitura.
- Build de produção Next/Webpack, typecheck, lint dos arquivos alterados (zero erros/avisos) e `prisma validate` aprovados; manifesto compilado confirmou `/_middleware` com runtime Node e matcher global. Dockerfile/startup/dependências/schema não foram modificados; build Docker completo não é certificado por esta frente.
- CI remota do commit novo: pendente de autorização de envio. Não reutilizar resultados remotos de `2db12b4`/`1ea0a21` como prova desta implementação.
- Limitações de infraestrutura, monitoramento opcional, IPv4/AAAA, canais canônicos e roteamento dinâmico acima são condições reais, não automações concluídas.

### Falhas encontradas e corrigidas na validação

1. Middleware na raiz não era registrado para `src/app`; o manifesto estava vazio e domínio pendente retornou 200. `src/middleware.ts` agora delega a uma única implementação existente, e o teste exige 421 real.
2. Reexport puro não atende à descoberta do Next; adaptador usa função explícita. O aviso de depreciação middleware→proxy permanece; não foi executado codemod global.
3. Limite de cópia padrão do Next truncava multipart em 10 MB e gerava 400 indevido. Limite de cópia 11 MiB preserva arquivo máximo de 10 MiB, envelope e 413 de segurança.
4. Reconcessão por sincronização/propagação poderia ressuscitar estado ativo. Transição da capability agora o desativa transacionalmente; demais regras de limites/permissões permanecem fixadas por regressão.
5. Fixtures antigas não simulavam o novo limite transacional/import lazy. Foram adaptadas preservando/fortalecendo asserções; nenhum teste foi marcado TODO, pulado ou convertido em inspeção superficial para aprovar.

**Não aprova G1–G6 nem libera o piloto.** Pronto para revisão/homologação controlada da aplicação; ativação real depende das operações e verificações de infraestrutura explicitadas.
