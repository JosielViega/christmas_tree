# Testes e checklist de estabilização

## Automação

- `composer check`
- `npm --prefix frontend test`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit`
- `composer deploy:hostgator`
- `git diff --check`

Os testes cobrem proprietário/visitante, restauração persistente, link na mesma origem, autodecoração, layout mobile estrutural, projeção 9:16, trajetória, restauração da exposição, layouts de presentes, gates Pix, efeitos, movimento reduzido, PNG e vídeo.

## Checklist manual obrigatório

- [ ] 320, 360, 390, 430, 446 e 768 px: título, menu, indicadores e ações sem sobreposição.
- [ ] Android Chrome e iPhone Safari: áreas seguras, rolagem dos modais e botões de toque.
- [ ] Navegadores internos de Instagram e WhatsApp: abrir link, copiar/compartilhar e retornar à árvore.
- [ ] Mesmo navegador/origem: proprietário reconhecido; autodecoração recusada.
- [ ] Sessão PHP expirada com cookie persistente: proprietário restaurado.
- [ ] Visitante legítimo: decoração de árvore alheia permitida.
- [ ] Vídeo vertical: estrela, galhos e presentes visíveis no início; iluminação adequada; câmera restaurada.
- [ ] Presente premium: entrada clara, aura discreta, toque e ausência de colisões perceptíveis.
- [ ] Pagamento indisponível: mensagem clara, sem QR, cobrança ou publicação.
- [ ] Menu de desenvolvimento: testar trenó e estrela cadente; confirmar ausência em build de produção.
- [ ] Movimento reduzido e dispositivo modesto: efeitos suspensos/reduzidos sem travamentos.

A automação não substitui aprovação estética nem testes físicos em aparelhos reais.
