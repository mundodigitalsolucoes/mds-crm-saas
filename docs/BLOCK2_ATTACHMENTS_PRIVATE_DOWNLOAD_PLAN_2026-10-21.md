# Anexos — proposta de armazenamento privado e download autenticado

**Somente plano para autorização. Não implementado nem executado. Piloto/publicação bloqueados.**

Na aceitação do Lote2, as APIs passaram nos nove negativos comerciais originais e em1089 verificações HTTP. Um arquivo sintético legado de Marketing, presente no diretório público **antes** de iniciar a cópia descartável do Next, continuou retornando200 com bytes por `/uploads/[org]/[file]`, com e sem sessão, nos três papéis. A organização fictícia não contratava Marketing. O endereço foi considerado conhecido, como ocorre com URLs obtidas antes da remoção de um módulo; não houve enumeração/brute force, acesso a arquivo real ou consulta de produção.

O handler de API e o motor comercial não recebem essa requisição estática. Uma mudança nos quatro helpers não elimina a exposição. Não se deve confundir UUID pouco previsível com autenticação/autorização. O teste ampliado mantém essa expectativa como FAIL e exit1; os seis requests são uma única superfície de download, distinta dos seis antigos negativos da API agora corrigidos.

## Recorte proposto

| Arquivo | Alteração futura proposta |
|---|---|
| `src/lib/attachments/storage.ts` **novo, fora dos quatro helpers autorizados** | Único adapter de armazenamento privado; raiz durável fora de public; caminhos por organização/filename persistidos, sem aceitar path do cliente; rejeitar traversal/symlink/caminho estrangeiro; escrita temporária e cleanup; nenhuma permissão/motor comercial novo |
| `src/app/api/attachments/route.ts` | POST gravar arquivo privado e retornar URL autenticada; GET da lista manter formato JSON, substituindo somente o destino do campo url. Preservar validações, permissões, guard transacional e contratos de módulo existentes |
| `src/app/api/attachments/[id]/route.ts` | Acrescentar GET de download ao arquivo existente: sessão ativa, tenant/uploader, entidade canônica, permissão view e contrato sob os mesmos mecanismos; responder bytes somente após autorização; headers private/no-store, nosniff e Content-Disposition seguro; DELETE usar o mesmo adapter privado |
| `scripts/block2-attachments-private-cutover.mjs` **novo** | Inicialmente apenas inventário/dry-run em ambiente explicitamente autorizado; apontar ausentes, divergências, duplicações, referências de branding e plano de cópia/corte. Nenhum apply automático ou consulta de produção nesta autorização futura de código |
| `.env.example` | Documentar somente o nome da configuração da raiz privada e placeholder sem credencial; não editar.env real, volumes ou Coolify |
| Testes HTTP/PostgreSQL/filesystem correspondentes | Arquivo existente antes do startup; anônimo/tenant estrangeiro/sem módulo/sem permissão negados; sete contratos e três papéis; sucesso legítimo; migração simulada e cleanup; upload negado sem arquivo/registro; exclusão negada preserva bytes; rollback de falha sem reexposição |

Não requer migration de schema. A assinatura do campo url continua string; a mudança necessária é seu destino para `/api/attachments/[id]`. Isso afeta links antigos/cache e precisa de aceite explícito de compatibilidade. Não se propõe reconstruir componentes, editar autenticação global, middleware/proxy, OAuth, providers ou White-Label.

## Legados, disponibilidade e condições de corte

1. Autorizar separadamente inventário real **somente de leitura**, caso necessário; não foi realizado agora. Não publicar nomes de arquivos, conteúdo ou IDs de clientes nos artefatos.
2. Configurar e aprovar raiz privada **durável**, backup e permissões no ambiente destino. Nenhuma mudança de Coolify, volume, credencial ou configuração está autorizada por este plano.
3. Classificar arquivos por metadados Attachment e referências `Organization.logo`/`Organization.favicon`. **Não mover todo public/uploads:** logos/favicons autorizados são públicos e devem continuar funcionando. Referência ambígua entre anexo e branding exige decisão manual, sem alteração automática.
4. Simular cópia/verificação/corte somente em fixtures. Preparar janela de gravação controlada, inventário final, backup privado e tratamento de arquivos órfãos/ausentes; não introduzir dual-write público para conteúdo privado.
5. O corte real exige autorização operacional própria. Remover os arquivos privados do caminho público somente após cópia íntegra e download autenticado comprovado; atualizar/reemitir os links de API, tratar caches/URLs antigas. O CRM não pode ser declarado protegido enquanto a cópia pública puder responder200. Tratar eventual cache externo mediante inventário/autorização específicos; nenhum CDN real foi acessado agora.
6. Confirmar por HTTP os links antigos retornando403/404, os downloads legítimos autenticados, isolamento/contrato e branding público correto. Só então discutir rollout nominal do piloto, CI/revisão independente e aceites G1–G6. Manter observe_only global e manifesto vazio até aprovação comercial própria.

## Rollback seguro

Manter backup e arquivos privados, suspender uploads/piloto de forma autorizada se necessário e preservar o endpoint autenticado. **Não restaurar cópias públicas como rollback**, não remover correções de tenant/P2 ou controles de permissão. Se a versão anterior só funcionar com URLs públicas, esse rollback não é aceitável para operação com conteúdo privado: requer manutenção/pausa e decisão do responsável. Não apagar arquivos/recibos/nonces/IDs de inbox ou dados do banco para “desfazer” a mudança.

A autorização proposta é para implementar/testar esse recorte de código e dry-run local. Produção, aplicação do corte, volumes/Coolify, push/PR, deploy e enforcement continuam dependendo de autorizações separadas.
