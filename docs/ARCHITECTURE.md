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
- `ChristmasTreeOrnamentService` valida tipos/nomes, define cores e controla a capacidade;
- `SocialOrnament` reutiliza o Canvas, câmera e iluminação existentes com geometrias nativas do Three.js.

## Frontend 3D

`frontend/App.tsx` inicializa o contexto vindo do PHP, carrega os enfeites uma vez por árvore e atualiza o estado somente após confirmação da API. `Overlay` mostra a identidade da árvore e só oferece edição ao proprietário. O modal social é mobile-first; tocar no enfeite usa o foco de câmera já existente. Dados administrativos não são persistidos em `localStorage`.

O Vite grava diretamente em `public/assets/app/`; o diretório compilado é versionado para produção sem Node.js. Em desenvolvimento, o proxy `/api` aponta para o backend PHP.

Os componentes sociais não adicionam dependências. Em relação à Etapa 02, o bundle JavaScript minificado passou aproximadamente de 1.181,5 kB para 1.194,7 kB (cerca de 3,6 kB adicionais após gzip); o custo principal continua sendo Three.js e o pipeline visual original.

## Produção

O mirror HostGator inclui app, migration, views, rotas, assets compilados e dependências PHP de produção. Exclui `.env`, frontend fonte, testes, logs, cache e uploads. A migration é executada separadamente e o diretório `storage/cache` precisa ser gravável pelo PHP.
