# Desenvolvimento local

## Preparação

```bash
composer install
composer setup
npm --prefix frontend ci
npm --prefix frontend run build
```

O setup original reserva uma porta PHP livre entre 8010 e 8999 e grava apenas a associação local em `%USERPROFILE%\.modeloPHP\ports.json` (Windows) ou `~/.modeloPHP/ports.json` (Linux/macOS). Ele não encerra processos nem sobrescreve um `.env` existente.

## Aplicação integrada

```bash
composer serve
```

O servidor embutido usa a porta de `APP_PORT`. A página `/` lê os arquivos compilados de `public/assets/app`; por isso execute um build após mudanças no frontend.

## Hot reload do React

```bash
npm --prefix frontend run dev
```

O Vite tenta usar `127.0.0.1:5173` e informa outra porta se ela já estiver ocupada. Use a URL impressa no terminal. O Vite não é requisito de produção.

## Verificações

```bash
composer validate --strict
composer lint
composer test
composer check
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend audit
git diff --check
```

Não adicione segredos ao frontend: valores compilados pelo Vite tornam-se públicos. Nesta etapa nenhum token ou webhook é necessário.
