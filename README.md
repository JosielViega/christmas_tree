# Christmas Tree

Aplicativo natalino com árvores 3D individuais, compartilháveis e colaborativas. A Etapa 03 permite que visitantes deixem enfeites 3D persistentes, mantendo a identidade e o acesso seguro criados na Etapa 02.

## Estado da Etapa 03

- cada árvore possui URL pública `/t/{public_id}` e nome do responsável;
- criação persistente em MySQL com identificador público aleatório de 72 bits;
- acesso administrativo mantido em sessão PHP, separado do identificador público;
- código de recuperação exibido uma única vez e rotacionado após o uso;
- criação e recuperação protegidas por CSRF, validação e rate limiting;
- visitantes podem visualizar, mas os controles de edição ficam disponíveis somente ao responsável;
- React + TypeScript continuam compilados pelo Vite para assets estáticos servidos pelo PHP;
- visitantes podem escolher entre seis enfeites e associar seu nome;
- até 60 posições determinísticas (`layout_version=1`) são controladas pelo backend;
- enfeites reaparecem no mesmo galho e podem ser tocados para identificar quem os deixou;
- o proprietário pode remover participações após confirmação;
- transações, índice único de slot, idempotência e rate limiting protegem envios concorrentes;
- fotografias e mensagens não são persistidas nesta etapa.

## Stack e estrutura

- PHP 8.2+, Composer 2, PDO MySQL e sessões PHP;
- React 18, TypeScript, Three.js, React Three Fiber e Vite;
- Tailwind CSS compilado localmente;
- Apache/HostGator em produção, sem Node.js no servidor.

```text
app/                    domínio, services, repositories e controllers
database/migrations/    schema MySQL versionado
frontend/               React, TypeScript e experiência 3D
public/assets/app/       build versionado do Vite
resources/views/        layouts e páginas PHP
routes/                  rotas HTTP e APIs
tests/                   testes unitários, HTTP e integração opcional MySQL
docs/                    arquitetura, segurança e operação
```

Consulte [arquitetura](docs/ARCHITECTURE.md), [segurança](docs/SECURITY.md), [roadmap](docs/ROADMAP.md) e [créditos](docs/OPEN_SOURCE_CREDITS.md).

## Instalação local

Pré-requisitos: PHP 8.2+, extensões PDO/PDO MySQL e mbstring, Composer 2, MySQL e Node.js 22+.

```bash
composer install
composer setup
npm --prefix frontend ci
npm --prefix frontend run build
```

Configure `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` e `DB_PASSWORD` no `.env`, crie um banco vazio e aplique:

```bash
composer migrate
composer serve
```

Abra a URL informada pelo servidor. Para hot reload, mantenha `composer serve` ativo e execute em outro terminal:

```bash
npm --prefix frontend run dev
```

O Vite encaminha `/api` ao `APP_URL` configurado (ou `http://127.0.0.1:8010` como fallback).

## Fluxo de uso

1. Abra `/`, informe um nome e crie a árvore.
2. Salve imediatamente o código de recuperação; ele não volta a ser exibido.
3. Compartilhe a URL `/t/{public_id}`. O link público não concede edição.
4. No mesmo navegador, a sessão identifica o responsável.
5. Para recuperar o acesso em outro navegador, use o link/ID e o código. O código antigo é invalidado e um novo é emitido.
6. Visitantes usam “Decorar esta árvore”, escolhem o enfeite e informam seu nome.
7. O proprietário toca em um enfeite para identificá-lo ou removê-lo.

## Rotas e API

- `GET /` — criação e experiência 3D;
- `GET /t/{public_id}` — árvore pública;
- `GET /api/context` — token CSRF para o frontend;
- `POST /api/trees` — cria árvore e concede acesso na sessão;
- `GET /api/trees/{public_id}` — dados públicos;
- `GET /api/trees/{public_id}/admin` — confirma acesso administrativo da sessão;
- `POST /api/trees/{public_id}/recover` — recupera acesso e rotaciona credenciais;
- `GET /api/trees/{public_id}/ornaments` — lista enfeites e capacidade;
- `POST /api/trees/{public_id}/ornaments` — adiciona participação com `Idempotency-Key`;
- `DELETE /api/trees/{public_id}/ornaments/{ornament_id}` — remoção exclusiva do proprietário;
- `GET /credits` e `GET /health` — créditos e health check.

As APIs usam envelopes JSON consistentes: `{ "data": ... }` em sucesso e `{ "error": { "code", "message", "fields?" } }` em erro. Tokens administrativos e hashes nunca fazem parte das respostas públicas.

## Verificações

```bash
composer check
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend audit
composer deploy:hostgator
```

O teste MySQL real é opt-in para impedir uso acidental de bancos comuns. Aponte as variáveis `DB_*` para um banco **isolado**, aplique a migration e execute:

```bash
CHRISTMAS_TREE_MYSQL_INTEGRATION=1 composer test -- --filter PdoChristmasTreeRepositoryIntegrationTest
```

## Deploy HostGator

O servidor de produção executa somente PHP, MySQL e assets estáticos. Rode `composer deploy:hostgator`, revise `deploy/hostgator/build-info.json` e copie manualmente o mirror. O builder não publica arquivos e não executa migrations.

No servidor, configure `.env`, HTTPS, `SESSION_SECURE=true`, credenciais MySQL e escrita em `storage/cache` para o rate limiter. `ORNAMENT_MAX_PER_TREE` pode reduzir o limite operacional entre 1 e os 60 slots do layout v1. Depois execute `composer migrate` conscientemente, com backup disponível. Veja o [guia HostGator](deploy/hostgator/README.md).

## Escopo futuro

Mensagens secretas, fotografias persistentes, rankings, compartilhamento social avançado e novos cenários pertencem às próximas etapas.
