# Testes e checklist de estabilização

## Automação

- `composer check`
- `npm --prefix frontend test`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit`
- `composer deploy:hostgator`
- `git diff --check`

O mirror deve conter `public/.htaccess`, `bin/migrate.php`, `bin/migrations-status.php`, o lock do cron e `vendor/` sem dependências de desenvolvimento. A validação falha diante de segredo reconhecível, executável PHP inesperado na raiz pública ou arquivo de servidor fora da allowlist.

Os testes cobrem proprietário/visitante, restauração persistente, link na mesma origem, autodecoração, layout mobile em duas linhas, cabeçalho com nomes longos, menu acessível, recolhimento do indicador, ausência de rolagem horizontal, projeção 9:16, órbita monotônica de 360°, enquadramento em todos os frames, escala uniforme do compositor, restauração da exposição, iluminação temporária, decodificação alternativa de fotografias, JPEG/EXIF/PNG/WebP reais, layouts de presentes, gates Pix, efeitos, movimento reduzido, PNG e vídeo.

## Validação de pagamentos Sandbox

Separe os resultados em quatro camadas: gateway falso automatizado, HTTP local com pagamentos desabilitados, comunicação real com o Sandbox e inspeção visual manual. A aprovação das duas primeiras não comprova comunicação com o Mercado Pago.

- Gateway falso + MySQL isolado: validar `draft → pending → paid → published`, replay, árvore correta, textura privada antes da publicação e ocultação após reembolso.
- HTTP local: validar CSRF, token privado, idempotência, cancelamento e `available=false`/HTTP 503 quando credenciais estão ausentes.
- Sandbox oficial: somente com token de teste confirmado; usar o cenário Pix documentado de R$ 50,00 (`test_payer@example.com`, `APRO`) isolado dos produtos comerciais, consultar a order e não registrar token, QR ou Copia e Cola.
- Webhook real: requer endpoint HTTPS temporário e isolado cadastrado no painel para o evento de order; nunca expor automaticamente o servidor local.

## Checklist manual obrigatório

- [ ] 320, 360, 390, 430, 446 e 768 px: título, menu, indicadores e duas linhas de ações sem sobreposição ou rolagem horizontal.
- [ ] 394 × 1036 px: nome longo em até duas linhas; menu completo; indicador recolhido durante a abertura; toque externo e Escape fecham o menu.
- [ ] Android Chrome e iPhone Safari: áreas seguras, rolagem dos modais e botões de toque.
- [ ] Navegadores internos de Instagram e WhatsApp: abrir link, copiar/compartilhar e retornar à árvore.
- [ ] Mesmo navegador/origem: proprietário reconhecido; autodecoração recusada.
- [ ] Sessão PHP expirada com cookie persistente: proprietário restaurado.
- [ ] Visitante legítimo: decoração de árvore alheia permitida.
- [ ] Vídeo vertical: estrela, galhos e presentes visíveis por toda a órbita; volta completa, frente estável no último segundo, iluminação adequada e câmera restaurada.
- [ ] Vídeo reproduzido: proporção natural do início ao fim, sem achatamento; confirmar MP4 e WebM quando disponíveis no aparelho.
- [ ] Movimento reduzido: vídeo frontal estático com a cena completa.
- [ ] Avisos: dispensáveis, acima das ações inferiores e ausentes enquanto um modal está aberto.
- [ ] Premium indisponível: rótulo “Em breve” visível antes do toque, sem checkout, pedido, pagamento ou publicação.
- [ ] Memórias no aparelho: adicionar e substituir uma foto JPEG, PNG ou WebP da câmera/galeria; confirmar orientação, recorte e visualização pública.
- [ ] Presente premium: entrada clara, aura discreta, toque e ausência de colisões perceptíveis.
- [ ] Pagamento indisponível: mensagem clara, sem QR, cobrança ou publicação.
- [ ] Menu de desenvolvimento: testar trenó e estrela cadente; confirmar ausência em build de produção.
- [ ] Movimento reduzido e dispositivo modesto: efeitos suspensos/reduzidos sem travamentos.
- [ ] Abrir a mesma árvore com 0, 1, 3 e 6 memórias; registrar `performance.getEntriesByType('measure')`, tempo até interação e tempo das texturas, sem inferir FPS.
- [ ] Confirmar que a tela mostra preparação, luzes e “Tudo pronto”, sem revelar a cena antes do segundo frame.
- [ ] Simular offline/API lenta e perda de WebGL; confirmar timeout, mensagem segura e botão “Tentar novamente”.
- [ ] Em 320, 360, 390, 430 e 446 px, confirmar loading sem scroll horizontal e respeito às áreas seguras.
- [ ] Com uma foto ausente/corrompida, confirmar fallback somente nessa Polaroid e interação normal com a árvore.
- [ ] Decorar uma árvore, fechar o navegador e retornar: o botão deve informar que a participação já ocorreu.
- [ ] Tocar em “Você já decorou”: conferir mensagem amigável; em outra árvore, conferir que a decoração continua disponível.
- [ ] Excluir o enfeite como proprietário e repetir com o navegador visitante: a API deve manter HTTP 409.
- [ ] Confirmar em HTTPS os atributos `HttpOnly`, `SameSite=Lax`, `Secure` e ausência do token no JSON.
- [ ] Confirmar que duas pessoas com o mesmo nome e cookies diferentes conseguem participar.
- [ ] Com `LIBERAR_MENSAGEM=false`, confirmar HTTP 423 antes do Natal e ausência de texto secreto no navegador.
- [ ] Alternar temporariamente para `LIBERAR_MENSAGEM=true`, recarregar e confirmar mensagens de enfeites e presentes somente como proprietário.
- [ ] Voltar para `LIBERAR_MENSAGEM=false`, retornar à página e confirmar novo bloqueio; conteúdo já visto não é revogável.
- [ ] Abrir uma árvore com enfeites em posições não consecutivas e confirmar Anterior/Próximo, contador baseado apenas nos existentes e retorno circular nas duas direções.
- [ ] Repetir com setas esquerda/direita e Escape; confirmar que campos editáveis, Polaroids e presentes premium não respondem à navegação de enfeites.
- [ ] Em 320–446 px, confirmar alvos de toque, mensagem longa rolável, rodapé estável e ausência de rolagem horizontal.

A automação não substitui aprovação estética nem testes físicos em aparelhos reais.

Os testes de inicialização verificam transições, timeout configurado, sinal de segundo frame, cancelamento, fila de seis imagens com concorrência máxima 2, fallback e cálculo de memória RGBA. Para uma fonte quadrada de 1024 px, o bitmap de distância em 512 px reduz a estimativa base de 4 MiB para 1 MiB por textura; isso não é uma medição de FPS e não inclui mipmaps nem buffers internos do navegador.

Os testes da 08A.5 cobrem emissão/restauração/expiração do cookie, idempotência, visitantes diferentes com o mesmo nome, árvores distintas, exclusão com retenção, migration e integração em MySQL isolado. A suíte de presentes permanece separada para garantir que a identidade anônima não limite compras premium.

Os testes da 08A.4.1 exercitam 1, 3 e 6 fotografias, limite de duas decodificações, conclusão fora de ordem, falhas isoladas, atraso, unmount/remount, troca e reutilização de URL, referências compartilhadas, descarte após a última referência e separação das faces do Polaroid. A validação HTTP local deve confirmar `200`, `image/jpeg`, assinatura JPEG e ausência de redirecionamento sem registrar URLs completas.

Os testes da 08A.4.2 verificam a versão real de `MeshStandardMaterial` na transição tardia de `map`, placeholder→fotografia, substituição, remoção, falha/retry, troca de árvore e conjuntos de 1, 3 e 6 materiais. A integração MySQL isolada persiste três JPEGs, reinicializa serviços como em um reload, consulta novamente a API e valida status, MIME e assinatura de cada imagem.

Os testes da 08A.7 cobrem parsing ausente/falso/verdadeiro/inválido, fronteiras do relógio, override manual, reversibilidade, HTTP 423/200, contagem sem conteúdo, escopo por árvore, cookie persistente, mensagens gratuitas e premium, ausência de mutações financeiras e revalidação frontend ao retornar à página.

Os testes da 08A.8 cobrem listas com 0, 1, 2, 10 e 60 enfeites, ordenação estável, navegação anterior/próximo e circular, contador real, remoções e mudanças dinâmicas, isolamento do teclado, elementos editáveis, reutilização do foco/câmera, movimento reduzido, mensagens por ID e estrutura mobile. A validação visual da trajetória em lados opostos da árvore permanece manual em aparelhos reais.
