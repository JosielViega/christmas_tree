# Testes e checklist de estabilização

## Automação

- `composer check`
- `npm --prefix frontend test`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit`
- `composer deploy:hostgator`
- `git diff --check`

Os testes cobrem proprietário/visitante, restauração persistente, link na mesma origem, autodecoração, layout mobile em duas linhas, ausência de rolagem horizontal, projeção 9:16, órbita monotônica de 360°, enquadramento em todos os frames, restauração da exposição, iluminação temporária, layouts de presentes, gates Pix, efeitos, movimento reduzido, PNG e vídeo.

## Checklist manual obrigatório

- [ ] 320, 360, 390, 430, 446 e 768 px: título, menu, indicadores e duas linhas de ações sem sobreposição ou rolagem horizontal.
- [ ] Android Chrome e iPhone Safari: áreas seguras, rolagem dos modais e botões de toque.
- [ ] Navegadores internos de Instagram e WhatsApp: abrir link, copiar/compartilhar e retornar à árvore.
- [ ] Mesmo navegador/origem: proprietário reconhecido; autodecoração recusada.
- [ ] Sessão PHP expirada com cookie persistente: proprietário restaurado.
- [ ] Visitante legítimo: decoração de árvore alheia permitida.
- [ ] Vídeo vertical: estrela, galhos e presentes visíveis por toda a órbita; volta completa, frente estável no último segundo, iluminação adequada e câmera restaurada.
- [ ] Movimento reduzido: vídeo frontal estático com a cena completa.
- [ ] Avisos: dispensáveis, acima das ações inferiores e ausentes enquanto um modal está aberto.
- [ ] Premium indisponível: rótulo “Em breve” visível antes do toque, sem checkout, pedido, pagamento ou publicação.
- [ ] Presente premium: entrada clara, aura discreta, toque e ausência de colisões perceptíveis.
- [ ] Pagamento indisponível: mensagem clara, sem QR, cobrança ou publicação.
- [ ] Menu de desenvolvimento: testar trenó e estrela cadente; confirmar ausência em build de produção.
- [ ] Movimento reduzido e dispositivo modesto: efeitos suspensos/reduzidos sem travamentos.

A automação não substitui aprovação estética nem testes físicos em aparelhos reais.
