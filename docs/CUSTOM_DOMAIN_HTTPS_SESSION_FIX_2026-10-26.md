# Verificador HTTPS — correção de sessão TLS retomada

Base: `7bc9abcf5047dece457ecc96c94205d360629e04`, branch `audit/block2-sanitized`, PR #15 Draft. Nenhuma publicação, merge, deploy, alteração DNS/TXT/Traefik/comercial/banco real/providers.

## Causa comprovada em reprodução

O `pinnedHttpsProbe` usava o agente HTTPS padrão, que conserva sessões TLS. Em **Node v22.23.4 Alpine / OpenSSL 3.5.9 / c-ares 1.34.9**, quando o servidor fecha a conexão e a próxima usa sessão TLS retomada:

- HTTP e TLS continuam válidos; `socket.authorized === true`.
- `socket.isSessionReused() === true`.
- `socket.getPeerCertificate()` não fornece `valid_to` nesse caso reproduzido.
- O código calcula `expires` ausente e rejeita em `INVALID_PROOF`.
- `createDomainProbe` converte essa exceção em `awaiting_https / https_unavailable`.

Não foi necessário alterar DNS, roteamento ou certificado para reproduzir. O mesmo código e a mesma versão Node citada pelo responsável foram executados em contêiner temporário sem rede externa. Servidor HTTPS e CA eram sintéticos. O transporte do teste converte somente o IP público fixture/porta 443 em loopback/porta efêmera; a validação SNI/TLS, o código do verificador e as estruturas do lookup permanecem reais.

A hipótese de incompatibilidade de `lookup` **não se confirmou**: Node solicitou `all: true`, o callback devolveu array `{address, family: 4}` conforme o contrato, e nenhuma tentativa produziu `ERR_INVALID_IP_ADDRESS`. O erro do teste manual da VPS não é, isoladamente, evidência contra o lookup do código.

**Limite da conclusão:** o defeito no código e sua conversão no erro reportado foram comprovados. Não houve captura da sessão/socket da tentativa específica da VPS; não se afirma que esta seja a única causa possível naquela instalação. DNS, chave do proxy e prova podem ter falhas independentes, e não foram ignorados.

## Correção mínima

`src/lib/domains/network.ts`: adicionar **`agent: false`** à requisição HTTPS. O Node cria agente de uso único; não reutiliza cache de sessão entre probes. Cada prova obtém certificado completo em handshake novo.

Mantidos sem alteração:

- IP público previamente validado e fixado no lookup; formato escalar e `all: true`.
- Porta 443, Host/SNI do domínio, `rejectUnauthorized: true` e verificação de validade do certificado.
- Timeout, limite de resposta, ausência de redirects, interpretação estrita da resposta.
- TXT exato, IPv4 autorizado, rejeição de AAAA e proteção SSRF.
- Prova HMAC vinculada a hostname/desafio/nonce e segredo privado do proxy.
- Estado, cronologia, ativação persistente V1.1, auditoria e controles de revogação.

Custo: handshake TLS completo em cada verificação administrativa/periódica opcional. Não afeta pooling de requisições da aplicação, Atendimento ou providers; `agent: false` é local ao probe.

## Evidência antes/depois

20 tentativas na imagem Alpine disponível localmente, Node exato v22.23.4, com 5 tentativas por modo:

| Modo | Antes | Depois |
| --- | --- | --- |
| Conexão nova, sem cache de sessão | 5/5 | 5/5 |
| Conexão mantida pelo agente | 5/5 | 5/5 |
| Nova conexão com cache de sessão | 1/5 | 5/5 |
| Agente padrão, servidor responde Connection: close | 1/5 | 5/5 |
| Total | 12/20 | **20/20** |

Nos 8 erros anteriores, a sessão era retomada, autorizada e sem validade do certificado retornada pela API do socket. Após a correção, as 20 conexões vieram autorizadas com certificado e sem retomada. Nenhuma conexão a produção ou IP público foi feita: Docker `--network none`, somente fixtures transferidas por stdin para tmpfs, contêiner removido automaticamente.

### Regressão permanente

`tests/custom-domain-real-tls.test.mjs` gera CA/certificado temporários com OpenSSL e usa TLS real em loopback. O teste:

1. Executa o probe completo, com DNS de fixture, para **dois hostnames**, cinco verificações seguidas por hostname, encerrando cada conexão no servidor.
2. Valida prova HMAC, certificado, SNI, lookup fixado e ausência de retomada.
3. Confirma rejeição real de certificado com hostname incompatível, antes de entregar HTTP.
4. Confirma rejeição de IP privado antes de qualquer lookup/conexão.
5. Apaga as chaves/certificados sintéticos ao terminar; não há material TLS incluído no Git ou artefatos publicados.

Executado contra o código original: FAIL na verificação após a primeira conexão. Contra a correção: PASS. Também foi preservado/ampliado `tests/custom-domain-https-adapter.test.mjs`, incluindo o contrato do agente de uso único e ambos os formatos de lookup.

Comando direcionado: `node node_modules/tsx/dist/cli.mjs --test tests/custom-domain-real-tls.test.mjs tests/custom-domain-network.test.ts tests/custom-domain-https-adapter.test.mjs tests/custom-domain-persistent.test.ts` — **39/39**. O teste real também reproduziu a falha no Node 22.21.1 do workspace; a reprodução Alpine independente usa exatamente 22.23.4.

**Resultados finais locais:** 627/627 testes Node/TypeScript/PostgreSQL; 52 cenários HTTP de domínio com reinício real aprovado; 10/10 probes HTTP C0–C5; build Next/Webpack, typecheck, lint e diff check aprovados.

Resultados finais completos e fingerprints: `docs/evidence/CUSTOM_DOMAIN_HTTPS_SESSION_FIX_2026-10-26.json`.

## Impacto sobre o incidente e outros clientes

A falha não depende da Ótica São Paulo e pode afetar qualquer domínio cuja conexão seja retomada. Não há regra por cliente nem troca de hostname, TXT ou desafio.

O HTTP 421 original por organização `disabled` e capacidade ausente é **comportamento correto de segurança**, independente desta falha HTTPS. Conceder novamente a capacidade não autoriza reativação automática. A correção não modifica a configuração comercial nem promove estados.

Depois de publicação/deploy futuramente autorizados, o Super Admin deverá executar `verify`, conferir sucesso real, e então `activate` se o domínio continuar desativado/não verificado. Não repetir `configure` nem alterar TXT para instalar o patch. Se `https_unavailable` persistir, coletar erro sanitizado do socket e resultado de prova no processo real; não relaxar IP/TLS/HMAC nem presumir sucesso pelo HTTP 200 do endpoint público.

## CI, publicação e rollback

A conexão GitHub voltou a funcionar nesta rodada. As **sete execuções da base V1.1 `7bc9abc` foram confirmadas success**, inclusive os dois workflows PostgreSQL que estavam pendentes por 401 no acompanhamento anterior. Isso não comprova a nova correção.

O teste real `.test.mjs` é incluído automaticamente pelo job Node/PostgreSQL existente. Não são necessários workflow, migration, variável obrigatória ou dependência nova; o runner Ubuntu já dispõe de OpenSSL usado pelo teste. CI remota deste novo patch requer autorização de envio; não houve push nesta missão.

Build/startup/Dockerfile e providers não mudam. Um eventual deploy autorizado deve preservar a imagem estável e as configurações do mesmo CRM; voltar à imagem anterior não exige migration, mas reintroduz o defeito TLS. Não reverter banco nem configuração de domínio como forma de rollback desse patch de transporte.

Não declara produção corrigida, gates aprovados ou piloto liberado sem validação real posterior.
