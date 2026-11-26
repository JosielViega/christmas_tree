# Desempenho 3D e diagnóstico mobile

## Gargalos confirmados por auditoria estrutural

A árvore usa somente dois `InstancedMesh` para a folhagem, portanto o número de draw calls não cresce com cada folha. O custo dominante está na complexidade de cada instância: a folha completa possui 380 triângulos, enquanto o tetraedro interno possui quatro. A distribuição procedural coloca aproximadamente 37,5% das partículas na camada externa. Com 20.000 partículas, isso representa uma estimativa estatística próxima de 2,9 milhões de triângulos da árvore por frame. O perfil modesto anterior mantinha a mesma geometria e 12.000 partículas, aproximadamente 1,7 milhão de triângulos.

Outros custos relevantes encontrados:

- DPR de até 1,75 em telas pequenas de alta densidade;
- antialias do WebGL junto com multisampling 4× do pós-processamento;
- bloom, ambiente refletivo, 3.000 estrelas, neve, espiral transparente e partículas aditivas;
- várias luzes pontuais avaliadas sobre materiais da cena;
- animação contínua e pequenos loops `useFrame`, inclusive nos presentes decorativos.

As Polaroids continuam limitadas a seis, com decodificação progressiva de duas por vez e textura de até 512 px. Isso é coerente com o teste manual em que retirar fotografias não alterou perceptivelmente a fluidez.

## Perfis adaptativos

O perfil inicial usa núcleos lógicos, memória aproximada quando disponível, DPR e carga estimada de pixels. Não usa user-agent, fingerprint, IP ou identificadores persistentes. `PerformanceMonitor` pode degradar um nível imediatamente; a recuperação exige três sinais de melhora e nunca ultrapassa o perfil inicial, evitando oscilações.

| Perfil | Folhas | Partículas da árvore | DPR máximo | Estrelas | Neve | Pós-processamento |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Alto | extrudada, 380 triângulos | 20.000 | 1,75 | 3.000 | 1.200 | bloom e vinheta completos |
| Equilibrado | extrudada reduzida, 92 triângulos | 8.000 | 1,25 | 1.200 | 600 | sem multisampling |
| Econômico | plana, 10 triângulos | 5.000 | 1,0 | 600 | 300 | desligado |

Pela mesma estimativa estatística, a folhagem cai para aproximadamente 296 mil triângulos no perfil equilibrado e 50 mil no econômico. Esses valores são orçamento geométrico, não medições de FPS. Desktop amplo e capaz começa no perfil alto e preserva a apresentação anterior.

## Diagnóstico de desenvolvimento

O painel só existe quando `import.meta.env.DEV` é verdadeiro e a URL contém `?perf=1`. Ele não aparece no build de produção.

Inicie o Vite acessível na rede local, sem expor o servidor à Internet:

```bash
npm --prefix frontend run dev -- --host 0.0.0.0
```

No Android conectado à mesma rede, abra o endereço LAN exibido pelo Vite acrescentando `?perf=1`. O painel informa média e mínimo observado de FPS, frame time médio, p95/p99, draw calls, triângulos, texturas, geometrias, DPR, resolução interna, tempo até interação, memória quando suportada e perdas do contexto WebGL.

Para isolar custos, aguarde 15 segundos após cada mudança e altere um único controle por vez:

1. Compare `high`, `balanced` e `economy`.
2. Desligue somente efeitos.
3. Religue efeitos e desligue somente luzes.
4. Compare enfeites automáticos ligados/desligados.
5. Compare fotografias e presentes ligados/desligados.
6. Compare animações e DPR reduzido.
7. Use **Copiar métricas** após estabilizar cada cenário.

Repetir o roteiro na mesma árvore, orientação e posição da câmera. Fechar outras abas e não misturar resultados de Chrome com Instagram WebView.

## Artefatos pretos

Não foi identificada evidência suficiente para atribuir os retângulos a uma textura específica. Sprites da neve, espiral e estrela usam transparência com `depthWrite=false`, e as fotografias usam material opaco com fallback individual. O painel permite desligar os grupos sem apagar dados e correlacionar o artefato. Registrar captura, perfil ativo e estado dos controles antes de alterar materiais; não esconder Polaroids ou presentes sem reprodução conclusiva.

## Limitações

- FPS real depende do aparelho, driver, temperatura, bateria e WebView.
- `deviceMemory` e heap JavaScript não existem em todos os navegadores.
- Draw calls e triângulos vêm de `WebGLRenderer.info` e representam o frame anterior.
- Gravação vertical e captura preservam a resolução necessária e podem elevar temporariamente o custo.
- Chrome Android e Instagram WebView precisam de validação física separada.
