REGRA ESPECÍFICA — CHATWOOT / ATENDIMENTO

É proibido aplicar imagem Chatwoot baseada em develop diretamente em produção.

Toda alteração no Chatwoot deve:

- partir da mesma versão oficial em produção;
- aplicar patch mínimo;
- preservar banco e volumes;
- possuir rollback;
- ser testada em ambiente teste;
- ser publicada com tag versionada MDS.

Exemplo correto:

Produção oficial:
chatwoot/chatwoot:v4.12.1

Imagem MDS:
ghcr.io/mundodigitalsolucoes/chatwoot:v4.12.1-mds