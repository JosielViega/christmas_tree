# Desenvolvimento local

## Preparação

```bash
composer install
composer setup
npm --prefix frontend ci
npm --prefix frontend run build
```

Crie um banco MySQL vazio, configure as variáveis `DB_*` no `.env` e execute:

```bash
composer migrate
composer serve
```

O setup reserva uma porta PHP livre e não sobrescreve um `.env` existente. As migrations criam as identidades e os enfeites sociais. Configure opcionalmente `ORNAMENT_MAX_PER_TREE` (máximo físico 60 no layout v1).

## Hot reload do React

Mantenha `composer serve` ativo e, em outro terminal:

```bash
npm --prefix frontend run dev
```

O proxy do Vite encaminha `/api` ao valor de `APP_URL`; se ele não estiver definido, usa `http://127.0.0.1:8010`. A página integrada usa os arquivos compilados, então refaça o build após mudanças no frontend.

## Testes

```bash
composer check
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend audit
git diff --check
```

O conjunto padrão usa repository em memória e não toca no MySQL. Para validar PDO e a migration, use exclusivamente um banco descartável/isolado:

```bash
composer migrate
CHRISTMAS_TREE_MYSQL_INTEGRATION=1 composer test -- --filter PdoChristmasTreeRepositoryIntegrationTest
```

O teste abre uma transação e desfaz os registros criados, mas não cria nem remove o banco. Nunca habilite essa flag apontando para produção.

## Checklist funcional

- criar duas árvores com o mesmo nome e confirmar URLs diferentes;
- salvar o código mostrado no recibo de criação;
- abrir o link em janela privada e confirmar ausência de edição;
- recuperar acesso e confirmar que o código anterior não funciona mais;
- verificar `/health` e `/credits`;
- abrir uma árvore em janela privada, adicionar dois tipos de enfeite e recarregar a página;
- confirmar que os enfeites permanecem nas mesmas posições e mostram o nome ao toque;
- como proprietário, remover um enfeite; como visitante, confirmar que o controle não aparece;
- preencher os 60 slots em ambiente isolado e confirmar a mensagem de árvore completa;
- testar larguras móveis e os controles 3D existentes.

Não adicione segredos ao frontend: valores compilados pelo Vite tornam-se públicos. A credencial administrativa deve permanecer apenas na sessão PHP.
