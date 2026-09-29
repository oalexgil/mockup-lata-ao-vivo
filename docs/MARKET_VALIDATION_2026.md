# Mockup Vision — leitura de mercado e tese de produto (set/2026)

## Resumo

O mercado existe, mas o espaço **não é "mais um gerador de mockups com IA"**.

A categoria já está comprimida por três frentes:

1. editores generalistas com mockups gratuitos e IA;
2. bibliotecas tradicionais de templates com preços baixos;
3. chatbots multimodais capazes de receber uma cena + uma arte e produzir uma edição por linguagem natural.

A oportunidade do Mockup Vision é mais estreita e mais defensável:

> **Use qualquer foto como mockup e aplique a arte original sem pedir à IA para redesenhá-la.**

O diferencial não deve ser "gerar imagem melhor que ChatGPT/Canva". Deve ser **fidelidade determinística + correção rápida + fluxo especializado**.

## Concorrência observada

### ChatGPT Images
- cria e edita imagens existentes;
- aceita múltiplas imagens de referência;
- edição é conversacional;
- a própria documentação da OpenAI observa que seleção/máscara é uma orientação e pode não ser seguida exatamente.

Implicação: o usuário já pode chegar perto do caso "imagem 1 = cena, imagem 2 = arte". Isso destrói a tese de vender apenas conveniência generativa.

Fontes:
- https://help.openai.com/en/articles/11084440-images-in-chatgpt
- https://openai.com/academy/image-generation/
- https://developers.openai.com/api/docs/guides/image-generation

### Canva Mockups
- oferece mockups gratuitamente;
- informa suporte a até 2.500 usos de mockup no plano Free;
- afirma analisar fotos para identificar superfícies adequadas e transformá-las em mockups;
- Canva Pro custa R$35/mês no Brasil e inclui muitas outras ferramentas.

Implicação: "detectar superfície em foto + aplicar design" já existe em uma suíte extremamente distribuída. Não faz sentido competir por amplitude.

Fontes:
- https://www.canva.com/pt_br/mockups/
- https://www.canva.com/mockups/
- https://www.canva.com/pt_br/precos/

### Placeit
- biblioteca ampla de mockups;
- assinatura anunciada a partir de aproximadamente US$7,47/mês;
- forte em template pronto e velocidade.

Fonte:
- https://br-failover.placeit.net/pricing/

### Mediamodifier
- plano Pro anunciado em US$19/mês;
- 10.000+ templates;
- permite upload de PSD próprio;
- API de mockups parte de US$499/mês.

Fontes:
- https://mediamodifier.com/pricing
- https://mediamodifier.com/faq

### Dynamic Mockups
- API orientada a automação e volume;
- plano Pro a partir de US$15/mês;
- 50 créditos gratuitos e batch rendering.

Fonte:
- https://dynamicmockups.com/mockup-generator-api/

### Pacdora
- mais de 5.000 mockups 3D editáveis em catálogo.

Fonte:
- https://www.pacdora.com/pt/3d-mockup-world

## O que o mercado diz informalmente

Discussões de designers e vendedores mostram duas dores recorrentes:

- cansar de procurar um template que "quase serve";
- querer personalização maior sem pagar por cada PSD;
- ainda valorizar mockups determinísticos/realistas quando a IA muda demais o resultado;
- querer o fluxo "drop in place" em vez de Photoshop manual.

Exemplos:
- https://www.reddit.com/r/graphic_design/comments/1nv78gh/am_i_the_only_one_that_doesnt_like_using_mockups/
- https://www.reddit.com/r/graphic_design/comments/1p9v7l0/where_do_you_get_your_mockups/
- https://www.reddit.com/r/canva/comments/1fg5xqw/digital_print_mockups_help/
- https://www.reddit.com/r/printondemand/comments/1p5qqjr/opinions_about_placeit/

Essas conversas são sinais qualitativos, não tamanho de mercado.

## Espaço defensável

### Não competir aqui
- biblioteca com milhares de templates;
- gerador de imagem genérico;
- editor completo;
- 3D universal;
- "faça qualquer mockup com uma frase".

### Competir aqui
1. **Cena do usuário**
   - foto própria;
   - render próprio;
   - cena criada no ChatGPT/Gemini/Firefly;
   - template comprado.

2. **Arte original imutável**
   - arquivo do usuário é o source of truth;
   - texto, logo, cores e composição não são regenerados.

3. **Detecção como sugestão**
   - IA sugere o quadrilátero;
   - baixa confiança não bloqueia o fluxo;
   - usuário corrige em quatro pontos.

4. **Aplicação determinística**
   - perspectiva/homografia no navegador;
   - fit/contain/cover;
   - opacidade/luz/reflexo conservadores.

5. **Tempo até resultado**
   - upload cena;
   - upload arte;
   - detectar/corrigir;
   - exportar.

## Proposta de valor recomendada

### Headline
**Sua cena. Sua arte. Exatamente como você criou.**

### Subheadline
Transforme qualquer foto em um mockup editável. O Mockup Vision usa IA para encontrar a superfície — e geometria determinística para aplicar o arquivo original sem redesenhar logo, texto ou tipografia.

### Categoria
Não chamar de "gerador de mockup com IA" como definição principal.

Usar:
- mockup fidelity tool;
- smart artwork placement;
- custom-photo mockup editor;
- em português: **aplicador inteligente de arte em mockups**.

## Rentabilidade

A tese pode ser rentável porque o motor principal pode rodar localmente no navegador e a IA pode ficar restrita a detecção/assistência.

Cloudflare Workers AI lista o FLUX.1 Schnell com custo muito baixo por tile/step, além de franquia diária gratuita de Workers AI. Isso reduz o risco de custo de geração ser o principal gargalo.

Fonte:
- https://developers.cloudflare.com/workers-ai/platform/pricing/

O gargalo econômico tende a ser:
- aquisição de usuários;
- suporte;
- taxa de retorno;
- percepção de valor frente a Canva/ChatGPT;
- manutenção de detecção em diferentes tipos de cena.

### Faixa de preço sugerida para validação

Não começar tentando cobrar mais que Canva Pro por um produto estreito.

**Fase beta paga**
- R$49–79 uma vez;
- limite por número de vagas;
- objetivo: testar disposição real de pagamento, não maximizar receita.

**Após evidência de uso recorrente**
- Free: aplicação manual + exportação limitada;
- Pro: R$19,90–29,90/mês;
- anual opcional;
- geração de cena/IA avançada como créditos ou limite separado.

Stripe Brasil anuncia 3,99% + R$0,39 por transação em cartões nacionais. Em R$24,90/mês, isso deixa cerca de R$23,52 antes de impostos, reembolsos, infraestrutura e suporte.

Fonte:
- https://stripe.com/br/pricing

### Exemplo de escala bruta do plano R$24,90

Antes de impostos e demais custos, após apenas a tarifa padrão de cartão informada acima:

- 100 assinantes: ~R$2.352/mês;
- 300 assinantes: ~R$7.055/mês;
- 1.000 assinantes: ~R$23.517/mês.

Esses números são cenários matemáticos, não previsão de vendas.

## Critérios de decisão

### Continuar investindo
Durante beta, buscar:
- 20 compradores pagos;
- pelo menos 60% completando o fluxo sem ajuda;
- ao menos 30% dos compradores usando em 3+ sessões no primeiro mês;
- 80%+ dos casos suportados exigindo no máximo uma correção de geometria;
- zero alteração de texto/logo causada pelo renderer determinístico.

### Reposicionar ou parar
Se após tráfego direcionado e testes reais:
- usuários preferirem consistentemente ChatGPT/Canva mesmo quando a fidelidade falha;
- a correção manual for percebida como mais trabalhosa que Photoshop/Canva;
- uso recorrente for baixo;
- ninguém pagar nem o beta de R$49.

## Conclusão operacional

O Mockup Vision não deve tentar vencer a IA generativa.

Ele deve **usar IA onde ela é boa — percepção e sugestão — e removê-la da etapa onde ela é fraca para branding: reproduzir pixels exatos.**

A tese comercial a validar é:

> designers pagariam por um fluxo de 20–60 segundos que transforma qualquer cena em mockup, preservando a arte original e oferecendo correção manual imediata quando a detecção erra.
