# METODOLOGIA OFICIAL DE DESENVOLVIMENTO — MDS CRM SaaS

STATUS OFICIAL — MAIO 2026

---

# OBJETIVO

Este documento define a metodologia oficial obrigatória para qualquer análise, correção, implementação, deploy ou evolução do MDS CRM SaaS.

Objetivos:

* impedir regressão;
* eliminar alterações por hipótese;
* aumentar previsibilidade;
* preservar estabilidade operacional;
* proteger o core do sistema;
* padronizar o trabalho entre agentes e desenvolvedores.

---

# REGRA MÃE

É PROIBIDO IMPLEMENTAR POR HIPÓTESE.

Nenhuma alteração pode ser sugerida ou executada sem auditoria prévia.

É obrigatório:

* localizar evidências;
* validar dependências;
* identificar causa raiz;
* mapear impacto;
* definir rollback.

---

# FLUXO OFICIAL

Toda alteração deve seguir obrigatoriamente:

FASE 1 — AUDITORIA

↓

FASE 2 — PLANO

↓

FASE 3 — IMPLEMENTAÇÃO

↓

FASE 4 — VALIDAÇÃO

Nenhuma fase pode ser pulada.

---

# FASE 1 — AUDITORIA

OBJETIVO

Entender o problema real antes de propor qualquer alteração.

---

## OBRIGATÓRIO

Antes de qualquer mudança:

* auditar arquivo exato;
* auditar rota relacionada;
* auditar fluxo completo;
* auditar dependências;
* auditar tabelas afetadas;
* auditar APIs envolvidas;
* auditar integrações relacionadas;
* validar impacto multi-tenant;
* validar impacto em providers;
* validar impacto em Atendimento.

---

## PROIBIDO

Nunca:

* inferir código;
* assumir arquitetura;
* supor comportamento;
* propor correção sem leitura;
* alterar por tentativa e erro.

---

## RESPOSTA PADRÃO DA AUDITORIA

Toda auditoria deve apresentar:

### Arquivo auditado

Lista de arquivos analisados.

### Dependências auditadas

Lista de dependências identificadas.

### Evidência encontrada

Trecho ou comportamento identificado.

### Hipóteses avaliadas

Hipóteses confirmadas e descartadas.

### Causa raiz

Problema real encontrado.

### Impacto

Áreas afetadas.

---

# FASE 2 — PLANO

OBJETIVO

Definir estratégia antes de alterar qualquer código.

---

## OBRIGATÓRIO

Apresentar:

### Impacto

O que será afetado.

### Risco

Possíveis efeitos colaterais.

### Arquivos afetados

Lista exata.

### Dependências afetadas

Fluxos relacionados.

### Estratégia

Como a correção será realizada.

### Rollback

Como reverter.

---

## PROIBIDO

Não alterar código ainda.

A Fase 2 é apenas planejamento.

---

# FASE 3 — IMPLEMENTAÇÃO

OBJETIVO

Executar alteração mínima necessária.

---

## REGRA OFICIAL

Alterar somente o necessário.

Nunca:

* refatorar por estética;
* reorganizar código sem necessidade;
* alterar múltiplos fluxos simultaneamente;
* misturar correção e melhoria.

---

## FORMATO OBRIGATÓRIO

### ANTES

Mostrar trecho real encontrado.

### DEPOIS

Mostrar trecho completo para substituir.

---

## REGRA DE ENTREGA

Se houver mais de 3 alterações:

Entregar:

* função completa;
  ou
* componente completo;
  ou
* arquivo completo.

Nunca entregar:

* linhas isoladas;
* trechos parciais;
* instruções ambíguas.

---

# FASE 4 — VALIDAÇÃO

OBJETIVO

Garantir que a alteração não gerou regressão.

---

## BUILD

Executar:

```bash
npm run build
```

---

## PRISMA

Executar:

```bash
npx prisma validate
```

---

## GIT

Executar:

```bash
git add .
git commit -m "descrição"
git push origin main
```

---

## DEPLOY

Executar deploy manual no Coolify.

---

## TESTES

Validar:

* fluxo alterado;
* integrações relacionadas;
* multi-tenant;
* providers;
* Atendimento;
* Leads;
* Pipeline;
* Follow-up;
* Tasks;
* Agenda.

Conforme aplicável.

---

# REGRA DE EXECUÇÃO

Executar apenas UMA alteração por vez.

Fluxo obrigatório:

1. Auditoria
2. Plano
3. Implementação
4. Build
5. Prisma
6. Commit
7. Push
8. Deploy
9. Validação em produção

Somente depois:

próxima alteração.

---

# REGRA DE ALTERAÇÃO EM LOTE

Evitar alterações em lote.

É proibido:

* corrigir vários bugs simultaneamente;
* refatorar enquanto corrige;
* alterar múltiplos módulos sem necessidade.

Priorizar:

* mudanças pequenas;
* mudanças rastreáveis;
* mudanças reversíveis.

---

# REGRA DE REGRESSÃO

Toda alteração deve assumir que:

o maior risco do projeto é regressão.

Portanto:

* preservar comportamento validado;
* preservar integrações homologadas;
* preservar providers;
* preservar Atendimento;
* preservar arquitetura oficial.

---

# REGRA DOS AGENTES

Todo agente deve:

* seguir esta metodologia integralmente;
* trabalhar um passo por vez;
* evitar hipótese;
* evitar refactor desnecessário;
* validar dependências antes de alterar;
* respeitar Core Protegido;
* respeitar Providers;
* respeitar Atendimento;
* respeitar a Arquitetura Oficial.

---

# DOCUMENTOS RELACIONADOS

Leitura obrigatória:

00-README-OPERACIONAL

01-DOCUMENTO-MESTRE-OFICIAL

02-STATUS-ATUAL

03-LOG-DE-DECISOES

04-ARQUITETURA-OFICIAL

05-REGRAS-DE-IMPLEMENTAÇÃO

07-CORE-PROTEGIDO

09-MAPA-DE-DEPENDENCIAS

10-CHECKLIST-DE-VALIDACAO

12-DEPLOY-E-INFRA-OFICIAL

13-HANDOFFS

---

# DIRETRIZ FINAL

Nenhuma correção possui prioridade maior que:

* estabilidade;
* previsibilidade;
* proteção do core;
* prevenção de regressão.

Toda alteração deve ser guiada por evidência e não por hipótese.

# REGISTRO OBRIGATÓRIO

Após homologação:

atualizar:

15-CHANGELOG
16-BUGS-RESOLVIDOS

antes do encerramento da tarefa.

FIM DO DOCUMENTO.
