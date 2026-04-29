# Sesión 00.2 — Recursos complementarios

Material opcional para profundizar. **Recomendación:** los 2 primeros (3Blue1Brown sobre Transformers y atención) son los que más vale la pena ver, en ese orden.

---

## Visualizaciones imprescindibles (sin matemáticas)

- **3Blue1Brown — _But what is a GPT? Visual intro to transformers_** (~25 min, YouTube). La explicación visual definitiva del Transformer. Si solo vas a ver UNA cosa de esta sesión, que sea esto.
  - https://www.youtube.com/watch?v=wjZofJX0v4M
- **3Blue1Brown — _Attention in transformers, visually explained_** (~26 min, YouTube). Continuación del anterior, profundiza específicamente en self-attention. Sigue siendo visual y sin matemáticas pesadas.
  - https://www.youtube.com/watch?v=eMlx5fFNoYc

## Para profundizar (más técnico, opcional)

- **Andrej Karpathy — _Let's build the GPT Tokenizer_** (~2h, YouTube). Implementa BPE desde cero. No hace falta verlo entero — los primeros 30 minutos te dan intuición sólida sobre por qué los modelos tokenizan como tokenizan.
  - https://www.youtube.com/watch?v=zduSFxRajkE
- **Andrej Karpathy — _Let's build GPT from scratch_** (~2h, YouTube). Construye un GPT desde cero en PyTorch. Avanzado, requiere algo de código. Útil cuando ya tenés el panorama general y querés meter las manos.
  - https://www.youtube.com/watch?v=kCc8FmEb1nY
- **Jay Alammar — _The Illustrated Transformer_** (post de blog). Versión escrita y visual del Transformer. Excelente complemento si preferís leer.
  - https://jalammar.github.io/illustrated-transformer/

## Herramientas prácticas

- **OpenAI Tokenizer Playground** — pegás texto y ves cómo se tokeniza. Lo usaste en el ejercicio 1.
  - https://platform.openai.com/tokenizer
- **Hugging Face Tokenizers** — librería Python para experimentar con distintos tokenizers (GPT, Llama, Claude, Gemini, etc.).
  - https://huggingface.co/docs/tokenizers
- **Tiktoken** — el tokenizer oficial de OpenAI, disponible como librería Python y JS. Lo vamos a usar en M2 para contar tokens antes de mandar el prompt.
  - https://github.com/openai/tiktoken

## Papers fundamentales (un skim suele alcanzar)

- **Vaswani et al. — _Attention Is All You Need_** (2017). El paper original del Transformer. No hace falta entender la matemática para captar la idea.
  - https://arxiv.org/abs/1706.03762
- **Liu et al. — _Lost in the Middle: How Language Models Use Long Contexts_** (2023). El paper que documentó el efecto *lost in the middle*. Vale la pena leer al menos el abstract y los resultados.
  - https://arxiv.org/abs/2307.03172
- **Kaplan et al. — _Scaling Laws for Neural Language Models_** (2020). Por qué los modelos más grandes son mejores y cómo escalar parámetros, datos y cómputo. Marco mental útil para entender la carrera de modelos frontera.
  - https://arxiv.org/abs/2001.08361

## Sobre alucinaciones, RLHF y alignment

- **Anthropic — _Constitutional AI_** (paper). Explica el approach alternativo a RLHF que usa Anthropic. Útil para entender por qué Claude se comporta distinto a GPT.
  - https://arxiv.org/abs/2212.08073
- **OpenAI — _Training language models to follow instructions with human feedback_** (InstructGPT paper, 2022). El paper donde RLHF se vuelve mainstream. Origen directo de ChatGPT.
  - https://arxiv.org/abs/2203.02155

## Lecturas más cortas (blogs y posts)

- **Simon Willison — _LLMs from a developer's perspective_** (tag recurrente en su blog). Probablemente la mejor cuenta para entender LLMs sin academia.
  - https://simonwillison.net/tags/llms/
- **Anthropic — Documentación oficial de prompt engineering**. Conceptos transferibles a cualquier modelo.
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview

---

**Vuelve a:** [`README de la sesión`](README.md) · [`Curriculum maestro`](../../../00-curriculum.md)
