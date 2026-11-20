# Roadmap

## Etapa 07B.4 — concluída tecnicamente

- Publicação idempotente e transacional de presentes com pagamento confirmado.
- Posição persistente em layout versionado, galeria paginada e reutilização do `GiftBoxModel`.
- Textura pública via autorização por estado, moderação independente de reembolso e ocultação automática após estorno.
- Abertura animada permanece reservada para a Etapa 07B.5.

## 1. Fundação visual 3D — concluída

Experiência 3D integrada ao backend PHP, com build estático, responsividade, créditos e pacote de produção.

## 2. Árvores individuais — concluída

Identidade persistente, URL pública, criação sem conta, sessão administrativa, recuperação de acesso, API e regras de segurança.

## 3. Enfeites persistentes — concluída

Enfeites sociais persistentes, slots determinísticos, criação idempotente e moderação pelo proprietário. Fotografias permanecem fora do escopo.

## 4. Mensagens secretas — concluída

Mensagens individuais vinculadas aos enfeites, gravação transacional e idempotente, privacidade no backend e revelação exclusiva ao proprietário no Natal.

## 5A. Compartilhamento social — concluída

Links públicos, Web Share API com fallback, cartão local 9:16 para Stories, convite viral pós-participação e Open Graph renderizado no PHP.

## 5B. Vídeos sociais — concluída

Vídeos verticais personalizados de oito segundos, composição local, câmera cinematográfica, progresso, cancelamento, prévia, download, compartilhamento de arquivo e fallback para PNG. Não existe upload nem processamento no servidor.

## 6. Evolução da árvore — concluída

Progressão visual derivada da quantidade de enfeites persistidos, com seis marcos cumulativos, indicador acessível, celebração somente após confirmação do backend e limites explícitos para partículas e presentes. A árvore-base permanece completa em todos os estágios e as capturas sociais reutilizam a cena evoluída.

## 7. Cenário natalino expandido — concluída

Passagem ocasional de Papai Noel e trenó, rastro dourado limitado, estrelas cadentes e iluminação noturna sutil, todos no Canvas existente. Movimento reduzido, captura, gravação e qualidade adaptativa suspendem ou simplificam os efeitos opcionais sem alterar a progressão social.

## 7B.1. Protótipo de embalagens personalizadas — concluída

Prévia experimental de uma fotografia local aplicada como papel de presente 3D, com três estilos e dois modos de composição. Validação, decodificação, Canvas 2D e descarte acontecem no navegador; pagamentos, pedidos, upload, persistência e vínculo com a árvore pública continuam fora do escopo.

## 7B.2. Persistência segura de presentes — concluída

Rascunhos privados associados à árvore, contendo somente a textura final reprocessada, metadados mínimos, mensagem secreta, idempotência, credencial própria, expiração e limpeza em lote. Os estados `paid` e `published` estão reservados, mas não possuem transições ou endpoints públicos. Nada aparece na árvore e nenhum pagamento é simulado.

## 7B.3. Pagamentos Pix — concluída

Catálogo controlado pelo servidor, pedidos imutáveis em centavos, Checkout Transparente Mercado Pago pela Orders API, Pix privado, assinatura HMAC de webhook, confirmação por consulta oficial, reconciliação e limpeza segura. Pagamento confirmado muda o presente somente para `paid`; publicação e abertura permanecem fora do escopo.

## 8. Otimização e lançamento

Medir dispositivos reais, acessibilidade, privacidade, segurança, cache e observabilidade antes da produção.

Fotografias originais persistentes permanecem fora do escopo. A textura final continua privada; publicação pertence a uma etapa futura.
