# Verificação de domínio — diagnóstico restrito de ownership_missing

Base: `2b4a39c9363b003fb574be7c340c59e81a75e3d1`, `audit/block2-sanitized`.
Data: 26/10/2026. Não houve push, merge, deploy, consulta ao banco real, alteração DNS/Coolify ou troca de desafios.

## Conclusão e limite da evidência

**A causa da persistência do erro na instalação real não foi demonstrada. Nenhuma correção funcional foi aplicada por hipótese.** A incompatibilidade inicial entre desafio salvo e TXT antigo foi informada pelo responsável; ela explica a primeira recusa. Não explica, isoladamente, a recusa depois da correção pública.

A evidência informada de DNS/TLS na VPS é considerada, mas não foi coletada diretamente nesta execução. O workspace não possui acesso confirmado ao processo/contêiner, banco ou proxy real. Não é possível inferir o SHA implantado a partir do HEAD GitHub ou dos resultados de CI.

## Fluxo efetivamente auditado

1. `OrganizationDomainEditor` envia somente `{action: "verify"}` ao endpoint da organização. Não envia desafio, TXT ou estado do formulário.
2. `PATCH /api/admin/organizations/[id]/domain` autentica Super Admin, valida o comando estrito e chama o manager com o `id` da rota. Não utiliza cache de GET para verificar.
3. `createDomainManager` faz `organization.findUnique` em cada comando. Lê `settings.customDomainV1` pelo schema, usando a string `state.challenge` dessa leitura.
4. `createDomainProbe` consulta `_mds-crm-verification.<hostname>` e exige que pelo menos um TXT, após concatenar seus fragmentos, seja **exatamente** `mds-crm=` + desafio recebido.
5. `ownership_missing` é retornado somente quando a consulta TXT terminou e nenhuma string correspondeu. Timeout/erro DNS retorna `dns_unavailable`. A/AAAA, certificado e prova de roteamento são etapas posteriores e não podem produzir `ownership_missing` nesse código.
6. O resultado é persistido por CAS sobre organização ativa, domínio, features e settings originais. Se houver mudança concorrente, é recusado com HTTP 409; o erro antigo não deve sobrescrever a configuração nova.
7. `verify` preserva desafio e revision. Somente `configure` gera um novo desafio. Não foi executado `configure` em instalação real nesta investigação.

Logo, se o código implantado for este e o PATCH efetivamente alcançar esta organização/banco, `ownership_missing` exige divergência entre o TXT retornado **ao verificador daquela requisição** e o desafio lido **por ela**. Uma consulta em outro processo, um GET anterior ou o DNS de outro resolvedor não comprova igualdade nessa mesma execução.

## Regressões executáveis acrescentadas

`tests/helpers/domain-verification-regressions.mjs`, registrado na suíte existente `tests/custom-domain-postgres.test.mjs`:

- Handler PATCH real e manager real; Prisma/PostgreSQL descartável; DNS UDP real criado em loopback. Somente o transporte HTTPS positivo é substituído por prova sintética válida. Nenhum DNS/HTTPS externo recebe tráfego.
- TXT antigo: HTTP 200 com status `awaiting_dns` e `ownership_missing`, sem chamada HTTPS.
- Atualização do TXT no mesmo processo e no mesmo Resolver: nova consulta de rede; TXT fragmentado/múltiplos registros corretamente concatenados; HTTP 200 com status `verified` e erro nulo. Desafio/revision e configuração de provider preservados.
- Alteração de desafio apenas na fixture PostgreSQL entre leituras: próximo PATCH usa o valor atual do banco, não o GET anterior. Tentativa de enviar desafio no corpo é recusada com HTTP 400 pelo schema real.
- Mudança concorrente de settings durante o probe: HTTP 409 `CONCURRENT_CONFIGURATION_CHANGE`; zero persistência do erro obsoleto, nenhuma configuração de provider sobrescrita, sem auditoria de sucesso indevida.

Uma hipótese de cache de TXT no singleton Resolver foi testada separadamente no Node 22.21.1/c-ares 1.34.5: primeira resposta antiga e segunda resposta nova, três consultas de rede contando um segundo Resolver. **Cache local persistente não foi reproduzido.** Isso não exclui cache em DNS upstream nem diferenças de versão/configuração na VPS.

Na primeira montagem dos testes, duas suítes de domínio PostgreSQL executadas em processos paralelos colidiram legitimamente sob Serializable (409). As novas regressões foram registradas no mesmo arquivo serial existente; nenhuma regra transacional, retry de aplicação ou asserção foi enfraquecida.

## Evidências mínimas ainda necessárias da instalação real

Coleta somente de leitura, sem reiniciar, reconfigurar ou repetir `configure`:

1. ID/tag da imagem e SHA de origem realmente em execução; quantidade de réplicas e destinos do serviço `mds-crm-saas`. Não imprimir `docker inspect` completo nem variáveis de ambiente.
2. Na requisição administrativa já efetuada: horário, URL/método, HTTP status e campos `status`, `error`, `checkedAt`/validade e revision quando disponível. Não compartilhar cookie, JWT, headers privados ou desafio. No contrato atual `checkedAt` está salvo em settings, não no DTO da API; esse campo deve ser conferido por leitura autorizada do banco, sem alterar o contrato público por suposição.
3. Confirmar se o GET e o PATCH usam o mesmo `organizationId`, mesmo backend e mesma origem. Conferir se a ação aparece na auditoria do banco esperado e se o horário corresponde à tentativa. Se não corresponder, investigar roteamento, imagem ou banco antes do DNS.
4. Confirmar no mesmo contêiner/banco, apenas por booleanos: há uma única organização com esse domínio? Está ativa? O desafio persistido tem formato válido? O TXT consultado pelo DNS padrão corresponde exatamente? Nenhum valor precisa ser publicado.
5. Informar se as cinco consultas Node usaram o DNS padrão ou `setServers(['1.1.1.1'])`; registrar versão Node/c-ares e quais servidores o Resolver utiliza. Uma comparação positiva com 1.1.1.1 não exclui resposta antiga do resolvedor padrão do processo da aplicação.
6. Confirmar se `checkedAt`/auditoria avançam após a tentativa. Erro visível sem nova execução não prova nova divergência DNS; pode ser resposta antiga, ação não concluída ou backend diferente. Essas são hipóteses, não causas confirmadas.

Se for necessária instrumentação na própria requisição, a alternativa pontual é correlacionar somente revisão/id da tentativa, booleano de correspondência e horário — nunca desafios, TXT, segredos, cookies ou hashes de credenciais. Essa instrumentação não foi implementada ou implantada nesta rodada. Não trocar de resolvedor, adicionar fallback público, relaxar comparação, reiniciar ou substituir o desafio sem demonstrar a causa.

## Resultados e reprodução local

Ambiente: Node 22.21.1, c-ares 1.34.5, PostgreSQL 16 descartável, arquivos e DNS sintéticos.

- Testes direcionados: **43/43**, zero falhas, skips ou TODOs.
- Suíte completa Node/TypeScript/PostgreSQL: **615/615**, zero falhas, skips ou TODOs. Lint dos dois arquivos de teste alterados: **zero erros/avisos**. `git diff --check`: aprovado.
- Comando direcionado: `node node_modules/tsx/dist/cli.mjs --test tests/custom-domain-network.test.ts tests/custom-domain-https-adapter.test.mjs tests/custom-domain-postgres.test.mjs`, com variáveis apontando exclusivamente para banco descartável de loopback.
- Não foi necessário repetir build Docker/Next: nenhuma aplicação, configuração de runtime, dependência, schema ou workflow mudou. A aprovação do build anterior não comprova o estado do processo real.

Segurança DNS/HTTPS, providers, `observe_only` e `APPROVED_ENFORCEMENTS=[]` permanecem intactos. Incidente real, domínio e piloto **não são considerados resolvidos/aprovados** por estes testes.
