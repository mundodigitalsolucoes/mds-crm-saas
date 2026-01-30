# 🚀 Comandos Git para Deploy

## Setup Inicial (primeira vez)

\`\`\`bash
# 1. Entre na pasta do projeto
cd mds-crm-nextjs

# 2. Inicializar Git (se ainda não estiver)
git init

# 3. Adicionar todos os arquivos
git add .

# 4. Primeiro commit
git commit -m "feat: Initial commit - MDS CRM SaaS Multi-Tenant"

# 5. Criar repositório no GitHub
# Acesse: https://github.com/new
# Nome: mds-crm-saas
# Tipo: Private

# 6. Adicionar remote do GitHub
git remote add origin https://github.com/SEU-USUARIO/mds-crm-saas.git

# 7. Renomear branch para main
git branch -M main

# 8. Push inicial
git push -u origin main
\`\`\`

---

## Updates Futuros (quando fizer mudanças)

\`\`\`bash
# 1. Ver status das mudanças
git status

# 2. Adicionar arquivos modificados
git add .

# 3. Commit com mensagem descritiva
git commit -m "feat: adiciona dashboard de KPIs"

# 4. Push para GitHub
git push origin main
\`\`\`

---

## Tipos de Commit (Conventional Commits)

Use prefixos padronizados:

\`\`\`bash
# Nova funcionalidade
git commit -m "feat: adiciona sistema de notificações"

# Correção de bug
git commit -m "fix: corrige erro no login"

# Atualização de documentação
git commit -m "docs: atualiza README com instruções"

# Melhoria de performance
git commit -m "perf: otimiza queries do Prisma"

# Refatoração de código
git commit -m "refactor: reorganiza estrutura de pastas"

# Estilo/formatação
git commit -m "style: formata código com Prettier"

# Testes
git commit -m "test: adiciona testes para API de leads"

# Build/deploy
git commit -m "build: atualiza configuração Docker"

# CI/CD
git commit -m "ci: adiciona GitHub Actions"
\`\`\`

---

## Branches (Recomendado para produção)

\`\`\`bash
# Criar branch de desenvolvimento
git checkout -b develop

# Fazer mudanças na branch develop
git add .
git commit -m "feat: nova funcionalidade"

# Push da branch develop
git push origin develop

# Quando estiver pronto, merge na main
git checkout main
git merge develop
git push origin main
\`\`\`

---

## Verificar Configuração

\`\`\`bash
# Ver remote configurado
git remote -v

# Ver status
git status

# Ver histórico de commits
git log --oneline

# Ver branches
git branch -a
\`\`\`

---

## Desfazer Mudanças

\`\`\`bash
# Desfazer mudanças em arquivo específico (antes do add)
git checkout -- arquivo.tsx

# Desfazer último commit (mantém mudanças)
git reset --soft HEAD~1

# Desfazer último commit (descarta mudanças)
git reset --hard HEAD~1

# Desfazer último push (CUIDADO!)
git push -f origin main
\`\`\`

---

## Ignorar Arquivos

O `.gitignore` já está configurado para ignorar:
- node_modules/
- .env
- .next/
- build/

---

## Checklist Antes do Push

- [ ] Código testado localmente
- [ ] Build funcionando (\`npm run build\`)
- [ ] Sem erros de linting
- [ ] .env não commitado
- [ ] Mensagem de commit descritiva

---

## Auto-Deploy no Coolify

Após configurar no Coolify:

1. Você faz push no GitHub
2. Coolify detecta automaticamente
3. Faz build e deploy automático
4. Aplicação atualizada em ~5min

Para verificar:
- Vá no Coolify → Deployments
- Veja o log em tempo real
- Aguarde status "Success"

---

## Troubleshooting Git

### Erro: remote origin already exists
\`\`\`bash
git remote remove origin
git remote add origin https://github.com/SEU-USUARIO/mds-crm-saas.git
\`\`\`

### Erro: failed to push
\`\`\`bash
# Puxar mudanças primeiro
git pull origin main --rebase
git push origin main
\`\`\`

### Erro: authentication failed
\`\`\`bash
# Usar Personal Access Token
# GitHub → Settings → Developer settings → Personal access tokens
# Copiar token e usar como senha
\`\`\`

---

## Exemplo Completo

\`\`\`bash
# Cenário: Você implementou dashboard de KPIs

cd mds-crm-nextjs

# Ver mudanças
git status

# Adicionar arquivos
git add src/app/dashboard/page.tsx
git add src/components/dashboard/

# Ou adicionar tudo
git add .

# Commit
git commit -m "feat: implementa dashboard de KPIs com métricas em tempo real"

# Push
git push origin main

# Aguardar deploy no Coolify (5-10 min)
# Verificar em: https://crm.mundodigitalsolucoes.com.br
\`\`\`

---

## 📋 Workflow Recomendado

**Desenvolvimento:**
1. Criar branch feature
2. Fazer mudanças
3. Testar localmente
4. Commit e push na branch
5. Abrir Pull Request
6. Code review
7. Merge na main
8. Deploy automático

**Hotfix (urgente):**
1. Criar branch hotfix
2. Corrigir bug
3. Testar rapidamente
4. Merge direto na main
5. Deploy

---

**Pronto para subir pro GitHub!** 🚀

Execute os comandos acima e seu código estará versionado e pronto para deploy no Coolify.
