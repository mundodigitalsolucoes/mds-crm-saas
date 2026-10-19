# Bloco 02 — Decisão técnica: consumo único do state OAuth Instagram

**Status:** proposta para homologação; não implementada. **Escopo:** somente Instagram OAuth. **Sem migração, merge ou deploy nesta etapa.**

## Estado verificado no código
- `instagram-oauth-state.ts`: state assinado com HMAC-SHA256 (`NEXTAUTH_SECRET`), `organizationId`, `userId`, `issuedAt` e nonce de 32 bytes em hexadecimal; validade de dez minutos.
- `instagram/connect`: nonce aleatório em cookie HttpOnly, SameSite=Lax, Secure em produção, caminho do callback, validade de dez minutos.
- `instagram/callback`: valida state, nonce do cookie e identidade/organização da sessão antes de trocar código e gravar token; expira o cookie no redirect.
- `src/lib/rate-limit.ts`: armazenamento Map local ao processo; **não garante exclusão mútua entre instâncias, reinícios ou callbacks simultâneos**.
- `package.json`: sem cliente Redis dedicado; `prisma/schema.prisma` não possui registro de nonce OAuth dedicado.

## Risco residual
Dois callbacks simultâneos podem apresentar o mesmo cookie/state antes que o navegador processe a resposta de expiração. O código de autorização da Meta é normalmente de uso único, mas isso **não substitui** uma garantia atômica própria de consumo do state. Não classificar o fluxo como single-use.

## Contrato proposto (implementação futura)
1. Na emissão, gerar nonce de 256 bits, associar a hash SHA-256 do nonce, organização, usuário, provedor, expiração e estado `pending`. Nunca persistir token Meta nem nonce bruto.
2. No callback, depois de verificar assinatura, expiração, cookie e sessão, consumir o registro com operação **atômica e condicional** (`pending -> consumed`) antes da troca do código. Somente uma requisição pode obter sucesso.
3. Ausência, expiração, consumo anterior ou falha do armazenamento => rejeição **fail-closed**, sem chamar Meta nem alterar organização.
4. TTL de dez minutos; retenção mínima e limpeza automática; limite de registros por usuário/organização; métricas sem dados sensíveis.
5. Em caso de erro após consumo, iniciar **novo** OAuth; não reabilitar nonce consumido.
6. Garantir que instâncias distintas compartilhem o mesmo armazenamento e que a operação de consumo seja indivisível.

## Alternativas
- **Banco PostgreSQL existente:** tabela mínima com chave única do hash do nonce e `UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now()` verificando contagem = 1. Exige migração e revisão do modelo.
- **Redis compartilhado:** registro com TTL e consumo via script atômico; exige serviço/configuração e testes de falha. `GETDEL` pode consumir uma chave atômica, mas precisa validar a associação e a expiração no contrato.
- **Map em memória ou apenas cookie:** rejeitados para garantia de uso único.

**Recomendação:** PostgreSQL já usado pelo Prisma, sujeito à aprovação da migração e à verificação de impacto no ambiente. Não adicionar Redis somente para esta funcionalidade sem justificativa operacional.

## Homologação obrigatória
- Primeiro callback válido; segundo callback idêntico rejeitado.
- Duas requisições simultâneas: exatamente uma consome; nenhuma chamada Meta na perdedora.
- Mesmo nonce com outro usuário, tenant ou navegador rejeitado.
- Expiração, ausência do armazenamento e indisponibilidade => fail-closed.
- Testar retorno real Meta e cookie SameSite/Lax com sessão NextAuth.
- Verificar `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `META_INSTAGRAM_APP_ID` e `META_INSTAGRAM_APP_SECRET` antes de homologação.

**Observação:** a conta do piloto Ótica São Paulo não é necessária para decidir a arquitetura; será solicitada somente na homologação funcional do CRM white-label.
