# Arquitetura

O Christmas Tree mantém a arquitetura sem framework do `modeloPHP`. O PHP é a aplicação principal, controla rotas e respostas e serve um frontend React compilado como arquivos estáticos.

## Fluxo HTTP

```text
Browser
  -> public/index.php
  -> bootstrap/app.php
  -> routes/web.php
  -> HomeController
  -> FrontendAssets
  -> manifesto Vite
  -> View + layout Christmas Tree
```

`App\Core\FrontendAssets` lê `public/assets/app/.vite/manifest.json`, localiza a entrada `index.html` e produz URLs sob `/assets/app/`. Assim, hashes gerados pelo Vite podem mudar sem alterações manuais nas views.

As rotas PHP continuam explícitas. Arquivos existentes dentro de `public/` são servidos diretamente pelo Apache ou pelo router do servidor PHP; qualquer outra URL segue para o front controller. Não há roteamento SPA nesta etapa, portanto não existe conflito entre rotas React e PHP.

## Frontend 3D

`frontend/App.tsx` compõe a experiência. Os componentes reutilizados são:

- `Scene`: Canvas, câmera, iluminação, controles e pós-processamento;
- `TreeMesh`: agulhas da árvore com instancing;
- `SpiralDecor`: cordão luminoso, bolas e enfeites;
- `Star`: estrela, brilho e animação;
- `Snow`: partículas de neve;
- `Presents`: presentes procedurais;
- `Polaroid`: fotos e interação;
- `Overlay`: controles, nome, edição, exportação e gravação.

Texturas decorativas são geradas em Canvas. A iluminação de reflexão usa `Environment` com `Lightformer`, evitando o download do preset remoto original. A fonte e a música são assets locais.

## Recursos externos desativados

O código de `HandController`, `InstagramModal`, `useInstagram` e `useVisitCounter` foi mantido como referência, mas não é importado pelo `App` da Etapa 01. Não há solicitação de câmera, webhook, contador, analytics ou fetch automático para GitHub. A reativação exige uma decisão de produto, análise de privacidade e testes próprios.

## Build e produção

```text
frontend/ --npm run build--> public/assets/app/
                                  |
                                  +-- .vite/manifest.json
                                  +-- assets/*.js
                                  +-- assets/*.css
                                  +-- fonts, music, favicon
```

O diretório compilado é versionado para que o checkout seja executável em hospedagem PHP mesmo sem Node.js. O processo de mirror recompila antes de empacotar e valida a presença do manifesto.

`frontend/` e `node_modules/` nunca são necessários em produção. O mirror copia somente os caminhos definidos em `deploy/hostgator/config/deploy.php` e instala `vendor/` sem dependências de desenvolvimento.

## Evolução backend

Futuras funcionalidades devem seguir o fluxo do template:

1. rota HTTP explícita;
2. controller pequeno;
3. validação e autorização no backend;
4. repository para SQL preparado;
5. service somente quando houver regra ou integração significativa;
6. resposta JSON ou view;
7. teste do comportamento fundamental.

Não há migration de domínio, autenticação ou persistência social na Etapa 01.
