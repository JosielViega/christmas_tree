# Compartilhamento social

O proprietário abre **Compartilhar minha árvore** para copiar a URL pública, usar o compartilhamento nativo, gerar um cartão PNG ou criar um vídeo vertical. Nenhuma dessas operações envia mídia ao servidor.

## Cartão para Stories

O cartão tem 1080×1920. A aplicação reposiciona temporariamente a câmera da cena existente, captura a árvore em formato vertical e compõe a imagem localmente. O download é PNG. Quando `navigator.canShare()` aceita arquivos, a mesma imagem pode ser enviada ao menu de compartilhamento do sistema.

## Vídeo para Stories e Reels

Selecione **Criar vídeo para Stories**. A aplicação verifica `MediaRecorder` e `HTMLCanvasElement.captureStream()`, prepara a cena vertical e grava por oito segundos. A sequência apresenta o proprietário, executa uma órbita suave e termina com o convite para decorar. Com movimento reduzido ativado no sistema, a câmera permanece estática.

O perfil conservador usa 720×1280, 24 FPS e 4 Mbps. Dispositivos com memória e paralelismo adequados podem usar 1080×1920, 30 FPS e 8 Mbps. Durante a gravação é possível acompanhar o progresso ou cancelar. Depois, a interface oferece prévia, download e compartilhamento de arquivo quando suportado.

## MP4 e WebM

O formato não é escolhido por extensão apenas. A aplicação consulta `MediaRecorder.isTypeSupported()` e tenta somente codecs anunciados pelo navegador. Alguns navegadores produzem MP4/H.264; outros produzem WebM/VP8 ou WebM/VP9. Não existe conversão com FFmpeg ou FFmpeg.wasm. O nome do arquivo acompanha o MIME type realmente produzido.

O Instagram não recebe publicação automática. Salve ou compartilhe o arquivo, publique-o manualmente em Stories/Reels e adicione o adesivo de link usando a URL pública copiada.

## Fallbacks e compatibilidade

Sem `MediaRecorder` ou `captureStream`, a interface explica a limitação e mantém disponíveis o cartão PNG e o link. Sem Web Share de arquivos, o resultado é baixado. Cancelamento, erro de codec, stream vazio e interrupção encerram as tracks e restauram câmera, controles, viewport e DPR.

Compatibilidade e desempenho precisam ser confirmados em dispositivos reais. Gravação 1080p pode consumir memória e GPU consideráveis; por isso a seleção de perfil é conservadora. Navegadores podem ainda recusar um codec anunciado ou impedir compartilhamento de determinado tipo de arquivo.

## Estabilização 08A

O link compartilhado é montado com a origem atual do navegador e o `public_path` validado. Isso mantém os cookies quando o proprietário abre o próprio link na mesma origem. `localhost` e `127.0.0.1` são origens distintas; trocar manualmente entre elas exige recuperação.

O vídeo mantém oito segundos: 0–2 s com árvore, estrela e base completas; 2–5 s com aproximação lateral suave; 5–8 s com enquadramento cinematográfico limitado e convite social. Distância deriva do FOV e do aspecto 9:16. Exposição é elevada apenas durante captura e restaurada ao finalizar, falhar ou cancelar.

## Privacidade

A composição usa somente o nome público do proprietário e a quantidade de participações. Mensagens secretas, códigos de recuperação, tokens administrativos e credenciais nunca fazem parte do canvas, do vídeo ou do compartilhamento. Blobs e URLs de objeto existem apenas na sessão local e são liberados após o uso.
