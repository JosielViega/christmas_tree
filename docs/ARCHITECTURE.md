# Arquitetura

## Memórias persistentes e Polaroids

`christmas_tree_memories` pertence diretamente à árvore e não se mistura com enfeites ou presentes. A tabela conserva ID público aleatório, slot de 0 a 5, `layout_version=1`, legenda opcional, caminho lógico e timestamps UTC. A restrição única `(tree_id, slot_index)` e o bloqueio da árvore durante a criação garantem no máximo seis posições, inclusive sob concorrência.

`ChristmasTreeMemoryService` coordena banco e arquivos. `MemoryImageStorage` aceita JPEG, PNG e WebP reais, decodifica com GD, faz recorte central quadrado, limita a 1024 pixels, grava JPEG com nome aleatório e nunca conserva o original ou EXIF. Substituições gravam e validam o novo arquivo antes de trocar o registro e só depois removem o anterior. Falhas de persistência compensam o novo arquivo.

A listagem é pública, mas devolve somente dados de apresentação e uma URL controlada. A imagem continua fora do Document Root, é validada por caminho lógico e servida como `image/jpeg` com `nosniff`, ETag e cache. O frontend transforma `slot_index` com `getMemorySlot()`, que reutiliza `generatePhotoPositions(6)`. Os mesmos objetos `Polaroid`, Canvas, foco, captura PNG, vídeo e qualidade adaptativa continuam sendo usados.

As rotas são `GET/POST /api/trees/{public_id}/memories`, `POST/DELETE /api/trees/{public_id}/memories/{memory_id}` e `GET /api/trees/{public_id}/memories/{memory_id}/image`. A atualização usa POST multipart para compatibilidade com PHP em hospedagem compartilhada e não depende de parsing multipart de requisições PUT pelo servidor.

## Reconhecimento persistente do navegador

`PersistentTreeAccessService` usa uma credencial dividida em seletor e verificador. O cookie contém os dois valores aleatórios; `christmas_tree_persistent_credentials` armazena o seletor pesquisável e somente o SHA-256 do verificador, além de criação, último uso, expiração e revogação. A comparação é feita em tempo constante e a credencial só restaura árvores ativas.

Cada requisição tenta restaurar a credencial antes de construir os controllers. A restauração cria uma marca administrativa na sessão PHP, sem recuperar nem expor o token administrativo histórico. Requisições concorrentes podem validar a mesma credencial estável; a rotação ocorre na recuperação, quando todas as credenciais anteriores da árvore são revogadas e uma nova é emitida. Isso evita uma corrida em que duas respostas rotacionadas invalidariam uma à outra.

`TreeOwnerSession` mantém separadamente as autorizações da sessão e a árvore principal. Somente `/` redireciona para `/t/{public_id}`, portanto links públicos de amigos não causam loop nem trocam silenciosamente a árvore principal. `POST /api/trees` rejeita uma segunda criação quando o acesso já está associado a uma árvore ativa.

## Interface social responsiva

O React recebe `is_owner`, `has_own_tree` e `own_tree_path`, nunca credenciais. Proprietários recebem o convite de compartilhamento; visitantes recebem decoração, presente premium quando habilitado e acesso à própria árvore. Selecionar enfeite ou presente oculta os controles secundários e mantém um cartão rolável com ação de retorno. O mesmo layout usa `safe-area-inset-*`, alvos de toque e limites de viewport em mobile e desktop.

## Publicação de presentes premium

`GiftPaymentService` confirma o provedor fora de qualquer transação de publicação. Depois, `GiftPublicationService` valida o arquivo privado e delega a `PdoGiftPublicationRepository` a transição atômica `paid -> published`. A transação bloqueia o presente e a árvore, reconfirma que o único pedido está `paid` e reserva um `position_index` único no layout v1. O cron `composer gifts:cleanup` reconcilia pedidos e repete publicações elegíveis; todas as operações são idempotentes.

O endpoint público consulta apenas presentes `published`, visíveis e associados a pedidos ainda `paid`. A API devolve metadados mínimos e uma URL controlada. O frontend converte o índice persistido em coordenadas determinísticas e renderiza até 12 modelos por página, mantendo caixas decorativas separadas e não interativas.

O Christmas Tree mantém a arquitetura sem framework do `modeloPHP`. O PHP controla rotas, autorização e persistência; o React compilado cuida da experiência 3D.

## Fluxos HTTP

```text
Browser
  -> public/index.php -> Router
       -> HomeController / TreePageController -> view + bootstrap seguro
       -> TreeApiController
            -> ChristmasTreeIdentityService
                 -> ChristmasTreeRepository
                      -> PDO MySQL
```

`App\Core\FrontendAssets` lê o manifesto Vite em `public/assets/app/.vite/manifest.json`. As rotas `/` e `/t/{public_id}` entregam a mesma aplicação React, com um bootstrap JSON contendo apenas dados públicos, estado de proprietário e CSRF.

O bootstrap também entrega a URL pública canônica calculada pelo PHP. `public_app_url()` remove credenciais, query e fragmento de `APP_URL`; a mesma função alimenta respostas de criação/recuperação e metadados, evitando divergência no hot reload do Vite.

## Modelo da árvore

A migration `202611190001_create_christmas_trees.sql` cria `christmas_trees` com:

- `public_id`: identificador público aleatório, único e não sequencial;
- `owner_name`, `theme`, `status` e timestamps;
- hashes SHA-256 de tokens administrativos e de recuperação.

O nome não é único: pessoas com o mesmo nome recebem IDs distintos.

## Enfeites sociais e layout v1

`christmas_tree_ornaments` associa cada enfeite à árvore por chave estrangeira com `ON DELETE CASCADE`. A tabela guarda ID público, tipo permitido, cor definida pelo servidor, nome do visitante, `slot_index`, `layout_version`, hash da chave de idempotência e timestamp UTC. `UNIQUE(tree_id, slot_index)` impede duas ocupações do mesmo galho e `UNIQUE(tree_id, idempotency_key_hash)` evita duplicação por repetição de rede.

O layout v1 contém 60 índices. `frontend/utils/math.ts` converte cada índice em uma coordenada sobre o cone usando ângulo áureo e raio decrescente; o navegador nunca envia coordenadas. A fórmula é imutável para essa versão. Alterações futuras exigem uma nova versão de layout para não mover dados existentes.

Os tipos estáveis aceitos são `bauble_red`, `bauble_gold`, `bauble_blue`, `heart`, `star` e `present`. As cores correspondentes pertencem à allowlist do service e não são escolhidas livremente pelo cliente.

Na criação, `PdoChristmasTreeOrnamentRepository` abre transação, bloqueia a linha da árvore com `FOR UPDATE`, procura uma solicitação idempotente anterior, calcula os slots livres e insere sob as restrições únicas. O bloqueio serializa apenas participações da mesma árvore.

## Mensagens secretas

`christmas_tree_messages` mantém uma relação individual e opcional com `christmas_tree_ornaments`. A chave única em `ornament_id` impede duplicação e a chave estrangeira com `ON DELETE CASCADE` remove a mensagem junto com o enfeite. O texto usa `utf8mb4`, suporta quebras de linha e é limitado a 500 caracteres Unicode. Enfeites anteriores à Etapa 04 simplesmente não possuem linha correspondente.

A criação do enfeite e da mensagem ocorre na mesma transação. A chave de idempotência continua pertencendo ao enfeite, enquanto `payload_hash` registra a forma normalizada de tipo, remetente e mensagem. Uma repetição idêntica retorna a participação existente; reutilizar a chave com conteúdo diferente produz conflito sem revelar o payload original.

As consultas públicas fazem apenas um `LEFT JOIN` para calcular `has_message`; elas nunca selecionam o texto. A consulta que seleciona `message` é separada, exige a árvore já autorizada e só é executada após o instante de liberação. O endpoint administrativo responde com `Cache-Control: private, no-store`.

O instante padrão é configurado por `MESSAGE_REVEAL_AT=2026-12-25 00:00:00` e `MESSAGE_REVEAL_TIMEZONE=America/Sao_Paulo`, equivalente a `2026-12-25T03:00:00Z`. `MessageReleasePolicy` compartilha a decisão entre enfeites e presentes premium: `LIBERAR_MENSAGEM=true` libera consultas privadas imediatamente; qualquer outro valor mantém a comparação com o relógio do servidor. A política não publica presentes nem persiste estado de revelação.

## Acesso sem conta

Na criação, o service gera três valores independentes: ID público (9 bytes/72 bits), token administrativo (32 bytes/256 bits) e código de recuperação (32 bytes/256 bits). Somente hashes dos dois segredos são gravados. O token administrativo bruto permanece na sessão PHP do responsável e nunca é entregue pela API.

O código de recuperação aparece uma única vez ao usuário. Quando usado, o backend compara o hash em tempo constante e rotaciona tanto o token administrativo quanto o código de recuperação em uma atualização condicional. Isso torna o código anterior inválido e evita dupla recuperação concorrente.

## Fronteiras das camadas

- controllers traduzem HTTP, CSRF, limites e envelopes JSON;
- `ChristmasTreeIdentityService` concentra validação, geração de identidade e autorização;
- `ChristmasTreeRepository` define o contrato de persistência;
- `PdoChristmasTreeRepository` usa prepared statements e não expõe hashes em consultas públicas;
- `TreeOwnerSession` isola o segredo administrativo na sessão;
- `RateLimiter` usa arquivos com lock em `storage/cache/rate-limits`, compatível com hospedagem compartilhada.
- `ChristmasTreeOrnamentService` valida tipos, nomes e mensagens, define cores, controla capacidade e aplica a data de revelação;
- `SocialOrnament` reutiliza o Canvas, câmera e iluminação existentes com geometrias nativas do Three.js.

## Pedidos e pagamentos Pix

`christmas_tree_gift_orders` mantém o preço contratado, estado financeiro e identificadores da Orders API; `christmas_tree_payment_events` registra eventos idempotentes sem conservar payloads. `GiftPaymentService` autoriza pelo token do rascunho e não conhece JSON do provedor. `PaymentGateway` define criação, consulta, interpretação e assinatura; `MercadoPagoPaymentGateway` implementa somente `POST/GET /v1/orders`.

Chamadas externas ocorrem fora de transações. A idempotência do provedor permite repetir uma criação incerta. Após consultar a fonte oficial, `PdoPaymentOrderRepository` bloqueia o pedido e grava evento, estado financeiro e eventual `draft → paid` em uma transação curta. Não existe transição para `published` nesta etapa.

## Frontend 3D

`frontend/App.tsx` inicializa o contexto vindo do PHP, carrega os enfeites uma vez por árvore e atualiza o estado somente após confirmação da API. `Overlay` mostra a identidade da árvore e só oferece edição ao proprietário. O modal social é mobile-first; tocar no enfeite usa o foco de câmera já existente. Apenas o modo proprietário consulta a API privada, uma vez por carregamento e após novas participações do próprio fluxo, sem polling. Mensagens são renderizadas como texto React com quebras de linha preservadas. Dados administrativos não são persistidos em `localStorage`.

### Orçamento adaptativo da cena

`frontend/utils/performance.ts` escolhe entre qualidade alta, equilibrada e econômica usando capacidade aproximada e carga de pixels, sem user-agent ou identificação. O perfil controla DPR, contagem e detalhe da folhagem, ambiente, partículas e pós-processamento. Quedas degradam um nível; a recuperação possui histerese e respeita o teto inicial. A qualidade alta preserva a geometria e os efeitos do desktop capaz. `PerformanceDiagnostics` existe somente no build de desenvolvimento e não integra dados da árvore, sessão ou APIs.

O Vite grava diretamente em `public/assets/app/`; o diretório compilado é versionado para produção sem Node.js. Em desenvolvimento, o proxy `/api` aponta para o backend PHP.

Os componentes sociais não adicionam dependências. O build da Etapa 05B gera JavaScript minificado de aproximadamente 1.225,8 kB (343,1 kB gzip), crescimento de cerca de 12,0 kB antes de gzip e 3,0 kB após gzip em relação à Etapa 05A.1; o custo principal continua sendo Three.js e o pipeline visual original.

Na Etapa 06, o JavaScript minificado passa a aproximadamente 1.232,0 kB (345,0 kB gzip), aumento de 6,2 kB antes de gzip e 1,9 kB após gzip sobre a Etapa 05B. O CSS cresce cerca de 1,0 kB. Nenhuma dependência foi adicionada.

Na Etapa 07, o JavaScript minificado passa a aproximadamente 1.239,1 kB (347,1 kB gzip), aumento de cerca de 7,0 kB antes de gzip e 2,1 kB após gzip. O CSS cresce menos de 0,1 kB e nenhuma dependência é adicionada.

Na Etapa 07B.1, o build padrão com a prévia desabilitada gera aproximadamente 1.239,6 kB de JavaScript (347,4 kB gzip), aumento de 0,5 kB antes de gzip e 0,2 kB após gzip; o CSS cresce 2,7 kB (0,4 kB gzip). Quando explicitamente habilitada, a prévia leva o JavaScript a aproximadamente 1.252,5 kB (351,2 kB gzip), impacto total de 13,4 kB antes de gzip e 4,1 kB após gzip sobre a Etapa 07. Nenhuma dependência foi adicionada.

## Progressão visual

`frontend/utils/treeProgression.ts` concentra os marcos de 0, 5, 10, 20, 35, 50 e 60 participações e seus efeitos cumulativos. O estágio é uma projeção pura de `ornaments.length`, coleção pública já persistida e devolvida pelo backend; elementos decorativos da cena, mensagens privadas, sessão e dados locais não participam do cálculo. Não há coluna, tabela, migration ou endpoint específico para níveis.

A árvore-base permanece completa no estágio zero. Os estágios seguintes acrescentam, sem substituir a geometria original: um pequeno reforço de luz, até 96 partículas douradas, no máximo quatro presentes especiais, brilho da estrela e um ajuste limitado de atmosfera. Esses tetos mantêm a carga previsível em dispositivos móveis e continuam sujeitos ao perfil de desempenho existente.

`App.tsx` só anuncia um desbloqueio depois que a API confirma a criação de um enfeite novo. A carga inicial apenas restaura o estágio, solicitações idempotentes não celebram duas vezes e a exclusão reduz naturalmente o estágio. A mensagem continua acessível com movimento reduzido, mas a animação temporária é suprimida quando `prefers-reduced-motion` está ativo.

Como cartão e vídeo usam o mesmo `Canvas` e a mesma cena, os efeitos de progressão aparecem nessas mídias sem pipeline adicional. O indicador HTML é ocultado durante a gravação e nunca é desenhado no conteúdo capturado.

## Cenário noturno expandido

`frontend/components/AmbientNight.tsx` acrescenta ao mesmo `Canvas` um trenó procedural, um rastro `Sparkles`, uma estrela cadente e luz hemisférica sutil. As formas são primitivas Three.js locais, não carregam modelos, texturas, áudio ou URLs externos e têm o raycast desativado para não participar da seleção de enfeites.

`frontend/utils/ambientEffects.ts` contém o agendamento testável. A primeira passagem do trenó ocorre entre 15 e 25 segundos; as seguintes, entre 45 e 90 segundos, com duração de 9,5 segundos. A estrela cadente espera inicialmente 8–16 segundos e depois 18–36 segundos, com duração de 1,6 segundo. Existe no máximo uma instância de cada efeito. O rastro usa 18 partículas no perfil completo, oito no reduzido e zero quando os efeitos opcionais são desligados.

Os relógios avançam dentro do `useFrame` existente, sem `setInterval`, outro renderer ou loop independente. A política pausa o agendamento e oculta os elementos durante captura vertical, gravação, movimento reduzido ou fallback de desempenho; ao terminar uma interrupção, o tempo restante continua do mesmo ponto. `PerformanceMonitor` reduz o cenário opcional após queda e pode desligá-lo após oscilações repetidas, enquanto `AdaptiveDpr` também reduz a resolução quando necessário. O estágio da Etapa 06 permanece derivado somente dos enfeites persistidos.

A política previsível para mídia é suspender todas as aparições ocasionais. Assim, PNGs e vídeos não capturam o trenó pela metade, enquanto a árvore, a progressão e a restauração da câmera mantêm o fluxo anterior.

## Prévia local de embalagem personalizada

`frontend/utils/giftTextures.ts` valida o conteúdo pela assinatura JPEG, PNG ou WebP, antes da decodificação. O limite padrão é 8 MB, configurável por `VITE_GIFT_PHOTO_MAX_BYTES` até o teto defensivo de 32 MB. Dimensões menores que 32 pixels, maiores que 12.000 pixels ou acima de 40 megapixels são rejeitadas. `createImageBitmap` com orientação do arquivo é preferido; a alternativa usa `HTMLImageElement` e Object URL local.

A fotografia decodificada fica apenas na memória do modal. Um recorte central do tipo `cover` preserva proporção e alimenta um Canvas 2D de 512×512. No modo repetido, nove cópias emolduradas são distribuídas sobre estrelas, flocos ou corações. No modo de destaque, as faces usam o padrão do estilo e uma textura separada coloca a foto maior na face frontal. Nenhum filtro facial, IA ou conversão externa é usado.

`GiftBoxModel`, extraído de `Presents.tsx`, mantém a mesma caixa arredondada, materiais físicos, fitas cruzadas e laço usados na árvore. `GiftPreviewModal` cria um segundo `Canvas` somente enquanto a prévia está aberta, com uma caixa e `frameloop="demand"`; ao mesmo tempo o Canvas principal muda temporariamente para `frameloop="never"`, preservando sua câmera sem dois loops permanentes. Fechar o modal retoma a cena original.

Trocas de estilo e modo reutilizam a imagem já decodificada e substituem apenas texturas Canvas. Efeitos de cleanup chamam `Texture.dispose()`, `ImageBitmap.close()` e `URL.revokeObjectURL()` quando aplicável. A persistência envia somente o canvas final para a API própria; não altera enfeites, mensagens, progressão ou compartilhamento.

A entrada é habilitada automaticamente por `import.meta.env.DEV`. Produção exige `VITE_ENABLE_GIFT_PREVIEW=true` no momento do build; o padrão versionado é `false`. Mesmo quando habilitada, a função apenas prepara um rascunho privado sem preço, checkout, pagamento, publicação ou promessa de envio.

Na Etapa 07B.2, o build padrão continua com aproximadamente 1.239,6 kB de JavaScript (347,4 kB gzip) porque o fluxo é removido por tree-shaking. O CSS passa a 38,4 kB (7,2 kB gzip). Com habilitação explícita, o JavaScript fica em aproximadamente 1.257,6 kB (352,3 kB gzip). Nenhuma dependência frontend foi adicionada.

## Persistência privada de presentes

Ao preparar um rascunho, o navegador envia somente um PNG final; a fotografia original nunca é transmitida. `GiftDraftApiController` protege criação por CSRF e rate limit e consulta/cancelamento por token próprio. `ChristmasTreeGiftService` concentra validação, estados, idempotência, expiração e compensação; `GiftTextureStorage` redecodifica com GD e mantém arquivos fora do Document Root.

`christmas_tree_gifts` associa o rascunho à árvore sem participar da coleção de enfeites. Por isso presentes premium futuros não alteram `ornaments.length`, os marcos da Etapa 06 nem as caixas procedurais existentes. Apenas `draft → cancelled|expired` está ativo; não existem endpoints para `paid` ou `published`. Consulte [armazenamento privado](GIFT_STORAGE.md).

## Compartilhamento social

`ShareTreeModal` oferece cópia, Web Share API e fallback explícito. A geração do cartão é iniciada somente pelo usuário: `socialSharing.ts` captura o `Canvas` já usado pelo React Three Fiber, preserva sua proporção e o compõe em um Canvas 2D de 1080×1920. Nenhuma segunda cena 3D é criada e nenhuma imagem é enviada ao servidor. URLs de objeto temporárias são revogadas após uso.

Compartilhamento de arquivo depende de `navigator.canShare({ files })`; navegadores incompatíveis recebem download PNG. O Instagram não é automatizado: a interface orienta publicar a imagem e inserir manualmente o adesivo de link.

Na Etapa 05B, `StoryCaptureController` também abre uma sessão temporária de gravação sobre a mesma cena. Ele salva câmera, controles, viewport e DPR; aplica a proporção 9:16; e restaura tudo quando a gravação termina, falha ou é cancelada. Um `useFrame` realiza uma órbita simples ou mantém a câmera estática quando `prefers-reduced-motion` está ativo. A sessão nunca cria outra geometria ou renderer permanente.

`videoRecording.ts` compõe os frames da cena em um Canvas 2D separado, acrescentando somente nome público, quantidade de participações, convite e marca. Esse canvas fornece o stream ao `MediaRecorder`. Codecs são escolhidos exclusivamente por `MediaRecorder.isTypeSupported`; o resultado pode ser MP4 ou WebM. O ciclo compartilhado pelo gravador original e pelo vídeo social limita duração, trata cancelamento/erros e encerra todas as tracks. URLs de objeto pertencem à interface e são revogadas ao substituir a prévia, desmontar o modal ou concluir downloads.

Nenhum vídeo, frame, mensagem ou credencial é enviado ao PHP. Dispositivos modestos usam 720×1280 a 24 FPS; o perfil superior usa 1080×1920 a 30 FPS. Ausência de `MediaRecorder`, `captureStream` ou compartilhamento de arquivos preserva link e PNG como fallback. Consulte [compartilhamento social](SOCIAL_SHARING.md) para uso e limitações.

`TreePageController` renderiza título, descrição, canonical, Open Graph e Twitter Card antes do JavaScript. A imagem `public/assets/images/christmas-tree-social.jpg` é genérica, estática e compartilhada entre árvores; apenas título e descrição são personalizados. Nenhuma mensagem é consultada para produzir metadados.

## Estabilização 08A

O backend fornece `public_path`; o frontend combina esse caminho com `window.location.origin` exclusivamente para compartilhamento. A autorização continua baseada em sessão/token administrativo ou credencial persistente validada no banco, nunca no caminho público. Cookies não atravessam hostnames diferentes.

`videoFraming.ts` calcula distância pela projeção perspectiva 9:16. `StoryCaptureController` aplica exposição temporária e restaura renderer mesmo em erro/cancelamento. O layout premium v1 permanece legível; novas publicações usam v2. `AmbientNight` mantém agendamento e qualidade adaptativa, com eventos de diagnóstico compilados somente em desenvolvimento.

## Refinamento 08A.1

`videoFraming.ts` também parametriza a captura por ângulo, raio e altura. A câmera completa 360° até 7 s com velocidade angular suavizada, usa um zoom limitado pela projeção do volume completo da cena entre 2–5 s, retorna ao raio inicial entre 5–7 s e mantém a frente estática entre 7–8 s. Em movimento reduzido, ângulo e câmera permanecem fixos.

`StoryCaptureFillLights` adiciona dois preenchimentos discretos somente enquanto `captureActive` é verdadeiro. O mesmo ciclo que restaura câmera, controles, viewport, DPR e exposição desativa a iluminação no fim, cancelamento, erro ou desmontagem. A interface inferior usa grid de duas linhas em telas estreitas e flex no desktop, sem uma segunda implementação de interface.

## Produção

O mirror HostGator inclui app, migration, views, rotas, assets compilados e dependências PHP de produção. Exclui `.env`, frontend fonte, testes, logs, cache e uploads. A migration é executada separadamente e o diretório `storage/cache` precisa ser gravável pelo PHP.

## Inicialização e recursos secundários

`App` controla `initializing → loading_data → preparing_scene → first_frame → ready`, com `error` recuperável e timeout de 20 s por etapa essencial. `SceneReadiness` só sinaliza prontidão após o contexto WebGL, sincronização dos enfeites e dois frames reais. Perda de contexto e exceções da árvore de componentes encerram o loading em erro.

Memórias e presentes usam requisições abortáveis e não participam da prontidão essencial. `Polaroid` não usa `useTexture`/Suspense: uma fila com concorrência 2 decodifica a imagem otimizada já publicada, reduz o bitmap para no máximo 512 px em Canvas e cria a textura progressivamente. Falhas ficam isoladas no cartão. Geometrias da árvore reservam os seis slots de memória desde a primeira geração, evitando reconstruir 20.000 folhas quando a coleção chega.

O cache progressivo mantém uma entrada identificável por URL e contagem de referências. A resolução, rejeição e liberação só removem o registro quando ele ainda é a entrada corrente daquela URL; uma limpeza antiga nunca remove um remount mais novo. A textura é descartada uma única vez após a última referência e o `Polaroid` só aplica uma textura vinculada à URL atual. Diagnósticos de desenvolvimento usam apenas um identificador sequencial anônimo e o estágio do recurso, sem registrar URLs.

Como o material pode ser compilado no primeiro frame antes da chegada da fotografia, `Polaroid` não depende de uma atribuição declarativa tardia de `map`. Um layout effect aplica ou remove a textura e marca `MeshStandardMaterial.needsUpdate`, recompilando os defines do shader ao transitar entre placeholder e fotografia. Substituições também invalidam o material uma única vez; nenhuma atualização ocorre por frame.

O perfil inicial limita DPR a 1,25 e a árvore a 12.000 folhas em dispositivos modestos; nos demais, limita DPR a 1,75 e preserva 20.000 folhas. `PerformanceMonitor` e `AdaptiveDpr` continuam ajustando efeitos depois. Instrumentação via User Timing existe apenas em desenvolvimento e usa nomes fixos, sem identificadores públicos, URLs ou conteúdo privado.

## Identidade anônima e participação gratuita

`VisitorIdentityService` emite seletor e verificador aleatórios. O cookie contém ambos; o banco guarda somente o seletor e o hash SHA-256 do verificador. A identidade é independente da sessão PHP e da credencial administrativa da árvore.

`christmas_tree_visitor_participations` impõe unicidade em `(tree_id, visitor_identity_id)`. O repositório verifica primeiro a idempotência, bloqueia a árvore em transação e depois registra enfeite, mensagem e participação. `ornament_id` usa `ON DELETE SET NULL`, preservando o marcador após moderação sem reter a mensagem excluída. A coleção pública expõe somente `current_visitor_has_decorated` e não revela identidades ou participações de terceiros.
