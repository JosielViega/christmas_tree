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

Uploads e mensagens persistentes não fazem parte da Etapa 03. Antes de implementá-los, serão necessários limites de tamanho, MIME real via `finfo`, nomes aleatórios, armazenamento protegido, moderação e autorização por recurso.
