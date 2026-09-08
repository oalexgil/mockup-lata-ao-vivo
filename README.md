# Mockup ao vivo

Aplica uma arte de rótulo sobre uma lata cilíndrica real, capturada pela câmera, em tempo real. A composição preserva a iluminação da cena, então o rótulo herda sombra, brilho e curvatura do objeto físico em vez de ficar chapado como um adesivo.

Roda inteiramente no navegador. Sem servidor de inferência, sem upload de imagem, sem custo por requisição.

**Demonstração:** `https://SEU-USUARIO.github.io/mockup-lata-ao-vivo/`

## Arquivos

```
.
├── index.html      protótipo completo, arquivo único
├── README.md
├── LICENSE         MIT
├── .gitignore
└── .nojekyll       impede o Jekyll do GitHub Pages de processar os arquivos
```

Tudo está em `index.html`: marcação, estilo e lógica. Não há build, bundler nem `npm install`. As dependências vêm de CDN:

- [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) 0.10.14 — detecção de objetos
- [`three`](https://threejs.org/) r128 — renderização do cilindro
- Modelo `efficientdet_lite2.tflite` do storage público do Google, com queda automática para o `lite0` se o carregamento falhar

---

## Subindo no GitHub

**1. Crie o repositório.** Em github.com, botão **New**. Nome `mockup-lata-ao-vivo`, visibilidade pública (o GitHub Pages gratuito exige repositório público). Não marque nenhuma opção de inicialização — nem README, nem .gitignore, nem licença, já estão aqui.

**2. Suba os arquivos.** No terminal, dentro desta pasta:

```bash
git init
git add .
git commit -m "Mockup ao vivo de rótulo em lata cilíndrica"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/mockup-lata-ao-vivo.git
git push -u origin main
```

Troque `SEU-USUARIO` pelo seu usuário. Se o GitHub pedir senha, ele quer um **personal access token**, não a senha da conta: Settings → Developer settings → Tokens (classic) → Generate new token, escopo `repo`.

**3. Ative o GitHub Pages.** No repositório: **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**. Branch `main`, pasta `/ (root)`. Salve.

**4. Aguarde um ou dois minutos.** O endereço aparece no topo da mesma página: `https://SEU-USUARIO.github.io/mockup-lata-ao-vivo/`.

**5. Atualize o link** da seção *Demonstração* deste README com o endereço real.

Para publicar mudanças depois: `git add . && git commit -m "ajuste" && git push`. O Pages republica sozinho.

---

## Testando

### A regra que governa tudo

A API de câmera do navegador só funciona em **contexto seguro**:

| Origem | Câmera funciona |
|---|---|
| `file:///Users/voce/index.html` | não |
| `http://localhost:8000` | sim |
| `http://192.168.0.15:8000` | não |
| `https://qualquer-dominio` | sim |

Abrir o arquivo com duplo clique **não funciona** — a permissão nunca chega a ser pedida. `localhost` é a única exceção sem HTTPS prevista na especificação.

### No computador

```bash
cd mockup-lata-ao-vivo
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Chrome dá o melhor resultado por causa do delegate de GPU do MediaPipe. Safari 17+ e Edge também funcionam.

A webcam frontal do notebook serve: é só segurar a lata na frente dela.

### No celular

Depois de publicar no GitHub Pages, basta abrir a URL — já é HTTPS. A câmera traseira é usada por padrão, que é onde este protótipo rende mais.

Se quiser testar **antes** de publicar, exponha o servidor local por túnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

Ele devolve uma URL `https://algo.trycloudflare.com`. Abra no celular. O computador precisa continuar ligado.

`http://192.168.x.x:8000` não funciona no celular. No Android há o atalho `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, onde se adiciona esse endereço e reinicia o navegador. No iOS não existe equivalente: Safari exige HTTPS real.

---

## Como usar

### Preparando a arte

A imagem envolve os 360° do cilindro, então precisa ser larga e baixa — algo em torno de 1800×600 px. **A borda esquerda tem que emendar na direita**, senão aparece uma costura visível quando a lata gira. PNG ou JPG.

### Preparando a cena

Luz lateral funciona melhor que luz frontal: ela cria o gradiente de sombra na curvatura que a composição vai aproveitar. Fundo contrastante ajuda a detecção.

### Passo a passo

1. Abra a página e permita o acesso à câmera.
2. Clique em **Escolher arte do rótulo** e selecione o arquivo.
3. Aponte para a lata. O selo no canto superior esquerdo mostra o estado: procurando, detectada com o percentual de confiança, ou sem lata no quadro.
4. Assim que travar, o rastreio de bordas assume e o detector para de rodar. O selo passa a mostrar confiança do contorno e a inclinação estimada.
5. Se errar ou oscilar, você tem três saídas, da mais rápida para a mais precisa: **arraste direto na imagem**, clique em **Encaixar nas bordas agora**, ou use **Marcar 4 cantos** e clique nos quatro cantos da lata.

Ajuste nesta ordem, que economiza tempo:

| Controle | Para que serve |
|---|---|
| Largura, Altura | Encaixar o cilindro no contorno da lata real |
| Giro | Posicionar o elemento principal da arte de frente |
| Ganho de luz | Compensar o quanto a lata original é clara ou escura |
| Intensidade | Suavizar o efeito, se necessário |

6. Fechado o enquadramento, use **Congelar imagem** para conferir sem tremida e depois **Salvar PNG**.

### Os dois modos de composição

**Rótulo colado** é o padrão e o que produz resultado realista. A arte é multiplicada pela luminância do frame, então herda sombra, brilho especular e curvatura da lata física. Áreas brancas da arte ficam transparentes — não é bug, é a consequência correta da multiplicação: tinta branca sobre alumínio mostra o brilho do metal.

**Lata 3D** renderiza a lata inteira com iluminação própria, corpo prateado incluído. Use quando não há lata física no quadro, ou quando quiser um render limpo sobre um fundo qualquer.

### Modo foto

O botão **Foto** troca a fonte de vídeo por uma imagem. O tracking é desativado e o posicionamento vira manual.

Este é o fluxo mais comercial dos três: o cliente manda uma foto do produto dele e você devolve a arte aplicada no produto real, em vez de num mockup genérico de banco de imagens. Custa uma fração do esforço da versão ao vivo e entrega a maior parte do valor.

---

## Como funciona

### Detecção e rastreio

São duas etapas separadas, e essa separação é o ponto do projeto.

**Detecção grosseira.** EfficientDet-Lite2 treinado em COCO, que **não tem a classe "lata"**. O código aceita `bottle`, `cup`, `wine glass`, `vase` e `bowl`, descarta caixas mais largas que altas, e pontua cada candidato por uma combinação de confiança, plausibilidade da classe, proporção próxima de 2:1 e proximidade do encaixe anterior. Só precisa acertar uma vez.

**Rastreio por bordas.** Depois que o detector semeia uma região, todo o resto é visão clássica rodando a cada quadro numa janela de 200 px. Para cada linha, o gradiente horizontal mais forte de cada lado marca o contorno da lata; duas retas são ajustadas por mínimos quadrados com descarte iterativo de resíduos altos. Um segundo passe repete a busca numa faixa estreita ao redor das retas, o que rejeita a bagunça do fundo.

Disso saem quatro coisas que a caixa delimitadora não fornece: centro exato, raio exato, **inclinação no plano da imagem** e a extensão vertical real do corpo.

**Elevação da câmera.** No topo da lata, a borda superior forma uma elipse. A distância entre o ponto mais alto no centro e a altura da borda nas laterais é o semi-eixo menor dessa elipse. Como `b = r · sen θ`, um arco-seno devolve o ângulo de elevação da câmera, aplicado direto na inclinação do cilindro. A altura do corpo sai de `h = (projeção − 2r·sen θ) / cos θ`, descontando a saliência das duas elipses.

**Travamento.** Enquanto o contorno tem confiança acima de 45%, o detector para de rodar por completo — economiza processamento e elimina o tremor de reseeding. Se as bordas somem por mais de 0,7 s, ele volta a procurar.

### Composição

O ponto central do projeto. No modo *rótulo colado*, o pipeline faz três passadas em canvas 2D:

1. desenha a arte já renderizada no cilindro pelo three.js;
2. multiplica pelo frame de vídeo convertido em preto e branco;
3. recorta o resultado na silhueta do cilindro, com `destination-in`.

O resultado é `arte × luz real`, mascarado na forma do objeto. É por isso que o rótulo acompanha a curvatura e escurece nas dobras sem nenhum cálculo de iluminação.

No modo *rótulo colado* o material do cilindro é `MeshBasicMaterial`, sem sombreamento próprio — toda a luz vem da cena real. No modo *lata 3D* ele troca para `MeshPhongMaterial` com luzes na cena, porque aí não há objeto físico de onde tirar iluminação.

---

## Ajustes no código

Ficam no `<script type="module">`, perto do topo:

```js
const CLASSES = new Set(['bottle','cup','wine glass','vase','can','bowl']);
```
Classes que ganham bônus na pontuação. Se treinar um modelo próprio, troque aqui.

```js
scoreThreshold:0.14, maxResults:12
```
Confiança mínima do detector. Está baixa de propósito: a pontuação composta e o refinamento filtram depois.

```js
const RW = 200;
```
Largura da janela de refinamento. Aumentar dá subpixel melhor e custa mais processamento.

```js
if(r && r.conf > 0.45)
```
Confiança mínima do contorno para travar. Suba para exigir bordas mais nítidas.

```js
ema(S.fit, r, 0.35)
```
Suavização temporal. Menor estabiliza mais e responde mais devagar.

---

## Problemas comuns

**A câmera não abre.** Você abriu por `file://`. Sirva por `localhost` ou publique em HTTPS.

**Nunca detecta a lata.** COCO não tem a classe e latas baixas e largas falham no filtro de proporção. Use **Marcar 4 cantos**, que dispensa detecção e dá o encaixe mais preciso de todos, ou treine um detector próprio com o [MediaPipe Model Maker](https://ai.google.dev/edge/mediapipe/solutions/customization/object_detector).

**Detecta mas não trava.** As bordas laterais estão fracas — lata clara sobre fundo claro, ou pouca luz. Ligue **Mostrar rastreio** para ver o contorno estimado e mexa na **sensibilidade de borda**: baixe se ele não acha nada, suba se ele está agarrando em listras da própria embalagem.

**O contorno agarra no fundo.** Sensibilidade alta demais ou fundo muito texturizado. Suba a sensibilidade e reposicione contra um fundo mais limpo.

**A inclinação fica errada.** O topo da lata está fora do quadro ou encoberto, então a elipse não é medida. Desligue **inclinação automática** e use o controle de inclinação no ajuste fino.

**O rótulo fica escuro demais.** Aumente o ganho de luz. Lata escura ou pouca iluminação puxam o resultado para baixo.

**O rótulo fica lavado.** Reduza o ganho de luz, ou reduza a intensidade.

**Costura visível ao girar.** As bordas da arte não emendam. Corrija no arquivo de origem.

**Trava ou fica lento no celular.** O delegate de GPU do MediaPipe pode não estar disponível. Use o modo manual, que dispensa o detector por completo.

---

## Limitações conhecidas

**Classe inexistente.** A detecção depende de o COCO confundir lata com garrafa ou copo. Funciona na prática, mas não é robusto. Detector customizado resolve com folga.

**Sem giro em torno do próprio eixo.** O rastreio recupera inclinação e elevação, mas não sabe qual lado da lata está voltado para a câmera. O giro do rótulo continua manual. Resolver isso exige correspondência de features com a estampa existente, o que só funciona se a lata já tiver estampa.

**Contraste com o fundo.** Todo o rastreio depende de a silhueta contrastar com o que está atrás. Lata branca sobre parede branca é o pior caso. Segmentação por modelo resolveria, ao custo de processamento.

**Projeção ortográfica.** A câmera virtual é ortográfica, então a lata não afunila com a distância. Em enquadramento fechado com grande angular a diferença aparece nas bordas.

**Aparelhos antigos.** Sem delegate de GPU o quadro cai bastante. Testar em aparelho de entrada antes de prometer qualquer coisa a cliente.

## Próximos passos

- Detector customizado de lata via MediaPipe Model Maker
- Rastreamento por imagem com MindAR quando a embalagem já tem estampa, o que resolveria também o giro em torno do eixo
- Câmera em perspectiva com distância focal estimada, no lugar da ortográfica
- Suporte a outras formas: garrafa, caixa, pote
- Empacotar como widget embutível por `<script>`, para o lojista colar no próprio site

## Licença

MIT. Veja [LICENSE](LICENSE).
