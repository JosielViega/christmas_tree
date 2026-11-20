# Armazenamento privado de presentes

## Exposição após publicação

Os PNG 512×512 continuam em `storage/private/gift-textures`; o diretório jamais é copiado para `public/` ou para o mirror. Somente `GET /api/gifts/{public_id}/texture` pode ler um arquivo, e apenas para presente publicado, visível e financeiramente válido. O arquivo é resolvido pelo caminho lógico restrito `YYYY/MM/<40-hex>.png`, limitado pelo tamanho configurado e comparado ao SHA-256 persistido. O cache curto com revalidação permite que moderação e reembolso revoguem o acesso.

## Fluxo da Etapa 07B.2

O navegador decodifica a fotografia original e produz um único canvas final de 512×512. Apenas esse canvas é codificado como PNG e enviado; a fotografia original não faz parte do `FormData`, do banco ou dos logs.

O PHP confere limite do corpo, erro de upload, assinatura PNG, MIME real via `fileinfo`, decodificação e dimensões. O GD copia os pixels para uma imagem nova e gera outro PNG, removendo metadados e qualquer conteúdo não interpretado. O arquivo recebe 160 bits de nome aleatório e fica em `storage/private/gift-textures/YYYY/MM`, fora de `public/`. O banco guarda somente o caminho lógico.

## Acesso e privacidade

O ID público de 128 bits identifica o rascunho, mas não autoriza consulta. A criação devolve um segredo de 256 bits; somente seu SHA-256 é persistido. Consulta e cancelamento exigem `X-Gift-Draft-Token`, nunca query string. Respostas privadas usam `Cache-Control: private, no-store` e não incluem mensagem, caminho ou textura.

A mensagem permanece privada e não participa das APIs públicas da árvore. A pessoa deve confirmar que a fotografia poderá ficar visível após uma futura publicação paga. O pagamento Pix da Etapa 07B.3 pode mudar o rascunho para `paid`, mas não existe rota de publicação nem download da textura.

## Idempotência e compensação

`Idempotency-Key` é único por árvore. O hash do payload normalizado inclui metadados, mensagem, consentimento e hash da textura recebida. Repetição idêntica retorna o rascunho existente; chave reutilizada com conteúdo diferente retorna conflito. Se armazenamento ou banco falhar, o service remove o arquivo recém-criado. Repetições também eliminam a cópia excedente.

## Expiração e cron

Rascunhos expiram em 24 horas por padrão. Execute periodicamente:

```bash
composer gifts:cleanup
```

O lote é configurado por `GIFT_CLEANUP_BATCH_SIZE`. O comando reconcilia primeiro pedidos pendentes e só então transiciona rascunhos elegíveis para `expired`. Pedidos `pending` ou `paid` bloqueiam a remoção; indisponibilidade do provedor conserva o arquivo. Estados `cancelled` e `expired` com arquivo residual são retomados em execuções seguintes. `paid` e `published` nunca são eliminados.

## HostGator

O mirror contém somente `storage/private/.gitkeep`; texturas locais e de produção nunca entram no pacote. No servidor, `storage/private` deve ficar fora do Document Root e ser gravável apenas pelo usuário PHP. Requer PHP 8.2+, `fileinfo`, GD com PNG, PDO MySQL e cron do cPanel. Se o Document Root não puder apontar para `public/`, não habilite o recurso até isolar fisicamente o armazenamento privado.

Presentes publicados futuramente terão consulta própria e serão renderizados separadamente das caixas decorativas de `Presents.tsx`. Eles não contarão como enfeites, não alterarão capacidade nem progressão e não serão ativados por esta etapa.
