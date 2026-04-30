# Sesión 07.2 — Ejercicios

> **Tiempo estimado:** ~50 min total. Comparas modelos cloud, exploras MRL en práctica y opcionalmente probás un modelo open-source con Python. Scripts en [`code/m03-embeddings/sesion-07.2/`](../../../../code/m03-embeddings/sesion-07.2/).

---

## Setup

```bash
cd code/m03-embeddings/sesion-07.2
pnpm install
```

`.env` con `GOOGLE_GENERATIVE_AI_API_KEY` (siempre) y opcionalmente `OPENAI_API_KEY` para el ejercicio 1. Si no tenés OpenAI, el script salta esa parte.

El reto en Python es **opcional** — si no querés instalar Python ahora, los ejercicios principales corren todos en TS.

---

## 1. Ejercicio guiado: Gemini vs OpenAI sobre el mismo corpus

**Objetivo:** comparar dos modelos cloud sobre el catálogo de TiendaPro.

### 1.1. Probarlo

```bash
pnpm run compare-providers
```

El script:
1. Carga el catálogo (12 productos).
2. Embedeaa con `gemini-embedding-001` (768D).
3. Si hay `OPENAI_API_KEY`, embedeaa también con `text-embedding-3-small` (1536D).
4. Para 3 queries de prueba, calcula el top-3 con cada modelo y los muestra lado a lado.

### 1.2. Salida esperada (snippet)

```
Query: "algo para cargar mis cosas en una caminata"

Gemini (768D):
  1. Mochila Trekker 30L      (0.65)
  2. Mochila Summit 65L       (0.61)
  3. Mochila City Daypack 18L (0.55)

OpenAI (1536D):
  1. Mochila Trekker 30L      (0.71)
  2. Mochila Summit 65L       (0.66)
  3. Mochila City Daypack 18L (0.59)

(Ambos modelos rankean igual los top 3. Las similitudes absolutas
 NO son comparables entre modelos — cada uno vive en su espacio.)
```

### 1.3. Pregunta para ti

Las similitudes coseno de Gemini son sistemáticamente más bajas que las de OpenAI. ¿Significa que Gemini es "peor" o que indexa mal?

> **Razonamiento:** **NI UNO NI OTRO.** Las similitudes absolutas dependen del modelo (cómo distribuye los vectores en su espacio). Modelos distintos pueden devolver scores en rangos distintos para el mismo par. Lo que importa es el **ranking relativo** dentro del mismo modelo. Por eso:
>
> - **NUNCA** comparés similitudes coseno entre modelos.
> - **NUNCA** uses umbrales fijos transversales ("siempre >0.7"). Lo que sirve para Gemini puede no servir para OpenAI.
> - **El umbral lo definís por modelo y por dominio**, basado en tu eval set.

---

## 2. Ejercicio: Matryoshka Representation Learning (MRL)

**Objetivo:** ver MRL en práctica truncando un vector y midiendo la pérdida de calidad.

### 2.1. Probarlo

```bash
pnpm run mrl
```

El script:
1. Embedeaa el catálogo con Gemini (vector 3072D, MRL nativo).
2. Para cada producto, también almacena versiones truncadas: 768, 256, 128.
3. Para 5 queries de prueba, calcula el top-3 con cada dimensión.
4. Reporta cuántos resultados cambian al bajar dimensiones.

### 2.2. Salida esperada (snippet)

```
Query: "mochila para senderismo"
Top-3 dim=3072: [Trekker 30L, Summit 65L, City Daypack 18L]
Top-3 dim=768:  [Trekker 30L, Summit 65L, City Daypack 18L]   ← idéntico
Top-3 dim=256:  [Trekker 30L, Summit 65L, City Daypack 18L]   ← idéntico
Top-3 dim=128:  [Trekker 30L, Summit 65L, Botas Trail Pro]    ← cambia (botas en 3er lugar)

Resumen: 3072 vs 768: 0/5 queries cambiaron top-3
         3072 vs 256: 1/5 queries cambiaron top-3
         3072 vs 128: 3/5 queries cambiaron top-3
```

### 2.3. Pregunta para ti

Tu app va a indexar 50M chunks con Gemini. Storage en pgvector con vectores `vector(3072)` ocupa ~600 GB. Si bajás a `vector(768)` el storage es ~150 GB. ¿Qué tradeoff tomás según el tamaño del corpus?

> **Razonamiento sugerido:**
>
> - **Corpus chico (<1M):** la diferencia de storage es marginal. Quedate con 3072 para máxima calidad.
> - **Corpus medio (1M-10M):** 768 es el sweet spot. Calidad ~igual, storage 4× menor.
> - **Corpus grande (10M+):** evaluá 256 con tu eval set. Si perdés <2% de retrieval@10, el ahorro 12× compensa.
> - **Patrón profesional:** dual-pass — almacenás 256 para retrieval rápido (top-100), después rerankeás con 3072 sobre esos 100. Costo bajo, calidad alta.

---

## 3. Ejercicio: comparar similitud entre productos relacionados

**Objetivo:** ver qué tan bien un modelo captura matices del dominio outdoor.

### 3.1. Probarlo

```bash
pnpm run domain-test
```

El script tiene 5 pares de productos diseñados para probar matices:

| Par | Esperado |
|-----|----------|
| Mochila 30L vs Mochila 65L | Alto (~0.75-0.85) — ambas mochilas |
| Mochila 30L vs Tienda 2P | Medio (~0.50-0.60) — ambos outdoor |
| Mochila 30L vs Hornillo | Bajo-medio (~0.45-0.55) — outdoor distinto |
| Mochila 30L vs Forro polar | Bajo-medio (~0.40-0.50) — uso adyacente |
| Mochila 30L vs Linterna | Bajo (~0.30-0.45) — categorías distintas |

Imprime las similitudes y verifica si el ranking esperado se cumple.

### 3.2. Pregunta para ti

¿Qué te dice el resultado del modelo sobre tu corpus? Si la similitud Mochila 30L vs Linterna es 0.55 (más alta de lo esperado), ¿qué problema podría haber?

> **Razonamiento:**
>
> Un modelo multilingüe entrenado con corpus genérico **puede no distinguir bien matices del dominio outdoor**: agrupa "linterna" y "mochila" bajo "equipo de camping" y los pone cerca.
>
> **Fixes operacionales:**
>
> 1. **Mejor metadata en el chunk:** incluí categoría explícita (`Categoría: mochilas` al final del texto a embedear).
> 2. **Pre-filtrar por categoría** antes del retrieval semántico. El clasificador de S04 puede determinar qué categoría busca el cliente.
> 3. **Fine-tuning del embedder** sobre tu dominio (técnica avanzada, requiere labeled data).
> 4. **Modelo dominio-específico** si existe (e.g., e-commerce embeddings entrenados con catálogos reales).

---

## 4. Reto opcional: sentence-transformers en Python

**Objetivo:** correr un embedder open-source local y compararlo con cloud.

### 4.1. Setup

Si no tenés Python instalado, este reto es opcional. Si lo tenés:

```bash
cd python
python3 -m venv venv
source venv/bin/activate    # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4.2. Probarlo

```bash
python compare_local.py
```

El script:
1. Carga `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768D).
2. Embedeaa los 12 productos del catálogo (mismo JSON que TS).
3. Para 3 queries de prueba, devuelve top-3 con el modelo local.
4. Imprime tiempo de embedding y memoria usada.

### 4.3. Pregunta para ti

El modelo local tarda ~2s en cargar y ~50ms por query (CPU). ¿Cuándo este overhead se justifica vs API call a Gemini (50-200ms cada uno)?

> **Razonamiento:**
>
> - **Carga del modelo:** se paga UNA vez al startup. Para servicios long-running, irrelevante.
> - **Latencia por query:** local es ~5-10× más rápido que API call (sin red). Importante para apps con latencia estricta.
> - **Costo a volumen:** local es **gratis** marginalmente; API call es ~$0.02/1M tokens. A 10M queries/mes con Gemini = ~$30. A 1B queries/mes = ~$3000.
> - **Privacidad:** local no envía datos a terceros.
> - **Calidad:** open-source ~3-5 puntos MTEB más bajo que cloud. Para FAQ retrieval simple, puede no importar.
>
> En TiendaPro vamos cloud por el free tier y la simplicidad. En un banco con compliance estricto, vamos local.

---

## 5. Aporte al proyecto integrador

Esta sesión NO modifica TiendaPro. La decisión documentada es: **gemini-embedding-001 (768D) para el catálogo + FAQs** en S08. Los ejercicios sustentan la decisión:

- Multilingüe robusto (ejercicio 1 vs OpenAI: similitud).
- Calidad suficiente (ejercicio 3: ranking del dominio se cumple en ~60-70% de pares).
- Free tier amplio (no afecta presupuesto).
- MRL disponible (flexibilidad futura — ejercicio 2).

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md).
