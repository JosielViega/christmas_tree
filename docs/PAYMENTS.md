# Pagamentos Pix

## Publicação após confirmação

Uma confirmação válida atualiza pedido e presente para `paid`; em seguida, fora da transação financeira, o serviço tenta publicar a caixa. Falha temporária não perde o pagamento: o presente permanece `paid` e o cron tenta novamente. A publicação reconfirma localmente pedido, textura e integridade em transação própria. Notificações repetidas e reconciliação são idempotentes.

Pedidos `refunded` nunca são publicáveis. Se a caixa já estava publicada, ela é ocultada sem destruir pedido, eventos ou textura. Ocultar por moderação não aciona reembolso. HostGator precisa agendar `composer gifts:cleanup`; não há worker Node permanente.

## Escopo e provedor

A Etapa 07B.3 usa exclusivamente o Checkout Transparente do Mercado Pago pela **Orders API**: `POST /v1/orders` para criar a order Pix e `GET /v1/orders/{id}` para confirmação e reconciliação. Não usa a Payments API legada, Checkout Pro, cartão ou Asaas. O gateway fica atrás de `PaymentGateway`, permitindo substituir o provedor sem acoplar o domínio ao JSON externo.

Pagamentos ficam desabilitados por padrão. Desenvolvimento exige credenciais de uma conta de teste apropriada, `PAYMENTS_ENVIRONMENT=sandbox`, segredo de Webhook e ativação explícita. Produção exige adicionalmente `APP_ENV=production`, `APP_URL` HTTPS e `PAYMENTS_ALLOW_PRODUCTION=true`. Nunca use credenciais reais no ambiente local.

## Produtos e pedidos

O catálogo do servidor define `special` por 199 centavos, `personalized` por 399 e `magic` por 599. Valores e versão são configuráveis, mas cada pedido copia produto, centavos, moeda `BRL` e versão vigentes; mudanças posteriores não alteram pedidos existentes. O frontend envia somente código do produto e e-mail obrigatório pelo provedor. O e-mail não é persistido localmente.

Um presente possui no máximo um pedido. O banco grava hashes das chaves de idempotência e da solicitação, nunca tokens ou credenciais. A chave enviada ao Mercado Pago deriva do ID aleatório do pedido e é reutilizada após timeout. Assim, uma resposta incerta pode ser repetida sem criar outra cobrança.

## Estados

Estados financeiros: `pending`, `paid`, `expired`, `cancelled`, `failed` e `refunded`. `pending` pode avançar a um estado final; `paid` pode avançar somente para `refunded`. Estados finais nunca retornam a `pending`.

`processed/accredited` vira `paid`; `action_required/waiting_transfer`, `created` e `processing` permanecem `pending`; cancelamento e expiração são separados; reembolso integral, parcial ou decorrente de estorno vira `refunded`. O estado financeiro é separado da publicação. Uma confirmação confiável muda o presente de `draft` para `paid` e o backend tenta a publicação idempotente. Não existe rota pública para o navegador definir `paid` ou `published`.

## Webhook e confirmação

Endpoint: `POST /api/payments/webhook/mercadopago?data.id={order_id}&type=order`.

O backend valida tamanho, tópico, identificadores, `x-request-id` e `x-signature`. A assinatura usa o manifesto oficial `id:{data.id};request-id:{x-request-id};ts:{ts};` e HMAC-SHA256 com comparação em tempo constante. Depois da validação, o corpo serve apenas para identificar o evento; o estado financeiro é consultado em `GET /v1/orders/{id}`.

Antes da transição, o backend confere ID externo, order do provedor, valor em centavos, moeda derivada da conta brasileira e ambiente. A gravação de evento, mudança do pedido e `draft -> paid` ocorrem em transação MySQL. `event_key` único bloqueia replay. QR Code, Pix Copia e Cola e ticket nunca entram nos logs.

## Reconciliação, expiração e limpeza

`composer gifts:cleanup` primeiro reconcilia pedidos `pending` que já possuem ID no provedor, depois limpa rascunhos. Um rascunho associado a pedido `pending` ou `paid` é excluído da seleção de limpeza. Falha ou indisponibilidade do provedor conserva o arquivo e o pedido para a próxima execução. Pedidos e eventos financeiros não são apagados pelo cron.

Configure o cron do cPanel em intervalo conservador. O polling do navegador lê apenas o banco local a cada dez segundos e para após dez minutos; ele nunca consulta o Mercado Pago diretamente.

Na HostGator compartilhada, o intervalo mínimo documentado é de 15 minutos. `bin/cleanup-gift-drafts.php` usa lock não bloqueante em `storage/cache/locks/gifts-cleanup.lock`, evitando sobreposição entre reconciliação, publicação e limpeza. A primeira homologação deve manter pagamentos e webhook desabilitados; consulte `docs/HOSTGATOR_DEPLOYMENT.md`.

## Configuração sandbox

Variáveis: `PAYMENTS_ENABLED`, `PAYMENTS_PROVIDER`, `PAYMENTS_ENVIRONMENT`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `PAYMENTS_PIX_EXPIRATION_MINUTES`, preços em centavos e limites de reconciliação/rate limit. O Access Token é usado somente no backend. Cadastre a URL HTTPS do webhook no painel do Mercado Pago para o tópico de orders.

Sem credenciais configuradas, `GET /api/payments/catalog` informa `available=false` e nenhuma cobrança é criada. Testes automatizados usam gateway e HTTP falsos. Uma integração sandbox real somente deve ser executada quando credenciais de teste forem fornecidas conscientemente; jamais faz parte da suíte padrão.

O cenário oficial de teste Pix da Orders API é isolado do catálogo comercial: usa `total_amount=50.00`, `payer.email=test_payer@example.com` e `payer.first_name=APRO`. Ele valida `POST /v1/orders`, consulta posterior por `GET /v1/orders/{id}` e a transição simulada, mas não cria um pedido comercial do Christmas Tree nem altera os preços de R$ 1,99, R$ 3,99 e R$ 5,99. A criação exige `Authorization: Bearer ...` e `X-Idempotency-Key`; o token e os dados Pix retornados nunca devem ser registrados.

Para receber uma notificação real, cadastre no painel um endpoint HTTPS isolado para o evento de order. `localhost` não é alcançável pelo Mercado Pago. Receber um webhook no painel continua sendo uma validação manual separada da suíte local.

### HTTPS temporário para teste local

Antes de qualquer exposição, execute `composer payments:status`. O comando informa apenas o estado sanitizado da configuração e da conexão local; nunca imprime Access Token, segredo HMAC, senha ou payload Pix. O catálogo deve continuar indisponível enquanto `MERCADOPAGO_WEBHOOK_SECRET` estiver ausente.

Para um teste temporário, a opção recomendada é um **Cloudflare Quick Tunnel apontado para o ingresso PHP dedicado**, e não para a aplicação completa. Inicie primeiro, em um terminal separado:

```powershell
php -S 127.0.0.1:8011 bin/webhook-only-router.php
```

Esse processo aceita somente `POST /api/payments/webhook/mercadopago`; qualquer outro caminho recebe 404 e outros métodos recebem 405. Após autorização explícita para expor o endpoint e com `cloudflared` instalado, inicie:

```powershell
cloudflared tunnel --url http://127.0.0.1:8011
```

O comando gera uma URL efêmera no formato `https://<subdomínio-aleatório>.trycloudflare.com`. Cadastre no modo **Teste** da aplicação Mercado Pago somente:

```text
https://<subdomínio-aleatório>.trycloudflare.com/api/payments/webhook/mercadopago
```

O subdomínio real só existe depois que o túnel é iniciado; nunca invente nem reutilize uma URL de execução anterior. Quick Tunnels são apenas para desenvolvimento e qualquer pessoa que conheça a URL pode alcançar o ingresso, por isso a restrição local de rota e a validação HMAC continuam obrigatórias. Não use autenticação interativa por e-mail nesse endpoint: o emissor servidor-a-servidor não conseguiria concluí-la.

Para encerrar, pressione `Ctrl+C` primeiro no terminal do `cloudflared` e depois no terminal PHP. Confirme que ambos os processos terminaram; a URL `trycloudflare.com` deixa de funcionar. Não deixe o túnel em execução fora da janela de teste.

O segredo deve ser copiado da **Configuração de Webhooks** da aplicação `arvore_natal_pix` no modo Teste e salvo apenas como `MERCADOPAGO_WEBHOOK_SECRET` no `.env` local. Não envie o valor por chat, não o inclua na URL e não o versione. No painel, selecione o evento de Orders. A tela de monitoramento permite conferir status HTTP, tempo de resposta e reenvio sem revelar a credencial.

Uma entrega HTTPS bem-sucedida comprova transporte e assinatura; ela não comprova pagamento. A confirmação financeira continua dependendo da consulta autenticada `GET /v1/orders/{id}`, da correspondência de order/referência/valor/ambiente e do estado `processed / accredited`. Notificações pendentes, desconhecidas ou repetidas não publicam presentes.

## Limitações da etapa

- A publicação automática depende de confirmação oficial e pode permanecer temporariamente em `paid` quando houver falha operacional; o cron retoma a tentativa.
- Não há abertura de presentes, cartão, boleto, reembolso iniciado pelo aplicativo ou painel financeiro.
- A Orders API brasileira não devolve um campo de moeda na consulta documentada; a integração exige `country_code=BRA` e normaliza a moeda contratada para `BRL`.
- Se a conexão cair antes de o provedor devolver o ID da order, o pedido local permanece `pending` e protegido. A mesma solicitação deve ser repetida com o mesmo e-mail; a chave idempotente do provedor recupera a cobrança sem duplicá-la. Sem ID oficial não há consulta segura por cron, portanto o arquivo não é apagado automaticamente.
- A ativação comercial exige revisão jurídica/fiscal, credenciais de produção, HTTPS e teste manual do webhook no painel do provedor.

## Entrada premium na Etapa 08A

`VITE_ENABLE_GIFT_PREVIEW=true` expõe a personalização, mas não habilita pagamentos. Para sandbox são necessários `PAYMENTS_ENABLED=true`, `PAYMENTS_ENVIRONMENT=sandbox`, `PAYMENTS_PROVIDER=mercadopago`, `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`. Produção exige adicionalmente `APP_ENV=production`, HTTPS e `PAYMENTS_ALLOW_PRODUCTION=true`; esta etapa não ativa esses valores. Catálogo indisponível não cria cobrança, não simula aprovação e não publica presente.

Referências oficiais consultadas em 23/11/2026:

- [Pix no Checkout Transparente via Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix)
- [Teste oficial Pix da Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
- [Notificações de orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications)
- [Criar order](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/create-order/post)
- [Consultar order](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/get-order/get)
- [Estados de order](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status)
