# Bloco 02 — classificação de riscos para revisão independente

Candidato funcional: `cf45f38edbef8c475c90d801b0d75423b1e1499d`; base saneada local: `8aa1db0b893b042967c3905a3582916b713cf9ab`. Esta classificação não aprova gates. Dados detalhados e referências GHSA: [registro por diagnóstico e pacote](evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json).

## Lint

Os **182 erros e 77 avisos** foram reexecutados. Os 259 diagnósticos restantes têm âncora de código presente em cb1884e; zero diagnósticos novos identificados nos nove commits. Comparação textual não prova causalidade semântica. Há **44 diagnósticos em fronteiras sensíveis** (APIs/helpers de autenticação, autorização e integrações); prioridade de revisão, não 44 vulnerabilidades comprovadas. Tipagem ampla pode ocultar erros, mas exploração exige revisão do fluxo e testes. Nenhuma regra foi relaxada.

| Regra | Erros | Avisos | Risco/revisão |
| --- | --- | --- | --- |
| @next/next/no-assign-module-variable | 7 | 0 | Estilo/manutenção; sem falha de acesso demonstrada |
| @next/next/no-img-element | 0 | 6 | Imagens/acessibilidade; revisar configuração separadamente |
| @typescript-eslint/no-empty-object-type | 1 | 0 | Tipagem; revisar especialmente fronteiras de autorização |
| @typescript-eslint/no-explicit-any | 125 | 0 | Tipagem; revisar especialmente fronteiras de autorização |
| @typescript-eslint/no-require-imports | 2 | 0 | Estilo/manutenção; sem falha de acesso demonstrada |
| @typescript-eslint/no-unused-vars | 0 | 62 | Estilo/manutenção; sem falha de acesso demonstrada |
| jsx-a11y/alt-text | 0 | 2 | Imagens/acessibilidade; revisar configuração separadamente |
| prefer-const | 2 | 0 | Estilo/manutenção; sem falha de acesso demonstrada |
| react-hooks/exhaustive-deps | 0 | 7 | Comportamento React, efeitos e estado; não prova de bypass |
| react-hooks/immutability | 3 | 0 | Comportamento React, efeitos e estado; não prova de bypass |
| react-hooks/set-state-in-effect | 38 | 0 | Comportamento React, efeitos e estado; não prova de bypass |
| react/no-unescaped-entities | 4 | 0 | Estilo/manutenção; sem falha de acesso demonstrada |

## As 17 entradas do snapshot anterior

Todas as versões abaixo já estavam no lock da base e permanecem iguais. A classificação é de risco existente, não regressão de dependência introduzida pelos nove commits. A execução atual sinaliza **46**, não 17; os 17 são preservados como conjunto histórico solicitado. O inventário de uso examinou imports e contratos de execução; não é análise exaustiva de alcançabilidade. Nenhum exploit foi executado.

| Pacote (versão efetiva) | Severidade anterior | Cadeia/superfície e impacto condicionado |
| --- | --- | --- |
| @next/eslint-plugin-next 16.2.6 | high | eslint-config-next → plugin → fast-glob; ferramenta de lint, DoS de processamento de padrões. |
| axios 1.16.1 | high | Dependência direta usada por UI/stores client; gadgets de prototype pollution, HTTP2, redirect e uploads. Vetores do adapter Node dependem de uso servidor; não assumir que uso browser elimina todos os riscos. |
| baseline-browser-mapping 2.10.32 | moderate | Next/build e browserslist; entrada inválida pode terminar processo. Não há uso direto encontrado na aplicação. |
| brace-expansion 5.0.6 / 1.1.15 | high | ESLint/minimatch e TypeScript ESTree; CPU/memória/stack com padrões hostis, principalmente ferramenta. |
| braces 3.0.3 | high | Tailwind/chokidar e micromatch; stack exhaustion por padrão aninhado. |
| browserslist 4.28.2 | high | Autoprefixer/Babel/Tailwind; consumo de memória e estatísticas customizadas hostis no build. |
| chokidar 3.6.0 | high | Tailwind → chokidar → braces; severidade herdada, watcher de desenvolvimento/build. |
| esbuild 0.28.0 | low | tsx → esbuild; leitura arbitrária no dev server Windows. Runtime testado Linux, sem dev server esbuild exposto; aviso permanece. |
| eslint-config-next 16.2.6 | high | Direta dev → plugin → fast-glob; agregador de avisos da ferramenta, não falha independente. |
| fast-glob 3.3.1 / 3.3.3 | high | Plugin Next e Tailwind → micromatch → braces; DoS de glob, superfície de build/lint. |
| follow-redirects 1.16.0 | high | axios → follow-redirects; possível vazamento de credenciais em redirects com formatos específicos de headers no adapter Node. Não foi demonstrado envio servidor nesse caminho. |
| form-data 4.0.5 | high | axios → form-data; CRLF em nomes de campo/arquivo não confiáveis no multipart Node; não confundir com FormData nativo do browser. |
| js-yaml 4.1.1 | high | ESLint/eslintrc → js-yaml; consumo quadrático de CPU com YAML hostil. Builds e ferramentas não são excluídos da revisão. |
| micromatch 4.0.8 | high | fast-glob/Tailwind → micromatch → braces; risco herdado de padrões. |
| postcss-selector-parser 6.1.2 | moderate | Tailwind/PostCSS; DoS de recursão/CPU com CSS/seletores hostis no processamento. |
| source-map-js 1.2.1 | high | Next/PostCSS → source-map-js; DoS no parsing de source maps manipulados; pacote de produção, não demonstrado endpoint que aceite mapas arbitrários. |
| tailwindcss 3.4.19 | high | Direta dev, também peer de tailwindcss-animate; agregação de riscos de CSS, glob e watcher. |

## Auditoria repetida no mesmo momento

| Snapshot | Críticos | Altos | Moderados | Baixos | Total |
| --- | --- | --- | --- | --- | --- |
| Base cb1884e, execução atual | 2 | 37 | 8 | 2 | 49 |
| Candidata saneada, execução atual | 0 | 40 | 3 | 3 | 46 |
| Candidata, registro anterior | 0 | 14 | 2 | 1 | 17 |

A auditoria do lock da base foi executada em diretório temporário fora do checkout, com npm audit --package-lock-only --ignore-scripts, sem instalar pacotes nem executar scripts. O lock candidato não mudou nesta rodada. A contagem npm inclui propagação de metavulnerabilidades; o agregado retornado mudou para o mesmo lock entre os registros. Não se inferiu que todos os avisos foram publicados agora ou que surgiram por código novo. Na comparação pareada atual, **nenhum pacote sinalizado novo e nenhuma URL de advisory direto nova**; nanoid, sharp e uuid saíram da lista. Next, NextAuth e PostCSS foram atualizados no incremento anterior e mantêm avisos herdados já presentes na base (source-map-js e baseline-browser-mapping). Os demais nós sinalizados têm versões idênticas. Isso sustenta ausência de regressão conhecida de dependência nesta comparação, não ausência de vulnerabilidade alcançável.

O registro JSON lista os 46 pacotes atuais, suas versões/base, cadeia via, GHSA/range e sugestão npm. FixAvailable é sugestão variável do registry, não aprovação de compatibilidade; não executar audit fix nem downgrade de Next/ESLint automaticamente. Risco alto no runtime merece revisão específica; cadeia dev também importa para CI e processamento de arquivos hostis. Lint global e dependências permanecem abertos para decisão do responsável, sem exceção formal criada.

Adendo da candidata saneada: contagens182/77 e46 pacotes repetidas nesta branch; mapa de baseline mantém o mesmo conteúdo. A correção mínima de concorrência Widget não introduziu diagnóstico de lint nem dependência. A auditoria pareada da base foi repetida no lock original fora do checkout, novamente49/2 críticos. Base saneada ainda não existe no GitHub; não presumir autorização de envio.
