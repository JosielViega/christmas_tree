# Christmas Tree

## Memórias do Ano (Etapa 07C.1)

Cada proprietário pode publicar até seis fotografias reais na própria árvore. Árvores novas começam sem cartões de demonstração; as imagens persistidas aparecem nos Polaroids 3D existentes, em seis posições determinísticas do layout v1. Visitantes podem visualizar e ampliar as memórias, mas criação, substituição, legenda e remoção exigem sessão de proprietário, CSRF e rate limit.

O navegador valida JPEG, PNG ou WebP, corrige orientação durante a decodificação, recorta e reduz a imagem para JPEG 1024×1024 antes do upload. O PHP verifica assinatura, MIME, dimensões e decodificação, reprocessa novamente com GD e remove metadados. O original nunca é armazenado. As imagens finais ficam separadas em `storage/private/memories` e são entregues por uma rota pública controlada; portanto, o painel informa explicitamente que qualquer pessoa com acesso à árvore poderá vê-las.

## Acesso persistente e interface social (Etapa 07C)

Ao criar ou recuperar uma árvore, o navegador recebe uma credencial persistente `HttpOnly`, `SameSite=Lax`, válida por 90 dias por padrão e marcada `Secure` em HTTPS. O banco conserva apenas seletor e hash do verificador. Ao retornar a `/`, uma credencial válida restaura a autorização e redireciona para a árvore principal; uma credencial inválida, expirada ou revogada é apagada e nunca concede acesso.

O vínculo representa **uma árvore principal por navegador reconhecido**, não uma identidade global por pessoa: não usa IP nem fingerprint, e o proprietário continua podendo visitar árvores de amigos. Limpar cookies ou usar navegação privada exige o código de recuperação. A recuperação rotaciona o código administrativo e revoga as credenciais persistentes anteriores daquela árvore.

Na experiência social, o proprietário compartilha sua árvore, mas não pode criar enfeites gratuitos nela; visitantes continuam decorando e enviando presentes premium conforme as regras existentes. O menu secundário fica no topo, respeita as áreas seguras do celular e mantém apenas música, tela cheia quando suportada e créditos. Controles de demonstração foram retirados da interface pública sem remover captura de Stories ou vídeo.

## Presentes premium publicados (Etapa 07B.4)

Enfeites gratuitos e presentes premium são fluxos distintos. Novas decorações gratuitas aceitam bolinhas, coração e estrela; o tipo legado `present` continua renderizável e removível, mas não pode mais ser criado. Presentes personalizados usam o `GiftBoxModel` no chão e só aparecem após o backend confirmar um pedido Pix pago e publicar a textura privada verificada.

A listagem pública é `GET /api/trees/{public_id}/gifts`; a imagem é servida por uma rota controlada somente enquanto o presente estiver publicado, visível e com pedido pago. A cena renderiza no máximo 12 caixas premium por página. Pagamentos continuam desabilitados por padrão e esta etapa não ativa cobrança real.

Aplicativo natalino com árvores 3D individuais, compartilháveis e colaborativas. A Etapa 07B.2 prepara rascunhos privados usando somente a textura final da embalagem, sem pagamento ou publicação.

## Estado da Etapa 07B.2

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
- ao selecionar um enfeite, os controles Anterior/Próximo percorrem circularmente apenas os enfeites existentes, ordenados por posição; as setas do teclado fazem o mesmo e Escape retorna à árvore;
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
- em desenvolvimento, a opção “Experimentar presente personalizado” abre uma prévia isolada e temporária;
- JPEG, PNG e WebP são validados pela assinatura real, limitados por padrão a 8 MB e decodificados com orientação do arquivo;
- fotografias são recortadas proporcionalmente e compostas em texturas Canvas 2D de 512×512, sem modificar rostos;
- os estilos Natal clássico, Natal mágico e Romântico podem usar foto repetida ou foto em destaque;
- a caixa, materiais físicos, fitas e laço existentes são reutilizados, enquanto a cena principal fica congelada durante a prévia;
- trocar estilo não decodifica novamente a fotografia, e fechar ou substituir a foto libera bitmap, Object URL e texturas;
- produção mantém a entrada desabilitada, salvo build explícito com `VITE_ENABLE_GIFT_PREVIEW=true`;
- a prévia isolada não cria pedido, compra ou presente público; somente “Preparar presente” cria um rascunho privado no banco.

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

Consulte [arquitetura](docs/ARCHITECTURE.md), [pagamentos Pix](docs/PAYMENTS.md), [armazenamento privado](docs/GIFT_STORAGE.md), [compartilhamento social](docs/SOCIAL_SHARING.md), [segurança](docs/SECURITY.md), [roadmap](docs/ROADMAP.md) e [créditos](docs/OPEN_SOURCE_CREDITS.md).

## Instalação local

Pré-requisitos: PHP 8.2+, extensões PDO/PDO MySQL, mbstring, fileinfo, GD/PNG e cURL, Composer 2, MySQL e Node.js 22+.

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

O fluxo de embalagem aparece automaticamente no desenvolvimento e fica desabilitado por padrão no build de produção. `VITE_ENABLE_GIFT_PREVIEW=true` exige habilitação consciente; `VITE_GIFT_PHOTO_MAX_BYTES` limita apenas a fotografia local. O upload PHP aceita exclusivamente o PNG final reprocessado e nunca a fotografia original.

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
- `GET /api/payments/catalog` — catálogo e disponibilidade, sem credenciais;
- `POST /api/gift-drafts/{gift_id}/order` — cria ou recupera a order Pix com token, CSRF e idempotência;
- `GET /api/gift-drafts/{gift_id}/order` — consulta o estado local privado;
- `POST /api/payments/webhook/mercadopago` — webhook assinado do tópico `order`.

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

### Validação visual manual da Etapa 07B.1

Sem automação gráfica, conferir em desktop e em pelo menos um celular real:

- entrada experimental aparece em desenvolvimento e permanece ausente no build de produção padrão;
- fotografias JPEG, PNG e WebP, incluindo retratos com orientação EXIF, aparecem sem rotação ou distorção;
- cada estilo mantém identidade própria e ambos os modos parecem papel de presente, não um porta-retrato genérico;
- foto permanece abaixo das fitas e do laço, com orientação legível na face frontal;
- giro, zoom por roda e gesto de pinça funcionam sem mover a câmera da árvore;
- trocar repetidamente estilo, modo e fotografia não causa travamentos ou aumento contínuo perceptível de memória;
- fechar a prévia restaura a árvore, câmera, progressão, enfeites, PNG e vídeo sem alterações;
- antes de preparar, nenhuma imagem sai do navegador; ao preparar, somente o PNG final aparece na rede e o token privado fica no `sessionStorage`, nunca a fotografia original;
- sem sandbox configurado, textos deixam claro que o pagamento está indisponível e nenhuma cobrança é criada.

### Validação manual da Etapa 07B.3

Em uma conta e credenciais de teste do Mercado Pago, nunca com cobrança real:

- habilitar conscientemente o sandbox e confirmar que produto, valor, QR Code, Copia e Cola e expiração aparecem em viewport móvel;
- repetir o envio e recarregar a tela sem criar uma segunda cobrança;
- pagar com usuário de teste, simular/repetir o webhook no painel e confirmar `pending → paid` uma única vez;
- verificar que o presente pago continua ausente da árvore pública e que enfeites/mensagens não mudaram;
- testar assinatura inválida, valor divergente, provedor indisponível e expiração sem expor payload, e-mail ou credenciais;
- executar o cron e confirmar que pedidos pendentes/pagos conservam a textura e que rascunhos comuns expirados são removidos.

O teste MySQL real é opt-in para impedir uso acidental de bancos comuns. Aponte as variáveis `DB_*` para um banco **isolado**, aplique a migration e execute:

```bash
CHRISTMAS_TREE_MYSQL_INTEGRATION=1 composer test -- --filter PdoChristmasTreeRepositoryIntegrationTest
```

## Deploy HostGator

O servidor de produção executa somente PHP, MySQL e assets estáticos. Rode `composer deploy:hostgator`, revise `deploy/hostgator/build-info.json` e copie manualmente o mirror. O builder não publica arquivos e não executa migrations.

No servidor, configure `.env`, HTTPS, `SESSION_SECURE=true`, credenciais MySQL e escrita em `storage/cache` para o rate limiter. `APP_URL` deve ser a origem HTTPS pública, sem usuário, senha, query ou fragmento, pois define links canônicos e Open Graph. `ORNAMENT_MAX_PER_TREE` pode reduzir o limite operacional entre 1 e os 60 slots do layout v1. `MESSAGE_REVEAL_AT` e `MESSAGE_REVEAL_TIMEZONE` controlam a temporada; os valores de 2026 são `2026-12-25 00:00:00` e `America/Sao_Paulo`. Depois execute `composer migrate` conscientemente, com backup disponível. Veja o [guia HostGator](deploy/hostgator/README.md).

`LIBERAR_MENSAGEM=false` mantém a abertura automática. Para uma liberação operacional temporária, use `LIBERAR_MENSAGEM=true`; enfeites e presentes premium ficam legíveis somente para o proprietário autorizado. Voltar para `false` restaura a programação automática em novas consultas. Valores ausentes ou inválidos equivalem a `false`, e a configuração nunca deve permanecer ativada por padrão em produção.

## Etapas 07B.2 e 07B.3 — presentes privados e Pix

Em desenvolvimento, a prévia pode preparar um rascunho associado à árvore. A fotografia original permanece no navegador; somente um PNG final 512×512 é enviado, validado e reprocessado pelo GD. O arquivo fica em `storage/private/gift-textures`, fora de `public/`, e expira em 24 horas.

Rotas:

- `POST /api/trees/{public_id}/gift-drafts` — cria com CSRF, rate limit, consentimento e `Idempotency-Key`;
- `GET /api/gift-drafts/{gift_id}` — consulta com `X-Gift-Draft-Token`;
- `DELETE /api/gift-drafts/{gift_id}` — cancela com token e CSRF.

O checkout usa catálogo do servidor e Mercado Pago Orders API quando o sandbox é configurado explicitamente. Sem credenciais, informa indisponibilidade e não cria cobranças. Pagamento confirmado muda apenas o estado para `paid`; não publica o presente. Execute `composer gifts:cleanup` por cron para reconciliar pendências antes da limpeza. Veja [armazenamento privado](docs/GIFT_STORAGE.md) e [pagamentos](docs/PAYMENTS.md).

## Etapa 08A — estabilização antes do lançamento

Links copiados pela interface usam a origem real do navegador, evitando trocar acidentalmente `localhost` por `127.0.0.1` e perder os cookies do proprietário. A interface mobile usa duas linhas de ações sem rolagem horizontal, indicadores compactos e áreas seguras. O vídeo 9:16 calcula a distância pelo FOV e pelos limites da estrela/base, mantém a árvore inteira durante uma órbita de 360° e restaura câmera, viewport, DPR e exposição.

Presentes decorativos foram reduzidos para 12 posições determinísticas. Publicações premium novas usam layout v2 mais externo; presentes v1 mantêm as coordenadas históricas. A prévia premium pode ser exposta com `VITE_ENABLE_GIFT_PREVIEW=true`, mas cobranças continuam dependendo exclusivamente dos gates do backend. Consulte [testes e checklist](docs/TESTING.md).

### Etapa 08A.1 — órbita e interface mobile

O vídeo percorre uma órbita contínua e determinística, conclui a volta aos sete segundos e estabiliza na frente no segundo final. Movimento reduzido conserva a composição frontal estática. Ações primárias ocupam a primeira linha no celular; ações secundárias ficam na segunda, e recursos premium indisponíveis aparecem como **Em breve** antes de qualquer toque.

### Etapa 08A.2 — proporção do vídeo e cabeçalho

Durante a captura, resolução e aspecto 9:16 permanecem bloqueados mesmo se o observador de layout do Canvas tentar reaplicar a viewport visível. A composição final usa uma única escala proporcional e centraliza qualquer frame divergente, sem esticar eixos. No cabeçalho mobile, nomes longos podem ocupar duas linhas; abrir o menu recolhe temporariamente o indicador, e o menu fecha por toque externo ou Escape.

### Etapa 08A.3 — compatibilidade de fotografias

Fotografias JPEG, PNG e WebP continuam validadas por assinatura antes do processamento. Se um navegador expuser `createImageBitmap()` mas rejeitar uma fotografia válida, o aplicativo tenta a decodificação nativa por `Image`, preserva a orientação aplicada pelo navegador e sempre libera o Object URL. O Canvas ainda remove metadados e produz o JPEG quadrado enviado ao armazenamento privado.

### Etapa 08A.4 — inicialização responsiva

Ao abrir uma árvore, uma tela DOM leve acompanha estados reais: dados essenciais, preparação da cena, primeiro frame e interação. O aplicativo considera a cena pronta somente depois dos enfeites persistidos, do WebGL e de dois frames apresentados. Memórias e presentes são secundários e não bloqueiam a interação.

Polaroids são decodificadas progressivamente, no máximo duas por vez, reduzidas em memória para até 512 px antes do upload à GPU e substituídas por fallback individual em caso de falha. As imagens persistidas não são alteradas. Em desenvolvimento, medidas `christmas-tree:*` ficam disponíveis em `performance.getEntriesByType('measure')` sem URLs, fotos ou dados pessoais.

### Etapa 08A.5 — uma participação gratuita por visitante

Cada navegador recebe uma identidade anônima persistente de 90 dias em cookie `HttpOnly`, `SameSite=Lax` e `Secure` sob HTTPS. O backend permite um enfeite gratuito por identidade e árvore; o mesmo navegador continua livre para decorar outras árvores. A restrição é transacional e possui índice único no MySQL.

A exclusão administrativa apaga enfeite e mensagem, mas preserva o marcador mínimo de participação. Enfeites anteriores à migration permanecem intactos e não são associados retroativamente por nome. Presentes premium, Pix, pagamentos, reembolsos e publicação não usam essa identidade nem recebem limite individual.

## Escopo futuro

Publicação visual, abertura de presentes, fotografias originais persistentes e otimizações finais de lançamento pertencem às próximas etapas.
