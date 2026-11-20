# Arquitetura

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

O instante padrão é configurado por `MESSAGE_REVEAL_AT=2026-12-25 00:00:00` e `MESSAGE_REVEAL_TIMEZONE=America/Sao_Paulo`, equivalente a `2026-12-25T03:00:00Z`. `ChristmasTreeOrnamentService` usa o relógio do servidor; o relógio injetável existe somente para testes determinísticos de fronteira.

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

## Frontend 3D

`frontend/App.tsx` inicializa o contexto vindo do PHP, carrega os enfeites uma vez por árvore e atualiza o estado somente após confirmação da API. `Overlay` mostra a identidade da árvore e só oferece edição ao proprietário. O modal social é mobile-first; tocar no enfeite usa o foco de câmera já existente. Apenas o modo proprietário consulta a API privada, uma vez por carregamento e após novas participações do próprio fluxo, sem polling. Mensagens são renderizadas como texto React com quebras de linha preservadas. Dados administrativos não são persistidos em `localStorage`.

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

Trocas de estilo e modo reutilizam a imagem já decodificada e substituem apenas texturas Canvas. Efeitos de cleanup chamam `Texture.dispose()`, `ImageBitmap.close()` e `URL.revokeObjectURL()` quando aplicável. Não há chamada a API, storage, analytics, endpoint PHP, nova migration ou mudança nos enfeites, mensagens, progressão e compartilhamento.

A entrada é habilitada automaticamente por `import.meta.env.DEV`. Produção exige `VITE_ENABLE_GIFT_PREVIEW=true` no momento do build; o padrão versionado é `false`. Mesmo quando habilitada, a função continua sendo uma demonstração local sem preço, checkout, pedido ou promessa de envio.

## Compartilhamento social

`ShareTreeModal` oferece cópia, Web Share API e fallback explícito. A geração do cartão é iniciada somente pelo usuário: `socialSharing.ts` captura o `Canvas` já usado pelo React Three Fiber, preserva sua proporção e o compõe em um Canvas 2D de 1080×1920. Nenhuma segunda cena 3D é criada e nenhuma imagem é enviada ao servidor. URLs de objeto temporárias são revogadas após uso.

Compartilhamento de arquivo depende de `navigator.canShare({ files })`; navegadores incompatíveis recebem download PNG. O Instagram não é automatizado: a interface orienta publicar a imagem e inserir manualmente o adesivo de link.

Na Etapa 05B, `StoryCaptureController` também abre uma sessão temporária de gravação sobre a mesma cena. Ele salva câmera, controles, viewport e DPR; aplica a proporção 9:16; e restaura tudo quando a gravação termina, falha ou é cancelada. Um `useFrame` realiza uma órbita simples ou mantém a câmera estática quando `prefers-reduced-motion` está ativo. A sessão nunca cria outra geometria ou renderer permanente.

`videoRecording.ts` compõe os frames da cena em um Canvas 2D separado, acrescentando somente nome público, quantidade de participações, convite e marca. Esse canvas fornece o stream ao `MediaRecorder`. Codecs são escolhidos exclusivamente por `MediaRecorder.isTypeSupported`; o resultado pode ser MP4 ou WebM. O ciclo compartilhado pelo gravador original e pelo vídeo social limita duração, trata cancelamento/erros e encerra todas as tracks. URLs de objeto pertencem à interface e são revogadas ao substituir a prévia, desmontar o modal ou concluir downloads.

Nenhum vídeo, frame, mensagem ou credencial é enviado ao PHP. Dispositivos modestos usam 720×1280 a 24 FPS; o perfil superior usa 1080×1920 a 30 FPS. Ausência de `MediaRecorder`, `captureStream` ou compartilhamento de arquivos preserva link e PNG como fallback. Consulte [compartilhamento social](SOCIAL_SHARING.md) para uso e limitações.

`TreePageController` renderiza título, descrição, canonical, Open Graph e Twitter Card antes do JavaScript. A imagem `public/assets/images/christmas-tree-social.jpg` é genérica, estática e compartilhada entre árvores; apenas título e descrição são personalizados. Nenhuma mensagem é consultada para produzir metadados.

## Produção

O mirror HostGator inclui app, migration, views, rotas, assets compilados e dependências PHP de produção. Exclui `.env`, frontend fonte, testes, logs, cache e uploads. A migration é executada separadamente e o diretório `storage/cache` precisa ser gravável pelo PHP.
