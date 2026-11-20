# Segurança

## Identidade e autorização da árvore

- O `public_id` identifica e compartilha a árvore, mas nunca concede edição.
- O token administrativo possui 256 bits aleatórios, é armazenado em hash SHA-256 no MySQL e em formato bruto somente na sessão PHP do responsável.
- O código de recuperação também possui 256 bits, é exibido uma única vez, armazenado somente em hash e rotacionado após uso.
- Comparações de credenciais usam `hash_equals`; a rotação usa update condicional para impedir reuso concorrente.
- Criação regenera o ID da sessão. Cookies devem ser `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O backend valida autorização em cada endpoint administrativo; ocultar controles no React é apenas uma camada de UX.

## Entrada e abuso

- Toda mutação exige CSRF válido.
- O nome é normalizado, limitado a 2–60 caracteres Unicode e rejeita caracteres de controle.
- IDs públicos aceitam somente 12 caracteres base64url.
- Corpos de criação/recuperação são limitados a 4 KiB.
- Criação, recuperação e envio de enfeites possuem rate limiting por IP em arquivos bloqueados com `flock`.
- SQL usa prepared statements; erros externos são genéricos e não revelam credenciais ou existência administrativa.

Os limites padrão podem ser ajustados com `TREE_CREATE_RATE_LIMIT`, `TREE_CREATE_RATE_WINDOW`, `TREE_RECOVERY_RATE_LIMIT`, `TREE_RECOVERY_RATE_WINDOW`, `ORNAMENT_CREATE_RATE_LIMIT` e `ORNAMENT_CREATE_RATE_WINDOW`. `storage/cache/rate-limits` deve existir ou poder ser criado pelo usuário PHP.

## Participações sociais

- Tipos e cores usam allowlist; o navegador não fornece coordenadas, `tree_id` ou capacidade.
- Nomes são normalizados, limitados a 2–40 caracteres e escapados pelo React.
- Toda criação exige CSRF, payload até 4 KiB e `Idempotency-Key` aleatória.
- A chave é persistida somente como hash e sua unicidade é restrita à árvore.
- A alocação usa transação, bloqueio da árvore e índices únicos contra conflitos concorrentes.
- Somente a sessão administrativa válida pode excluir; a query de remoção inclui árvore e enfeite.
- A API pública não expõe IDs internos, tokens nem hashes.

## Sigilo das mensagens

- A mensagem é obrigatória apenas para novas participações, normalizada e limitada a 2–500 caracteres Unicode; controles inadequados e conteúdo estruturalmente inválido são rejeitados.
- Enfeite e mensagem são inseridos atomicamente. O hash do payload impede que uma `Idempotency-Key` usada seja reaproveitada para trocar silenciosamente a mensagem.
- APIs públicas e o bootstrap HTML nunca selecionam nem serializam o texto; `has_message` é o único metadado público novo.
- A rota privada valida a existência da árvore, a sessão administrativa correspondente e o relógio do servidor. Antes de `2026-12-25 00:00:00 America/Sao_Paulo`, inclusive o proprietário recebe apenas contagem e data de liberação.
- Depois da liberação, a query privada é limitada à árvore autorizada e as respostas usam `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache` e `X-Content-Type-Options: nosniff`.
- O texto é renderizado pelo React, sem `dangerouslySetInnerHTML`; quebras de linha são preservadas por CSS. Mensagens, hashes e payloads conflitantes não são escritos em logs nem ecoados em erros.
- Visitantes nunca chamam a rota privada; ocultação visual não participa da decisão de autorização.

O proprietário pode excluir um enfeite antes ou depois da liberação, e a mensagem é apagada em cascata. Antes do Natal essa moderação é deliberadamente cega: não existe revisão prévia, leitura administrativa antecipada ou serviço externo de moderação. Rate limiting, limites de tamanho, CSRF, idempotência e exclusão oferecem proteção proporcional, mas conteúdo abusivo ainda pode ser recebido e só poderá ser avaliado após a revelação.

## Compartilhamento e metadados

- Somente `/t/{public_id}` é compartilhado; token administrativo, recuperação, cookies e parâmetros não entram na URL.
- `public_app_url()` reconstrói a origem sem `user:password`, query ou fragmento, mesmo se `APP_URL` estiver configurado incorretamente com esses componentes.
- Open Graph contém apenas nome público do proprietário, convite, canonical e imagem genérica; mensagens e dados de sessão não são consultados.
- O cartão usa o canvas 3D local e recebe somente nome público e contagem de enfeites. Mensagens privadas não pertencem ao canvas nem à composição.
- Blobs e URLs temporárias permanecem no navegador e são liberados após compartilhamento/download. Não há upload, analytics, login do Instagram ou API de terceiros.
- Textos dinâmicos nos metadados passam por escape HTML e o bootstrap continua usando `JSON_HEX_*`.

## Rascunhos de presentes personalizados

- a fotografia original é processada no navegador; somente um PNG final de até 512×512 chega ao PHP;
- `fileinfo`, assinatura, decodificação GD, dimensões e limites de bytes são conferidos antes de um novo PNG ser gerado;
- arquivos usam nomes aleatórios e ficam em `storage/private/gift-textures`, nunca em `public/`;
- o ID público não autoriza acesso; um token de 256 bits é entregue fora da URL e somente seu hash é salvo;
- respostas privadas não incluem mensagem, textura ou caminho e usam `Cache-Control: private, no-store`;
- idempotência vincula chave e hash do payload; falhas compensam arquivos, e o cron retoma cancelamentos/expirações interrompidos;
- somente `draft → cancelled|expired` é permitido. Não há rota pública para `paid` ou `published`.

## Regras gerais

1. Nunca versionar `.env`, credenciais, certificados, logs ou dados reais.
2. Usar PDO preparado para valores e whitelist para identificadores SQL dinâmicos.
3. Escapar HTML dinâmico; o bootstrap JSON usa flags `JSON_HEX_*`.
4. Nunca confiar apenas em validação JavaScript.
5. Não expor exceptions, stack traces, SQL ou caminhos internos em produção.
6. Não usar GET para mutações.
7. Manter o Document Root em `public/` e bloquear execução em uploads.
8. Atualizar dependências conscientemente e versionar lockfiles.
9. Evitar segredos e dados pessoais em logs e backups.

## Produção

Configure `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE=true` e HTTPS. Use um usuário MySQL dedicado com privilégios mínimos, proteja o `.env`, restrinja permissões de `storage` e mantenha backup antes de migrations.

O builder HostGator usa allowlist e não transmite arquivos nem executa migrations. `.env`, cache, logs e uploads permanecem específicos de cada instalação.

## Escopo ainda não protegido

Uploads não fazem parte da Etapa 04. Antes de implementá-los, serão necessários limites de tamanho, MIME real via `finfo`, nomes aleatórios, armazenamento protegido e autorização por recurso. Também não há detecção automática de conteúdo abusivo, chat, notificações ou publicação pública das mensagens.
