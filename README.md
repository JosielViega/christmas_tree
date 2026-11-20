# Christmas Tree

Aplicativo natalino com árvores 3D individuais, compartilháveis e colaborativas. A Etapa 07 acrescenta um cenário noturno leve com passagem ocasional do Papai Noel, estrelas cadentes e adaptação de desempenho, preservando a árvore e sua progressão como protagonistas.

## Estado da Etapa 07

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
- cada nova participação inclui uma mensagem de 2 a 500 caracteres Unicode, persistida atomicamente com o enfeite;
- APIs e páginas públicas informam apenas se o enfeite possui mensagem, nunca o conteúdo;
- em `2026-12-25 00:00:00 America/Sao_Paulo` (`03:00:00Z`), somente o proprietário autenticado pode ler as mensagens;
- enfeites criados em etapas anteriores continuam válidos e são apresentados como participações sem mensagem;
- fotografias continuam fora do escopo.
- proprietários podem copiar ou compartilhar a URL pública usando Web Share API com fallback;
- o navegador compõe, sob demanda, um cartão PNG 1080×1920 a partir do mesmo canvas 3D;
- o cartão pode ser compartilhado como arquivo quando suportado ou salvo no dispositivo;
- páginas públicas possuem título, descrição, URL canônica e Open Graph personalizados no HTML;
- depois de decorar, visitantes podem abrir o fluxo existente para criar sua própria árvore.
- proprietários podem gerar um vídeo vertical de oito segundos usando a mesma cena, câmera e animações 3D;
- a gravação ocorre inteiramente no navegador, em 720×1280/24 FPS ou 1080×1920/30 FPS conforme o dispositivo;
- o formato é MP4 ou WebM somente quando confirmado pelo `MediaRecorder` do navegador;
- gravação incompatível mantém disponíveis o cartão PNG, o link e seus respectivos fallbacks.
- a quantidade de enfeites persistidos desbloqueia progressivamente iluminação, partículas douradas, presentes especiais, brilho da estrela e atmosfera natalina;
- os marcos visuais são configurados no frontend em 5, 10, 20, 35, 50 e 60 participações, sem estado duplicado no banco;
- recarregar a página restaura o estágio correto sem repetir a celebração, e remover um enfeite reduz o estágio imediatamente;
- o indicador acessível informa o estágio atual e quanto falta para o próximo, respeitando `prefers-reduced-motion`;
- cartões e vídeos capturam a mesma cena evoluída, sem renderer ou geometria paralela.
- Papai Noel e seu trenó passam acima da árvore após 15–25 segundos na primeira visita e depois em intervalos aleatórios de 45–90 segundos;
- uma única estrela cadente pode surgir a cada 18–36 segundos, após uma primeira espera de 8–16 segundos;
- o trenó, o rastro dourado e as estrelas são construídos com primitivas e partículas Three.js locais, sem modelos, downloads ou bibliotecas adicionais;
- os efeitos ocasionais são suspensos durante captura PNG e vídeo, retomando seu relógio depois da restauração da câmera;
- `prefers-reduced-motion` desativa as animações atmosféricas, enquanto dispositivos modestos usam somente oito partículas no rastro em vez de dezoito;
- o monitor de desempenho pode reduzir ou desligar os novos efeitos opcionais e ajustar o DPR, sem alterar os limites da progressão social.

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

Consulte [arquitetura](docs/ARCHITECTURE.md), [compartilhamento social](docs/SOCIAL_SHARING.md), [segurança](docs/SECURITY.md), [roadmap](docs/ROADMAP.md) e [créditos](docs/OPEN_SOURCE_CREDITS.md).

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
6. Visitantes usam “Decorar esta árvore”, escolhem o enfeite, informam seu nome e escrevem uma mensagem secreta.
7. Antes da liberação, tocar no enfeite mostra apenas o remetente e o estado bloqueado.
8. Após a liberação, o proprietário toca no enfeite para ler a mensagem; visitantes continuam sem acesso.
9. O proprietário pode remover qualquer participação sem ler antecipadamente seu conteúdo.
10. O proprietário usa “Compartilhar minha árvore” para copiar o link, gerar o cartão ou criar um vídeo vertical de oito segundos.
11. O vídeo pode ser cancelado, visualizado, salvo e compartilhado quando o navegador permite arquivos na Web Share API.
12. No Instagram, publique a mídia salva e adicione manualmente o adesivo de link com a URL copiada.

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
- `GET /api/trees/{public_id}/messages` — metadados bloqueados ou mensagens reveladas, sempre restritos ao proprietário e sem cache;
- `GET /credits` e `GET /health` — créditos e health check.

As APIs usam envelopes JSON consistentes: `{ "data": ... }` em sucesso e `{ "error": { "code", "message", "fields?" } }` em erro. Tokens administrativos e hashes nunca fazem parte das respostas públicas.

## Verificações

```bash
composer check
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend audit
composer deploy:hostgator
```

### Validação visual manual da Etapa 06

Sem automação gráfica, conferir em navegador e em pelo menos um celular real:

- árvore com zero participações preserva a composição original;
- marcos de 5, 10, 20, 35, 50 e 60 enfeites acrescentam os efeitos esperados sem mudanças bruscas;
- criação que cruza um marco exibe o aviso uma vez, permite dispensá-lo e mantém a cena interativa;
- recarregamento restaura o estágio sem repetir o aviso, e exclusão abaixo de um marco reduz os efeitos;
- indicador não cobre os controles principais em viewport estreita ou larga;
- `prefers-reduced-motion` mantém a informação e suprime a celebração animada;
- cartão PNG e vídeo vertical incluem os efeitos ativos sem conteúdo privado, travamentos ou queda visual evidente.

### Validação visual manual da Etapa 07

Sem automação gráfica, conferir em desktop e em pelo menos um celular real:

- árvore, estrela, neve, progressão e enfeites mantêm a composição e a interação originais;
- trenó passa completamente acima da árvore, sem atravessar galhos, encobrir controles ou competir com a estrela;
- rastro dourado é curto e desaparece com o trenó;
- estrela cadente é discreta, curta e não se transforma em chuva constante;
- rotação e zoom da câmera continuam naturais enquanto os elementos atmosféricos estão visíveis;
- movimento reduzido elimina trenó, estrela cadente e rastros animados;
- captura PNG e vídeo vertical não incluem aparições parciais e restauram normalmente câmera e efeitos;
- dispositivos modestos não apresentam travamentos, aquecimento ou queda visual evidente.

O teste MySQL real é opt-in para impedir uso acidental de bancos comuns. Aponte as variáveis `DB_*` para um banco **isolado**, aplique a migration e execute:

```bash
CHRISTMAS_TREE_MYSQL_INTEGRATION=1 composer test -- --filter PdoChristmasTreeRepositoryIntegrationTest
```

## Deploy HostGator

O servidor de produção executa somente PHP, MySQL e assets estáticos. Rode `composer deploy:hostgator`, revise `deploy/hostgator/build-info.json` e copie manualmente o mirror. O builder não publica arquivos e não executa migrations.

No servidor, configure `.env`, HTTPS, `SESSION_SECURE=true`, credenciais MySQL e escrita em `storage/cache` para o rate limiter. `APP_URL` deve ser a origem HTTPS pública, sem usuário, senha, query ou fragmento, pois define links canônicos e Open Graph. `ORNAMENT_MAX_PER_TREE` pode reduzir o limite operacional entre 1 e os 60 slots do layout v1. `MESSAGE_REVEAL_AT` e `MESSAGE_REVEAL_TIMEZONE` controlam a temporada; os valores de 2026 são `2026-12-25 00:00:00` e `America/Sao_Paulo`. Depois execute `composer migrate` conscientemente, com backup disponível. Veja o [guia HostGator](deploy/hostgator/README.md).

## Escopo futuro

Upload de mídia, conversão de codecs, fotografias persistentes, rankings e otimizações finais de lançamento pertencem às próximas etapas.
