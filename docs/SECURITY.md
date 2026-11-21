# Segurança

## Fotografias públicas das memórias

- Somente o proprietário autorizado da árvore pode criar, substituir, legendar ou remover; todas as mutações exigem CSRF, escopo da árvore e rate limiting.
- A lista e as imagens são deliberadamente públicas para visitantes da árvore. O painel informa essa condição antes da seleção do arquivo.
- O navegador envia apenas um JPEG quadrado otimizado de até 1024×1024; o backend não confia nele e repete validação, decodificação e reprocessamento.
- Assinatura, MIME, tamanho, dimensões e limite de pixels são conferidos. SVG, conteúdo incompatível e arquivos indecodificáveis são rejeitados.
- O arquivo final é um JPEG novo, sem EXIF, nome original ou metadados da fonte. Nomes físicos são aleatórios e caminhos nunca entram no JSON.
- `storage/private/memories` permanece fora de `public/`; a rota controlada restringe o caminho lógico, fixa `image/jpeg`, adiciona `nosniff` e não executa uploads.
- Memórias não entram em analytics, serviços externos, reconhecimento facial, mensagens secretas ou texturas premium sem nova ação explícita.
- A legenda aceita no máximo 80 caracteres Unicode, não permite controles e é renderizada como texto pelo React.

## Presentes publicados

- O navegador nunca informa os estados `paid` ou `published`; apenas notificações verificadas/reconciliação do provedor iniciam a publicação.
- A rota de textura valida o ID público, o estado atual, a visibilidade, o estado financeiro, o caminho lógico, o limite de bytes, a assinatura PNG e o SHA-256 persistido.
- Fotos originais, caminhos físicos, tokens, dados financeiros e mensagens não entram no JSON público, HTML, captura ou vídeo.
- O proprietário pode ocultar uma caixa com sessão administrativa e CSRF. Isso não apaga nem reembolsa o pedido e não libera seu pagamento para outro presente.
- Um reembolso/estorno aceito oculta a caixa dentro da mesma transação que atualiza o pedido, preservando o histórico.

## Identidade e autorização da árvore

- O `public_id` identifica e compartilha a árvore, mas nunca concede edição.
- O token administrativo possui 256 bits aleatórios, é armazenado em hash SHA-256 no MySQL e em formato bruto somente na sessão PHP do responsável.
- O código de recuperação também possui 256 bits, é exibido uma única vez, armazenado somente em hash e rotacionado após uso.
- Comparações de credenciais usam `hash_equals`; a rotação usa update condicional para impedir reuso concorrente.
- Criação regenera o ID da sessão. Cookies devem ser `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- O backend valida autorização em cada endpoint administrativo; ocultar controles no React é apenas uma camada de UX.
- A credencial persistente usa seletor de 128 bits e verificador de 256 bits; somente o hash do verificador é armazenado no banco.
- O cookie persistente é `HttpOnly`, `SameSite=Lax`, `Path=/`, expira em 90 dias por padrão e recebe `Secure` sempre que HTTPS está ativo.
- Credenciais expiradas, revogadas, adulteradas ou ligadas a árvore inativa são rejeitadas e removidas do navegador; o ID público nunca é aceito como autorização.
- A recuperação revoga credenciais persistentes anteriores e emite uma nova. O código de recuperação não entra em cookie, URL, resposta pública ou log.
- Não há fingerprint nem identificação por IP. A regra é uma árvore principal por navegador reconhecido, não uma árvore global por pessoa.
- O proprietário é bloqueado no backend ao tentar criar enfeite gratuito na própria árvore; visitar e decorar árvores de terceiros continua permitido.

`SESSION_LIFETIME_SECONDS` controla a coleta da sessão PHP (mínimo de 15 minutos; padrão de duas horas), enquanto o cookie de sessão continua sem persistência. Fechar o navegador e voltar depende da credencial persistente validada no banco. Limpar cookies, usar modo privado ou trocar de dispositivo requer recuperação. Revogação imediata ocorre ao recuperar novamente a árvore; a remoção manual de credenciais pode ser feita administrativamente no banco sem alterar códigos de recuperação.

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
- `draft → paid` ocorre somente após confirmação oficial do gateway; cancelamento e expiração continuam protegidos. Não há rota para o navegador definir `paid` ou `published`.

## Pagamentos Pix

- preços, moeda e versão do catálogo são definidos no servidor e persistidos em centavos inteiros;
- pedidos exigem token do rascunho, CSRF, rate limit e idempotência local e no provedor;
- Access Token e segredo de webhook ficam exclusivamente no `.env` do backend e nunca são serializados;
- notificações validam HMAC-SHA256 oficial, são confirmadas pela Orders API e possuem chave única contra replay;
- valor, moeda, referência externa, ID da order e ambiente são conferidos antes da transição transacional;
- e-mail é enviado ao provedor porque a Orders API o exige, mas não é salvo localmente;
- QR Code e Pix Copia e Cola são privados, sem cache e nunca escritos em logs;
- `paid` não implica `published`; o frontend não possui endpoint de confirmação ou publicação;
- produção permanece bloqueada sem HTTPS, ambiente de produção e opt-in explícito.

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

## Diagnóstico de inicialização

Marcas de desempenho existem somente no build de desenvolvimento e usam nomes fixos de etapas. Elas não incluem URL de imagem, ID público, nome, mensagem, cookie, CSRF ou credencial. Requisições secundárias são canceladas ao trocar/desmontar a árvore; uma resposta antiga não pode substituir a coleção atual. Falhas de textura exibem fallback local e logs de cena registram apenas o tipo da exceção.

`hardwareConcurrency`, `deviceMemory`, preferência de movimento e DPR servem apenas para escolher qualidade local. Esses valores não são enviados, persistidos nem combinados como fingerprint.

## Escopo ainda não protegido

Uploads não fazem parte da Etapa 04. Antes de implementá-los, serão necessários limites de tamanho, MIME real via `finfo`, nomes aleatórios, armazenamento protegido e autorização por recurso. Também não há detecção automática de conteúdo abusivo, chat, notificações ou publicação pública das mensagens.
