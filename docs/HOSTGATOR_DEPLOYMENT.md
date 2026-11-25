# Homologação e implantação na HostGator

Este documento prepara uma primeira homologação; ele não autoriza upload, migration remota, webhook ou pagamento. O pacote é gerado localmente por allowlist e a instalação remota é manual.

## Requisitos confirmados

- PHP mínimo do projeto: 8.2; recomendado para a homologação: 8.5, depois de confirmar a versão efetivamente oferecida ao domínio no MultiPHP Manager.
- Extensões obrigatórias: `curl`, `fileinfo`, `gd` com JPEG/PNG/WebP, `mbstring`, `PDO` e `pdo_mysql`. JSON, hash, OpenSSL, session e random devem estar disponíveis na instalação PHP.
- Apache 2.4 com `mod_rewrite` e, preferencialmente, `mod_headers`.
- MySQL 5.7 ou 8.0, InnoDB e `utf8mb4`. Em MySQL 5.7 os `CHECK` podem ser apenas aceitos/ignorados; a aplicação mantém validação própria, mas a homologação deve confirmar o servidor e o `sql_mode` no cPanel.
- O frontend é estático depois do build. Node.js/Vite não são necessários no servidor.

Para esta aplicação, configure no cPanel pelo menos `memory_limit=128M`,
`upload_max_filesize=8M`, `post_max_size=9M` e `max_execution_time=60`.
Esses valores ficam abaixo dos limites publicados para o plano compartilhado e
acomodam o maior upload aceito pela aplicação sem ampliar os limites internos.

Referências HostGator consultadas em 24/11/2026:

- [Versões e seleção de PHP](https://suporte.hostgator.com.br/hc/pt-br/articles/30807998885395-Como-alterar-a-vers%C3%A3o-do-PHP-na-hospedagem)
- [Limites de configuração PHP compartilhada](https://suporte.hostgator.com.br/hc/pt-br/articles/30818470707219-Como-funcionam-as-configura%C3%A7%C3%B5es-do-PHP)
- [Compatibilidade de MySQL/PDO por servidor](https://suporte.hostgator.com.br/hc/pt-br/articles/30811116692115-Quais-s%C3%A3o-as-compatibilidades-da-HostGator)
- [Cron em hospedagem compartilhada](https://suporte.hostgator.com.br/hc/pt-br/articles/30814729836435-Como-funciona-um-trabalho-cron)
- [Document Root de domínio/subdomínio](https://suporte.hostgator.com.br/hc/pt-br/articles/30814940779283-Como-adicionar-subdom%C3%ADnios-na-hospedagem)

Os artigos da HostGator não são totalmente uniformes sobre as versões instaladas em todos os servidores. A versão do domínio, o MySQL 5.7/8.0 e o caminho do PHP CLI são itens obrigatórios de confirmação no cPanel.

## Estrutura segura

Preferida:

```text
/home/CPANEL_USER/christmas-tree-staging/   aplicação, vendor, .env e storage
/home/CPANEL_USER/christmas-tree-staging/public/   único Document Root HTTPS
```

`app/`, `config/`, `database/`, `storage/`, `vendor/` e `.env` ficam fisicamente fora do Document Root. O arquivo `public/.htaccess` entrega rewrite, HTTPS, bloqueio de listagem, cabeçalhos de segurança e cache estático. Não use `.htaccess` como substituto para o isolamento físico.

Se o cPanel não permitir apontar o domínio para `public/`, não copie a aplicação inteira para `public_html`. Mantenha a aplicação em `/home/CPANEL_USER/christmas-tree-staging` e peça ao suporte uma raiz de documento dedicada. Uma adaptação de front controller só deve ser feita depois de conhecer os caminhos reais da conta.

## Build e pacote

```bash
npm --prefix frontend ci
composer check
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend audit
composer deploy:hostgator
```

O mirror em `deploy/hostgator/mirror/` contém PHP da aplicação, migrations e seus runners CLI, `public/index.php`, `public/.htaccess`, assets Vite com hash, views, rotas, lock do cron, lockfiles e `vendor/` de produção com autoload autoritativo. Não contém `.env`, testes, TypeScript, `node_modules`, logs, cache, uploads, texturas, memórias, certificados ou dependências de desenvolvimento.

O builder rejeita executáveis inesperados sob `public/`, nomes protegidos, extensões de chaves/certificados e padrões de conteúdo compatíveis com credenciais. O mirror não é uma lista de arquivos para apagar no servidor.

## Configuração de homologação

Use `deploy/hostgator/config/staging.env.example` como checklist e crie o `.env` diretamente fora de `public/`. A primeira homologação exige `APP_ENV=staging`, `APP_DEBUG=false`, URL HTTPS, timezone de São Paulo, cookies Secure e banco exclusivo. Caminhos de cache, logs, memórias e texturas devem apontar para diretórios privados e graváveis.

Mantenha:

```dotenv
PAYMENTS_ENABLED=false
PAYMENTS_ENVIRONMENT=sandbox
PAYMENTS_ALLOW_PRODUCTION=false
PAYMENTS_SANDBOX_APRO=false
```

O modo APRO aceita somente `APP_ENV=testing`; portanto não pode ser habilitado em staging ou produção. Não copie o banco técnico, credenciais locais ou a Order de R$ 50,00.

## Banco e migrations

1. Crie banco e usuário exclusivos de homologação, com privilégios somente nesse banco.
2. Exporte um backup antes de qualquer atualização e faça download fora do Document Root.
3. Execute `composer migrate:status`; retorno 2 significa migrations pendentes, sem alterar schema.
4. Revise a lista e execute `composer migrate` uma vez, em janela controlada.
5. Execute novamente `composer migrate:status`; o resultado esperado é zero pendências.
6. Valide tabelas, índices, FKs, charset/collation e permissões.

DDL MySQL pode realizar commit implícito. Rollback de schema deve usar backup testado ou migration corretiva; nunca apague Orders, eventos financeiros, presentes ou árvores para voltar uma versão.

## Webhook, polling e reconciliação

O endpoint oficial permanece `POST /api/payments/webhook/mercadopago?data.id=...&type=order`. A regra `[QSA]` preserva `data.id`; Apache encaminha `x-signature` e `x-request-id` como headers HTTP. HMAC, `live_mode`, ambiente, referência, ID, valor e consulta oficial continuam obrigatórios. Retries usam eventos idempotentes.

O frontend consulta somente o backend a cada dez segundos por até dez minutos. Webhook válido atualiza o banco imediatamente; o cron de 15 minutos é recuperação, não o único caminho de confirmação.

No plano compartilhado, use no máximo a cada 15 minutos e confirme o caminho do PHP CLI no cPanel:

```cron
*/15 * * * * cd /home/CPANEL_USER/christmas-tree-staging && /CAMINHO/CONFIRMADO/php bin/cleanup-gift-drafts.php >> /home/CPANEL_USER/christmas-tree-staging/storage/logs/gifts-cron.log 2>&1
```

O script possui lock não bloqueante em `storage/cache/locks/gifts-cleanup.lock`; uma execução sobreposta encerra sem reconciliar duas vezes. A saída contém apenas contagens ou classe sanitizada de falha. Defina retenção curta para o log do cron e nunca o coloque sob `public/`.

Não cadastre webhook na primeira publicação. Depois da homologação funcional, a ativação Sandbox exige nova autorização, credenciais exclusivamente de teste e URL HTTPS definitiva. O ingresso local/cloudflared nunca é servidor de produção.

## Checklist da primeira homologação

Antes:

- backup de arquivos e banco; pacote e `build-info.json` revisados, sem promover um build marcado como `working_tree_dirty`;
- domínio/subdomínio HTTPS com Document Root em `public/`;
- PHP web e CLI, extensões, MySQL e limites confirmados no cPanel;
- `.env` criado no servidor, debug e pagamentos desabilitados;
- banco isolado, diretórios privados e permissões mínimas;
- webhook e cron inicialmente desabilitados.

Depois, sem pagamentos:

- `/health`, página inicial, criação e URL pública;
- sessão/cookies persistentes e recuperação;
- enfeite único, mensagens bloqueadas e autorização do proprietário;
- memórias, texturas privadas, compartilhamento PNG/vídeo e árvore 3D;
- assistente premium apenas em prévia, inclusive mobile;
- 404, APIs, CSRF, rate limiting, cache, headers e ausência de stack trace;
- logs sanitizados e persistência após recarregar.

## Rollback não destrutivo

1. Desative imediatamente pagamentos (`PAYMENTS_ENABLED=false`) e, em incidente de webhook, remova/desative a URL no painel sem apagar eventos.
2. Preserve `.env`, storage privado, logs e banco; nunca restaure um backup antigo sobre Orders novas.
3. Reponha o pacote anterior versionado, sem executar migrations reversas automaticamente.
4. Se houve migration aditiva, mantenha colunas/tabelas compatíveis e aplique correção forward. Para uma mudança destrutiva futura, restaure somente após plano específico e conciliação financeira.
5. Confirme `/health`, banco e leitura das árvores; mantenha pagamentos desligados até concluir diagnóstico.
6. Guarde logs sanitizados e `build-info.json` do pacote problemático para correlação.

## Pendências do cPanel

- domínio/subdomínio e Document Root real;
- PHP web disponível e caminho absoluto do PHP CLI;
- extensões GD/WebP, cURL, fileinfo, mbstring, PDO MySQL e OpenSSL;
- MySQL 5.7 ou 8.0, versão exata e `sql_mode`;
- limites efetivos de upload, POST, memória e execução;
- permissões do usuário PHP e possibilidade de cron;
- emissão/renovação do certificado HTTPS;
- método de backup e restauração oferecido pelo plano.
