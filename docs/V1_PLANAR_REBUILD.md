# Mockup Vision — plano de reconstrução V1

## Norte

Dar um passo atrás de propósito.

A V1 deixa de tentar ser um estúdio universal e passa a resolver um único trabalho com confiabilidade:

> **Cena pronta + arte pronta → superfície → aplicação fiel → exportação.**

Geração de cena continua no código como recurso secundário/experimental. O caminho principal deve funcionar mesmo com todos os provedores de IA desligados.

## Definição de sucesso

Para a V1, "funcionar" significa:

1. o usuário sobe uma cena existente;
2. sobe uma arte;
3. o sistema sugere uma superfície ou permite marcá-la imediatamente;
4. a arte original é aplicada sem ser regenerada;
5. o usuário consegue corrigir a geometria em segundos;
6. exporta em boa resolução.

Nenhuma falha de IA pode impedir esse caminho.

## Escopo suportado

### V1 — oficial
- monitor;
- notebook;
- smartphone;
- pôster/quadro;
- outdoor;
- livro/capa;
- flyer/folha;
- painel frontal de caixa.

Característica comum: superfície planar ou quase planar representável por quatro pontos.

### Experimental
- sacola;
- camiseta;
- tecido;
- caneca;
- lata;
- garrafa;
- superfícies com forte curvatura;
- oclusão complexa.

## Fluxo principal

```text
Nova sessão
  ↓
Subir cena
  ↓
Subir arte
  ↓
[Detectar superfície] ou [Marcar 4 cantos]
  ↓
Preview imediato
  ↓
Ajustar: pontos / fit / margem / opacidade / integração
  ↓
Exportar
```

A interface deve mostrar o caminho manual desde o início. Detecção automática é aceleração, não pré-requisito.

## Princípios técnicos

### 1. Renderer determinístico é soberano
O arquivo de arte não entra em um endpoint generativo para compor o resultado final.

### 2. IA só sugere
Pode:
- classificar a cena;
- sugerir quadrilátero;
- sugerir brilho/contraste/reflexo.

Não pode:
- redesenhar logo;
- regenerar texto;
- alterar composição interna da arte.

### 3. Confidence gating
Se a detecção não atingir confiança mínima:
- não aplicar automaticamente;
- mostrar "Não consegui marcar com segurança";
- abrir o modo de 4 pontos já pronto para uso.

### 4. Manual nunca é fallback vergonhoso
Ele é um modo de precisão.

## Backlog

### P0 — bloquear qualquer lançamento

#### P0.1 — "Duas imagens" como entrada principal
- CTA inicial: "Subir cena" e "Subir arte".
- Não exigir prompt.
- Não exigir geração de cena.
- Não exigir provider.

Aceite:
- em menos de 3 cliques o usuário vê cena + arte carregadas.

#### P0.2 — Modo 4 pontos impecável
- handles grandes;
- zoom;
- drag responsivo;
- reset;
- teclado/esc para cancelar;
- preview em tempo real.

Aceite:
- qualquer superfície planar visível pode ser marcada sem IA.

#### P0.3 — Aplicação planar determinística
- homografia;
- contain / cover / stretch explícitos;
- preservação de alpha;
- margens;
- rotação;
- clipping correto.

Aceite:
- pixels internos da arte não são redesenhados;
- texto e logo permanecem idênticos ao upload, salvo transformação geométrica e blending.

#### P0.4 — Detecção não bloqueante
- timeout curto;
- confidence threshold;
- erro legível;
- botão "Marcar manualmente" sempre visível.

Aceite:
- provider fora do ar não interrompe o trabalho.

#### P0.5 — Export confiável
- PNG e JPEG;
- resolução da cena original quando possível;
- sem reamostragem desnecessária;
- estado de loading e erro.

#### P0.6 — Benchmark real
Criar fixtures redistribuíveis com:
- 5 monitores;
- 5 notebooks;
- 5 pôsteres;
- 5 caixas;
- 5 superfícies diversas.

Medir:
- detecção utilizável sem ajuste;
- detecção utilizável com 1 ajuste;
- tempo até primeira exportação;
- falhas críticas de fidelidade.

### P1 — depois do núcleo

#### P1.1 — Auto-snap de cantos
Sugestão de edges perto do handle manual, sem tomar controle do usuário.

#### P1.2 — Fit inteligente
Recomendar contain/cover e margem segura baseado em aspecto da arte vs superfície.

#### P1.3 — Integração conservadora
- brightness;
- contrast;
- opacity;
- multiply/screen quando aplicável;
- highlight/shadow map simples.

Tudo reversível.

#### P1.4 — Histórico local
- desfazer/refazer;
- versões da aplicação;
- salvar estado em browser.

#### P1.5 — Multi-art somente após single-art estável
- um slot por arte;
- atribuição explícita;
- não tentar resolver distribuição complexa automaticamente até o benchmark single-art estar verde.

### P2 — expansão

- máscaras de oclusão;
- segmentação de superfície dedicada;
- tecidos;
- cilindros;
- geração de cena integrada;
- batch;
- API;
- projetos em nuvem;
- times.

## O que deve sair da UI principal agora

Ocultar atrás de "Experimental" ou remover temporariamente:
- "Finalizar com IA" como etapa obrigatória;
- geração de cena como primeira ação;
- multi-art automático;
- promessas "universal";
- cilindros/3D na home do produto;
- controles avançados antes da primeira aplicação.

## UX sugerida

### Hero
**Aplique sua arte em qualquer cena. Sem redesenhar sua marca.**

Botões:
- **Subir cena**
- "Gerar cena com IA" — secundário / Experimental

### Depois da cena
**Agora envie a arte original.**

### Depois da arte
- "Detectar superfície"
- "Marcar 4 cantos"

### Se a IA falhar
Não mostrar stack trace ou linguagem de backend.

Mostrar:
> Não consegui marcar essa superfície com segurança.
> Marque os quatro cantos — leva alguns segundos.

Botão primário:
**Marcar 4 cantos**

## Métricas de produto

Instrumentar:
- session_started;
- scene_uploaded;
- artwork_uploaded;
- detection_started;
- detection_success;
- detection_low_confidence;
- manual_quad_started;
- manual_quad_completed;
- first_preview_ready;
- export_success;
- export_error.

Métricas principais:
- completion rate;
- time to first preview;
- time to export;
- % automático vs manual;
- correções por sessão;
- exports por usuário;
- retorno D7/D30.

## Gates de qualidade

Antes de chamar de beta público:

- 100% dos fixtures planares exportáveis manualmente;
- nenhum erro de provider bloqueia modo manual;
- 0 falhas de alteração interna da arte pelo renderer;
- >=80% dos fixtures recebem uma sugestão automática aproveitável com no máximo uma correção;
- mediana de primeira exportação < 90s para usuário novo em teste moderado.

Antes de cobrar assinatura:
- evidência de uso recorrente;
- pelo menos 20 clientes pagos no beta;
- feedback de valor ligado a fidelidade/velocidade, não apenas "é legal".

## Sequência de implementação

### Sprint 1 — confiabilidade
P0.1 → P0.5.

### Sprint 2 — prova
P0.6 + telemetria + testes com usuários.

### Sprint 3 — acabamento
P1.1 → P1.4.

### Só então
multi-art, curvas e geração voltam para o centro da conversa.

## Frase de produto

Não:
> Estúdio universal de mockups com IA.

Sim:
> **Transforme qualquer foto em um mockup editável. A IA encontra a superfície; sua arte continua sendo sua arte.**
