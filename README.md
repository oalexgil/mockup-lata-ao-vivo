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
- Modelo `efficientdet_lite0.tflite` do storage público do Google

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
4. Se a detecção errar ou oscilar, **arraste direto na imagem**. Isso alterna para o modo manual sozinho. Roda do mouse ou pinça redimensiona.

Ajuste nesta ordem, que economiza tempo:

| Controle | Para que serve |
|---|---|
| Largura, Altura | Encaixar o cilindro no contorno da lata real |
| Giro | Posicionar o elemento principal da arte de frente |
| Ganho de luz | Compensar o quanto a lata original é clara ou escura |
| Intensidade | Suavizar o efeito, se necessário |

5. Fechado o enquadramento, use **Congelar imagem** para conferir sem tremida e depois **Salvar PNG**.

### Os dois modos de composição

**Rótulo colado** é o padrão e o que produz resultado realista. A arte é multiplicada pela luminância do frame, então herda sombra, brilho especular e curvatura da lata física. Áreas brancas da arte ficam transparentes — não é bug, é a consequência correta da multiplicação: tinta branca sobre alumínio mostra o brilho do metal.

**Lata 3D** renderiza a lata inteira com iluminação própria, corpo prateado incluído. Use quando não há lata física no quadro, ou quando quiser um render limpo sobre um fundo qualquer.

### Modo foto

O botão **Foto** troca a fonte de vídeo por uma imagem. O tracking é desativado e o posicionamento vira manual.

Este é o fluxo mais comercial dos três: o cliente manda uma foto do produto dele e você devolve a arte aplicada no produto real, em vez de num mockup genérico de banco de imagens. Custa uma fração do esforço da versão ao vivo e entrega a maior parte do valor.

---

## Como funciona

### Detecção

O modelo é o EfficientDet-Lite treinado em COCO, que **não tem a classe "lata"**. O código aceita `bottle`, `cup`, `wine glass` e `vase`, e descarta qualquer caixa mais larga que alta. Funciona na maioria das latas e garrafas em pé.

A caixa detectada passa por suavização exponencial antes de virar posição e escala do cilindro, senão o tremor da detecção passa direto para o render.

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
const CLASSES = new Set(['bottle','cup','wine glass','vase','can']);
```
Classes aceitas na detecção. Se treinar um modelo próprio, troque aqui.

```js
scoreThreshold:0.28, maxResults:8
```
Confiança mínima. Abaixe para detectar mais, ao custo de falsos positivos.

```js
const k = S.mode==='auto' ? 0.22 : 1;
```
Suavização da caixa. Valores menores estabilizam mais e respondem mais devagar.

---

## Problemas comuns

**A câmera não abre.** Você abriu por `file://`. Sirva por `localhost` ou publique em HTTPS.

**Nunca detecta a lata.** COCO não tem a classe e latas baixas e largas falham no filtro de proporção. Use o modo manual, ou treine um detector próprio com o [MediaPipe Model Maker](https://ai.google.dev/edge/mediapipe/solutions/customization/object_detector).

**O rótulo fica escuro demais.** Aumente o ganho de luz. Lata escura ou pouca iluminação puxam o resultado para baixo.

**O rótulo fica lavado.** Reduza o ganho de luz, ou reduza a intensidade.

**Costura visível ao girar.** As bordas da arte não emendam. Corrija no arquivo de origem.

**Trava ou fica lento no celular.** O delegate de GPU do MediaPipe pode não estar disponível. Use o modo manual, que dispensa o detector por completo.

---

## Limitações conhecidas

**Classe inexistente.** A detecção depende de o COCO confundir lata com garrafa ou copo. Funciona na prática, mas não é robusto. Detector customizado resolve com folga.

**Sem rotação real.** A caixa delimitadora não informa o ângulo de rotação da lata em torno do próprio eixo. O giro é controlado à mão. Estimar isso exigiria pose 6DoF ou correspondência de features na embalagem existente.

**Superfície lisa.** Lata sem rótulo, branca ou espelhada não oferece pontos de interesse. A detecção ainda acha o objeto, mas o encaixe fica menos preciso.

**Aparelhos antigos.** Sem delegate de GPU o quadro cai bastante. Testar em aparelho de entrada antes de prometer qualquer coisa a cliente.

## Próximos passos

- Detector customizado de lata via MediaPipe Model Maker
- Rastreamento por imagem com MindAR quando a embalagem já tem estampa, o que dá pose completa
- Suporte a outras formas: garrafa, caixa, pote
- Empacotar como widget embutível por `<script>`, para o lojista colar no próprio site

## Licença

MIT. Veja [LICENSE](LICENSE).
