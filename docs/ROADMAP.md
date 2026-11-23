# Roadmap

## Etapa 07C.1 — concluída tecnicamente

- Até seis memórias públicas persistentes por árvore, sem Polaroids fictícios em árvores novas.
- Upload exclusivo do proprietário com processamento seguro no navegador e reprocessamento GD no servidor.
- Layout v1 determinístico, legenda Unicode, foco cinematográfico, substituição e remoção com limpeza de arquivos.
- Painel mobile-first “Memórias de 2026”, aviso de visibilidade pública e preservação das capturas PNG/vídeo.
- Armazenamento separado de enfeites e presentes premium, compatível com o mirror HostGator.

## Etapa 07C — concluída tecnicamente

- Reconhecimento persistente por cookie seguro com seletor/verificador, hash no banco, expiração, revogação e restauração da sessão.
- Uma árvore principal por navegador reconhecido, redirecionamento na página inicial e bloqueio de criação duplicada acidental.
- Recuperação preservada com nova credencial persistente e revogação das anteriores.
- Proprietário impedido no frontend e backend de decorar a própria árvore, sem afetar árvores de amigos.
- Interface social mobile-first com menu superior, áreas seguras, foco de objetos e remoção dos controles públicos de demonstração.

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

### 8A. Estabilização visual e funcional — tecnicamente concluída

Origem social consistente, autodecoração bloqueada também após restauração persistente, controles mobile compactos, câmera vertical calculada, exposição temporária, presentes determinísticos, layout premium v2 compatível e diagnóstico local dos efeitos natalinos. Aprovação estética e compatibilidade em aparelhos reais continuam no checklist manual.

### 8A.1. Órbita social e ações mobile — tecnicamente concluída

Órbita determinística de 360° em oito segundos, enquadramento integral por volume 3D, iluminação temporária de captura e composição frontal estável no encerramento. A barra mobile passa a duas linhas sem rolagem horizontal, mantém a ação principal em destaque e sinaliza recursos premium indisponíveis antes da interação.

### 8A.2. Proporção do vídeo e cabeçalho mobile — tecnicamente concluída

Dimensões da captura 9:16 são preservadas durante toda a sessão e frames são compostos com escala uniforme, eliminando deformação por cópia direta. Títulos longos usam tipografia responsiva em duas linhas; menu e indicador deixam de disputar a mesma região, com fechamento externo, Escape e ARIA preservados.

### 8A.3. Compatibilidade do upload de memórias — tecnicamente concluída

Falhas de `createImageBitmap` em fotografias válidas passam ao decoder `Image`, sem relaxar assinatura, formato, dimensões ou tamanho. Testes reais cobrem JPEG, JPEG com EXIF, PNG, WebP e orientações horizontal/vertical; o backend continua reprocessando tudo como JPEG privado sem metadados.

Fotografias originais persistentes permanecem fora do escopo. A textura final continua privada; publicação pertence a uma etapa futura.

### 8A.4. Loading natalino e inicialização progressiva — tecnicamente concluída

Máquina de estados de carregamento, primeiro frame verificado, timeout/recuperação, cancelamento de APIs e instrumentação de desenvolvimento. Polaroids deixam de suspender a cena, passam por fila de decodificação limitada e textura de distância 512 px; geometrias pesadas deixam de ser reconstruídas quando as memórias chegam. Medições de FPS e fluidez em celulares reais permanecem no checklist manual.

### 8A.5. Uma participação gratuita por visitante — tecnicamente concluída

Identidade anônima persistente e separada do proprietário, unicidade transacional por árvore, resposta HTTP 409 específica, reconhecimento no retorno e retenção mínima do marcador após exclusão. Registros históricos não são associados retroativamente e presentes premium permanecem sem limite por identidade.

### 8A.4.1. Fotografias progressivas visíveis — tecnicamente concluída

O cache de texturas passa a validar a identidade da entrada antes de removê-la, centraliza descarte e contagem de referências e vincula o material à URL atual. Remounts, substituições e falhas fora de ordem deixam de remover ou reutilizar texturas incorretas; frente e verso do cartão permanecem separados durante a rotação.
