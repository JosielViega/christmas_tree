# Christmas Tree

Aplicativo natalino com árvores 3D interativas, preparado para evoluir para compartilhamento e mensagens de amigos. A Etapa 01 integra a experiência visual do [Lumière Christmas Tree](https://github.com/gracetyy/christmas-tree) ao backend do `modeloPHP`, sem implementar ainda autenticação, persistência ou recursos sociais.

## Estado da Etapa 01

- árvore, estrela, luzes, neve, presentes, enfeites e polaroids em Three.js;
- upload local de fotografias, navegação, música, captura de imagem e gravação mantidos;
- React + TypeScript compilados pelo Vite para arquivos estáticos;
- PHP continua sendo a aplicação principal e serve o HTML da rota `/`;
- `/health` continua respondendo JSON;
- build de produção não requer Node.js no servidor;
- contador remoto, Vercel Analytics, Instagram e gestos MediaPipe estão fora do fluxo inicial;
- código dos componentes de Instagram e gestos foi preservado em `frontend/` para avaliação futura.

## Stack

- PHP 8.2+, Composer 2 e PDO MySQL;
- React 18, TypeScript, Three.js, React Three Fiber e Vite;
- Tailwind CSS compilado localmente;
- Apache/HostGator em produção, com somente PHP e assets estáticos.

## Arquitetura

```text
Browser
  -> public/index.php
  -> Router
  -> HomeController
  -> Vite manifest (public/assets/app/.vite/manifest.json)
  -> view PHP + bundles estáticos versionados
```

O código React vive isolado em `frontend/`. `npm run build` grava diretamente em `public/assets/app/`. O PHP lê o manifesto por `App\Core\FrontendAssets`, sem nomes de arquivo fixos, e injeta os arquivos CSS/JS no layout `resources/views/layouts/christmas-tree.php`.

```text
app/                    núcleo e controllers PHP
bootstrap/              composição da aplicação
config/                 configuração e allowlist de deploy
frontend/               React, TypeScript e código 3D
public/assets/app/       resultado versionado do Vite
resources/views/        layouts e páginas PHP
routes/                  rotas HTTP
tests/                   testes PHP
docs/                    arquitetura, roadmap e créditos
```

Mais detalhes: [arquitetura](docs/ARCHITECTURE.md) e [créditos](docs/OPEN_SOURCE_CREDITS.md).

## Instalação local

Pré-requisitos: PHP 8.2+, extensões PDO/PDO MySQL, Composer 2 e Node.js 22+.

```bash
composer install
composer setup
npm --prefix frontend ci
npm --prefix frontend run build
```

`composer setup` cria o `.env` local, se necessário, e reserva uma porta PHP livre usando o mecanismo original do `modeloPHP`.

### Executar o build integrado ao PHP

```bash
composer serve
```

Abra a URL exibida pelo comando. Esta é a forma mais próxima da produção: o PHP serve o HTML e os assets já compilados.

### Desenvolvimento do frontend

Em um terminal:

```bash
composer serve
```

Em outro:

```bash
npm --prefix frontend run dev
```

Use a URL informada pelo Vite para trabalhar com hot reload. O backend continua disponível em sua porta própria para `/health` e futuras APIs. Não há proxy nesta etapa porque o frontend não consome endpoints de negócio.

## Comandos

```bash
# Backend
composer validate --strict
composer lint
composer test
composer check

# Frontend
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend audit

# Pacote HostGator
composer deploy:hostgator
```

`composer deploy:hostgator` recompila o frontend, executa as verificações PHP e gera `deploy/hostgator/mirror/`. Instale antes as dependências com `composer install` e `npm --prefix frontend ci`.

## Rotas

- `GET /` — aplicativo 3D;
- `GET /credits` — atribuições visíveis dos recursos redistribuídos;
- `GET /health` — `{"status":"ok"}`;
- `POST /example` — demonstração original do pipeline PHP, mantida sem persistência;
- demais caminhos — 404 com status correto.

## Deploy HostGator

O servidor de produção não executa Node.js nem Vite. O build ocorre localmente ou no CI:

1. execute `npm --prefix frontend ci`;
2. execute `composer deploy:hostgator`;
3. revise `deploy/hostgator/build-info.json` e o conteúdo de `mirror/`;
4. copie o mirror para a estrutura privada/pública adequada no cPanel;
5. crie o `.env` somente no servidor e preserve arquivos controlados pela hospedagem;
6. aponte preferencialmente o Document Root para `public/`.

O mirror inclui `public/assets/app/`, mas não inclui `frontend/`, `node_modules/`, `.env`, testes, cache, logs ou uploads. Consulte [o guia HostGator](deploy/hostgator/README.md).

## Dependências externas

O carregamento inicial funciona sem credenciais e sem APIs pagas. Todos os bundles, a fonte e a música são servidos localmente. A única navegação externa presente é acionada conscientemente pelo usuário ao abrir o repositório original ou links de licença.

Desabilitados nesta etapa:

- importação do Instagram e seu webhook;
- contador CounterAPI;
- Vercel Analytics;
- MediaPipe e acesso à câmera;
- consulta automática à API do GitHub;
- presets remotos de ambiente (substituídos por iluminação procedural local).

## Validação visual manual

Como a especificação proíbe automação de mouse/teclado em aplicativos gráficos, valide manualmente em desktop e celular:

- a árvore ocupa a tela e mantém geometria, neve, luzes, estrela, presentes e animações;
- toque/arraste ou mouse rotacionam a câmera e o zoom permanece suave;
- `Edit` permite carregar uma ou várias fotos e focar uma polaroid;
- música inicia após interação e pode ser silenciada;
- `Image` baixa uma captura legível;
- as duas opções de vídeo iniciam e finalizam em navegadores compatíveis;
- os controles não extrapolam a tela em larguras de 320 px, 375 px e 430 px;
- a experiência funciona no navegador interno do Instagram em um aparelho real;
- `/credits` abre e permite voltar à árvore;
- `/health` continua respondendo corretamente.

## Licenças

O projeto principal permanece sob MIT. O frontend 3D reutilizado conserva sua licença MIT em `frontend/LICENSE`. A fonte Great Vibes usa SIL OFL 1.1, incluída junto ao arquivo da fonte. A música exige atribuição CC BY 4.0 e está creditada na aplicação e na documentação.

Veja [OPEN_SOURCE_CREDITS.md](docs/OPEN_SOURCE_CREDITS.md) para detalhes e ressalvas.

## Escopo futuro

Árvores individuais, enfeites persistentes, mensagens secretas e compartilhamento pertencem às próximas etapas e não foram antecipados. Consulte [ROADMAP.md](docs/ROADMAP.md).
