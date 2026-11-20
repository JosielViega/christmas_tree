# Créditos open-source

## Lumière Christmas Tree

- projeto: Lumière Christmas Tree;
- autoria: gracetyy e colaboradores;
- repositório: <https://github.com/gracetyy/christmas-tree>;
- revisão integrada como referência: `ba79260eb1f7c5344724e2c82e56db1304c5bbe5`;
- licença: MIT, preservada em `frontend/LICENSE`;
- componentes reutilizados: `App`, `Scene`, `TreeMesh`, `SpiralDecor`, `Star`, `Snow`, `Presents`, `Polaroid`, `Overlay`, hooks de áudio/gravação/interação, utilitários matemáticos e tipos.

Adaptações da Etapa 01: saída Vite para o `public/` PHP, manifesto de assets, Tailwind compilado localmente, URLs de assets compatíveis com `/assets/app/`, iluminação procedural local e desativação das integrações externas não necessárias.

Os componentes de Instagram e MediaPipe permanecem no código-fonte para referência, mas não participam do bundle executado. Vercel Analytics foi removido.

## Great Vibes

- fonte: Great Vibes Regular;
- designer: Robert Leuschke; copyright atribuído aos autores do Great Vibes Pro Project;
- origem: <https://github.com/googlefonts/great-vibes>;
- licença: SIL Open Font License 1.1;
- aviso completo: `frontend/public/fonts/OFL.txt`.

## Música

- faixa: “Jingle Bells”;
- autor da gravação: Kevin MacLeod;
- origem: <https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100187>;
- ISRC: `USUAN1100187`;
- licença: Creative Commons Attribution 4.0 International;
- licença: <https://creativecommons.org/licenses/by/4.0/>.

A atribuição também aparece em `/credits`, pois o mirror de produção não inclui a pasta `docs/`.

## Bibliotecas JavaScript

As dependências e versões exatas estão em `frontend/package-lock.json`. As principais são React, React DOM, Three.js, React Three Fiber, Drei, React Three Postprocessing, Postprocessing, Lucide React, Vite, TypeScript e Tailwind CSS. Cada pacote conserva a licença publicada pelo respectivo autor dentro de `node_modules` durante o desenvolvimento; `node_modules` não é enviado à produção.

## Referências estudadas na Etapa 07

### Christmas Countdown

- projeto: Christmas Countdown, de ZeX/ddosnotification;
- repositório: <https://github.com/ddosnotification/christmas-countdown>;
- revisão estudada: `f943e2f1d4d62eb19bf44e313ac773e4f9ae9368`;
- licença do código: MIT;
- referência conceitual: aparição aleatória, percurso lateral e flutuação do trenó.

O projeto usa GSAP e elementos HTML/CSS. Nenhum código, asset ou dependência foi copiado; o agendamento e a animação desta aplicação foram implementados originalmente com o `useFrame` e as primitivas Three.js já presentes.

### Celestial Snowfall

- projeto: Celestial Snowfall, de PhilWilky;
- repositório: <https://github.com/PhilWilky/celestial-snowfall>;
- revisão estudada: `a132ba3aa62dc5276236217d191b3218c18a010a`;
- licença do código: MIT;
- referência conceitual: intervalos aleatórios, trajetória curta, pausa e movimento reduzido para estrelas cadentes.

Nenhum código ou asset foi copiado. A implementação final usa um único agendador TypeScript e geometria local integrada à cena React Three Fiber.

### Christmas Scene

- projeto: 3D Christmas Scene, de Kaaviya-S-S;
- repositório: <https://github.com/Kaaviya-S-S/Christmas-Scene>;
- revisão estudada: `4f58b8512f845a9c8effcaf59c117e4cbfed133a`;
- licença: o README declara MIT, mas a revisão estudada não oferece arquivo de licença nem licença individual clara para os modelos GLTF;
- referência conceitual: composição modular de trenó e Papai Noel em uma cena Three.js.

Por essa incerteza de proveniência, nenhum modelo, textura, áudio, asset ou trecho desse projeto foi incorporado. Papai Noel, trenó e renas desta aplicação são formas procedurais originais.

## Ressalvas

- fotografias carregadas pelo usuário ficam somente na sessão do navegador nesta etapa; o usuário é responsável por possuir direito de uso;
- não foi incorporado conteúdo do Instagram;
- os GIFs de demonstração do repositório original não foram redistribuídos;
- não há modelos 3D externos: árvore, presentes, enfeites, texturas e neve são gerados por código;
- qualquer novo asset deve entrar acompanhado de origem, autoria e licença verificáveis.
