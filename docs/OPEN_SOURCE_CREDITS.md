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

## Ressalvas

- fotografias carregadas pelo usuário ficam somente na sessão do navegador nesta etapa; o usuário é responsável por possuir direito de uso;
- não foi incorporado conteúdo do Instagram;
- os GIFs de demonstração do repositório original não foram redistribuídos;
- não há modelos 3D externos: árvore, presentes, enfeites, texturas e neve são gerados por código;
- qualquer novo asset deve entrar acompanhado de origem, autoria e licença verificáveis.
