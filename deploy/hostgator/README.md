# Deploy manual para HostGator/cPanel

Este diretório descreve um pacote local de atualização para hospedagem compartilhada. O código-fonte normal continua sendo a única fonte de verdade; `mirror/` é reconstruído e nunca deve ser editado ou versionado.

```text
código-fonte
      ↓
composer deploy:hostgator
      ↓
deploy/hostgator/mirror/
      ↓
cópia manual para a hospedagem
```

O builder não possui FTP, SFTP, sincronização, exclusão remota ou execução de migrations.

## Gerar o mirror

Na raiz do projeto:

```bash
composer check
composer deploy:hostgator
```

Antes do primeiro pacote, execute `npm --prefix frontend ci`. O segundo comando recompila o frontend, executa `composer check`, limpa somente o mirror local anterior, copia a allowlist de produção, instala dependências PHP com o lockfile e valida a saída. Ao terminar, `deploy/hostgator/build-info.json` registra apenas data UTC, commit, estado limpo/sujo da árvore de trabalho, versões das ferramentas, modo de instalação e quantidade de arquivos.

O manifesto versionado está em `config/deploy.php`. Ao surgir uma nova área de produção, adicione-a conscientemente à lista `include`; o builder não adota diretórios novos automaticamente.

## Conteúdo incluído

- `app/`, `bootstrap/` e `config/` da aplicação;
- migrations SQL versionadas, sem executá-las;
- `public/index.php`, `public/.htaccess` e assets públicos;
- runners CLI de status/migration e manutenção, com lock contra sobreposição;
- frontend Vite já compilado em `public/assets/app/`, incluindo o manifesto;
- views e rotas;
- `composer.json` e `composer.lock`;
- `vendor/` recém-instalado em modo de produção.

## Conteúdo protegido

Nunca entram no mirror:

- `.env`, `.env.example` ou qualquer arquivo iniciado por `.env`;
- `.htaccess` em qualquer nível, `.user.ini`, `php.ini` e `error_log`;
- `.git/`, `.github/`, testes, PHPUnit, documentação de desenvolvimento e metadados do editor/Git;
- `frontend/`, `node_modules/` e fontes TypeScript, que não são requisitos de execução;
- conteúdo de `public/uploads/`, `storage/logs/` e `storage/cache/`;
- `cgi-bin/`, `.well-known/`, `ssl/`, `tmp/`, `logs/` e `backups/`;
- arquivos `*.log`, `*.pem`, `*.key`, `*.crt`, `*.p12` e `*.pfx`;
- nomes suspeitos contendo `secret`, `credential`, `private-key` ou `private_key`.

Os exemplos em `server-config-examples/` ficam fora do mirror e não se chamam `.htaccess` de propósito.

> As regras de exemplo devem ser MESCLADAS manualmente ao `.htaccess` existente do servidor quando necessário; nunca substitua o arquivo inteiro automaticamente.

## Primeira instalação

1. Confirme no cPanel o diretório real do domínio. O domínio principal pode usar `public_html`, mas domínios adicionais podem usar outros diretórios.
2. Prefira manter o projeto fora da área pública e apontar o Document Root para `public/`.
3. Copie os arquivos de produção para a estrutura correspondente.
4. Para a produção temporária, use `config/production-temporary.env.example` como checklist e crie o `.env` diretamente no servidor com `APP_ENV=production`, `APP_URL=https://natal.jzlcode.com.br`, `APP_DEBUG=false`, `SESSION_SECURE=true`, banco próprio e pagamentos desabilitados.
5. Configure a versão adequada do PHP pelo cPanel.
6. Mescle manualmente as regras necessárias dos exemplos nos `.htaccess` já existentes.
7. Crie `storage/logs`, `storage/cache` e `public/uploads` quando necessários e aplique permissões mínimas de escrita ao usuário PHP. Os rate limiters de árvore, recuperação e enfeites gravam em `storage/cache/rate-limits`.
8. Crie o banco e o usuário no painel da hospedagem.
9. Execute primeiro `composer migrate:status`; depois, com backup disponível, execute migrations separadamente e de forma consciente.
10. Teste criação, URL pública, metadados Open Graph, imagem `/assets/images/christmas-tree-social.jpg`, compartilhamento/download do cartão, decoração com mensagem como visitante, estado bloqueado, remoção como proprietário, recuperação em outro navegador, `/credits`, health check, sessão e escrita em cache/log. Valide a revelação em instalação isolada, nunca alterando o relógio ou os dados de produção para antecipá-la.

Não há caminho absoluto de conta embutido no template.

## Presentes privados

O mirror inclui somente `storage/private/.gitkeep`, nunca texturas. Crie `storage/private/gift-textures` fora do Document Root, com escrita exclusiva para o usuário PHP. Confirme `fileinfo` e GD com PNG e configure o cron do cPanel para executar `composer gifts:cleanup`. Se não for possível isolar esse diretório de `public/`, mantenha a funcionalidade desabilitada.

Pagamentos exigem também cURL, HTTPS e cron. Na produção temporária, mantenha `PAYMENTS_ENABLED=false`, `PAYMENTS_ALLOW_PRODUCTION=false`, credenciais vazias e o cron financeiro desabilitado. Uma ativação futura exigirá autorização separada, credenciais de produção, segredo do webhook e URL HTTPS do tópico `order`; não copie credenciais entre ambientes. O cron reconcilia orders pendentes antes de remover qualquer textura.

O runbook completo, incluindo a estratégia de produção temporária, requisitos de PHP/MySQL, cron de 15 minutos, checklist do cPanel e rollback não destrutivo, está em [`../../docs/HOSTGATOR_DEPLOYMENT.md`](../../docs/HOSTGATOR_DEPLOYMENT.md).

## Atualizações futuras

1. Atualize e teste o código localmente.
2. Execute `composer check`.
3. Execute `composer deploy:hostgator`.
4. Revise `build-info.json` e o conteúdo de `mirror/`.
5. Copie o conteúdo do mirror sobre os caminhos correspondentes no servidor.
6. Preserve os arquivos e diretórios protegidos listados acima.
7. Se houver migrations novas, execute-as em uma etapa separada e planejada.

O mirror representa apenas arquivos que podem ser atualizados. Ele não representa uma lista de arquivos que devem ser apagados do servidor; remoções de código antigo exigem revisão manual.
