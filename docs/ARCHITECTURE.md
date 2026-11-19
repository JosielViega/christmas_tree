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

## Compartilhamento social

`ShareTreeModal` oferece cópia, Web Share API e fallback explícito. A geração do cartão é iniciada somente pelo usuário: `socialSharing.ts` captura o `Canvas` já usado pelo React Three Fiber, preserva sua proporção e o compõe em um Canvas 2D de 1080×1920. Nenhuma segunda cena 3D é criada e nenhuma imagem é enviada ao servidor. URLs de objeto temporárias são revogadas após uso.

Compartilhamento de arquivo depende de `navigator.canShare({ files })`; navegadores incompatíveis recebem download PNG. O Instagram não é automatizado: a interface orienta publicar a imagem e inserir manualmente o adesivo de link.

Na Etapa 05B, `StoryCaptureController` também abre uma sessão temporária de gravação sobre a mesma cena. Ele salva câmera, controles, viewport e DPR; aplica a proporção 9:16; e restaura tudo quando a gravação termina, falha ou é cancelada. Um `useFrame` realiza uma órbita simples ou mantém a câmera estática quando `prefers-reduced-motion` está ativo. A sessão nunca cria outra geometria ou renderer permanente.

`videoRecording.ts` compõe os frames da cena em um Canvas 2D separado, acrescentando somente nome público, quantidade de participações, convite e marca. Esse canvas fornece o stream ao `MediaRecorder`. Codecs são escolhidos exclusivamente por `MediaRecorder.isTypeSupported`; o resultado pode ser MP4 ou WebM. O ciclo compartilhado pelo gravador original e pelo vídeo social limita duração, trata cancelamento/erros e encerra todas as tracks. URLs de objeto pertencem à interface e são revogadas ao substituir a prévia, desmontar o modal ou concluir downloads.

Nenhum vídeo, frame, mensagem ou credencial é enviado ao PHP. Dispositivos modestos usam 720×1280 a 24 FPS; o perfil superior usa 1080×1920 a 30 FPS. Ausência de `MediaRecorder`, `captureStream` ou compartilhamento de arquivos preserva link e PNG como fallback. Consulte [compartilhamento social](SOCIAL_SHARING.md) para uso e limitações.

`TreePageController` renderiza título, descrição, canonical, Open Graph e Twitter Card antes do JavaScript. A imagem `public/assets/images/christmas-tree-social.jpg` é genérica, estática e compartilhada entre árvores; apenas título e descrição são personalizados. Nenhuma mensagem é consultada para produzir metadados.

## Produção

O mirror HostGator inclui app, migration, views, rotas, assets compilados e dependências PHP de produção. Exclui `.env`, frontend fonte, testes, logs, cache e uploads. A migration é executada separadamente e o diretório `storage/cache` precisa ser gravável pelo PHP.
