# Sesión 00.1 — Ejercicios

> **Tiempo estimado:** ~20 min total. Los ejercicios de esta sesión son **conceptuales** — todavía no escribimos código (eso empieza en S01.1). El objetivo es fijar el stack mental y la intuición económica.

---

## 1. Ejercicio guiado: las 6 capas en un caso real

**Caso:** una clínica médica quiere un chatbot que ayude a pacientes a:

1. Agendar citas
2. Responder dudas frecuentes (*"¿qué documentos necesito traer?"*, *"¿el doctor X está disponible el viernes?"*)
3. Derivar urgencias a un humano

**Tu tarea:** completa la siguiente tabla. Para cada capa, identifica qué decisión hay que tomar y qué proveedor o herramienta usarías en MVP (mes 1) y en producción consolidada (mes 6, con ~1.000 pacientes activos).

| Capa | Decisión a tomar | MVP | Producción mes 6 |
|------|------------------|-----|------------------|
| 1. Modelo | | | |
| 2. Prompt | | | |
| 3. Contexto | | | |
| 4. Orquestación | | | |
| 5. Evaluación | | | |
| 6. Producción | | | |

Tomate 10 minutos. **No mires la guía** hasta haber intentado las 6 capas, aunque sea con respuestas tentativas.

---

### Guía de razonamiento (para contrastar tus respuestas)

> **Importante:** no hay una única respuesta correcta. Lo que importa es que tu justificación sea **coherente** con los tradeoffs vistos en la teoría. Si tu respuesta difiere de la guía pero la podés defender, es válida.

| Capa | Razonamiento sugerido |
|------|----------------------|
| **1. Modelo** | MVP: Gemini Flash (free tier para validar) o Claude Haiku 4.5. Producción: Haiku para FAQs y agendamiento; Sonnet para conversaciones complejas o derivaciones de urgencia (donde un error es caro). |
| **2. Prompt** | Sistema con tono empático y profesional, restricciones explícitas (*"NO des consejo médico, deriva a humano si detectás urgencia"*), formato de salida estructurado (JSON con `intent`: `agendar` / `consultar` / `urgencia`, y `response`). |
| **3. Contexto** | RAG con FAQs y políticas de la clínica. Memoria conversacional (últimos N mensajes). Acceso a calendario del médico para responder disponibilidad. |
| **4. Orquestación** | Clasificador de intención → router. Si `intent=agendar`, llamar tool `bookAppointment(date, doctor)`. Si `urgencia`, escalar a humano inmediatamente. Si `consultar`, RAG sobre FAQs. |
| **5. Evaluación** | Eval set inicial con 30-50 conversaciones representativas. En producción: rating explícito de pacientes + LLM-as-judge para calidad de respuestas. Métricas: % de derivaciones correctas, tiempo a resolución. |
| **6. Producción** | Langfuse para observabilidad. Alertas si latencia > 5s. Plan de fallback si el modelo principal falla (rotar a otro proveedor vía la abstracción). Logs anonimizados (es info de salud, ojo con HIPAA / LOPDGDD). |

**Pregunta de extensión:** ¿qué cambia si la clínica está en la Unión Europea y debe cumplir el AI Act? (Pista: las aplicaciones de IA en salud caen en la categoría de *alto riesgo*, lo que activa requisitos extra de transparencia, supervisión humana y documentación).

---

## 2. Ejercicios libres

### 2.1. Cálculo de costo

Calcula el costo mensual estimado para los 3 escenarios siguientes, asumiendo:

- 1.000 usuarios activos/día
- 5 mensajes/día por usuario en promedio
- Cada mensaje: 800 tokens de input (incluye sistema y contexto), 200 tokens de output

**Escenario A:** Gemini 2.5 Flash (cloud económico)
**Escenario B:** Claude Haiku 4.5 (cloud económico Anthropic)
**Escenario C:** Llama 3.1:8B en Ollama local (asumiendo que ya tienes el hardware)

Usa la tabla de precios snapshot del [`README`](README.md#1-apis-comerciales) como referencia.

---

#### Solución guía

**Volumen mensual:**

- Mensajes/mes = `1.000 × 5 × 30 = 150.000 mensajes/mes`
- Input tokens/mes = `150.000 × 800 = 120M tokens`
- Output tokens/mes = `150.000 × 200 = 30M tokens`

**Escenario A — Gemini 2.5 Flash:**
`120M × $0.20/1M + 30M × $1/1M = $24 + $30 = ~$54/mes`

**Escenario B — Claude Haiku 4.5:**
`120M × $1/1M + 30M × $5/1M = $120 + $150 = ~$270/mes`

**Escenario C — Llama 3.1:8B en Ollama local:**
$0 marginal (ya pagaste el hardware). Costo eléctrico despreciable a este volumen.

**Pregunta de seguimiento:** Haiku cuesta ~5× más que Flash. ¿Qué te llevaría a elegir Haiku igualmente?

> **Razones válidas:** mejor calidad de respuesta en español neutro, mejor adherencia a instrucciones complejas, mejor manejo de tools, ya tener relación contractual / BAA con Anthropic, política interna de proveedor preferido. **El precio es UN factor, no EL factor.**

### 2.2. Reflexión personal (escribir, sin formato)

Tomate 5-10 minutos de papel y boli (o un doc local). **No copies, escribí**.

- ¿En qué punto del spectrum *Prompt Engineer ↔ AI Engineer ↔ ML Engineer ↔ Researcher* querés posicionarte? ¿Por qué?
- ¿Qué te atrae de la práctica del AI Engineer y qué te genera resistencia? Sé honesto contigo mismo.
- En tu rol actual o pasado, ¿qué problema concreto resolverías HOY si supieras lo que vas a aprender en este curso?

Esto no se entrega ni se evalúa. Es para que tengas una respuesta consciente cuando alguien te pregunte *"¿por qué AI Engineering?"*.

---

## 3. Reto: detective de productos IA

Elige 2 productos reales que uses (o conozcas) que tengan IA integrada — pueden ser obvios (ChatGPT, Notion AI, Cursor, GitHub Copilot) o sutiles (búsqueda mejorada en algún SaaS, sugerencias personalizadas de un e-commerce).

Para cada uno, intenta inferir:

1. **¿Qué proveedor de LLM creés que usan?** Pistas observables:
   - **Latencia:** ¿es rápido (sub-segundo) o lento (>3s)? Latencia baja sugiere modelo económico o servido en hardware especializado (Groq, Cerebras).
   - **Formato de respuesta:** ¿streaming o respuesta completa? ¿Markdown? ¿Tools?
   - **Errores que te haya dado:** ¿alucinaciones específicas? ¿Estilo de disculpa?
   - **Calidad relativa:** ¿es claramente nivel frontera o "lo justo y suficiente"?

2. **¿En qué capas del stack creés que invierten más?**
   - ¿Es prompt simple o complejo?
   - ¿Mucho RAG?
   - ¿Agente con tools?
   - ¿Mucho post-procesamiento?

3. **¿Cuánto creés que les cuesta atender a un usuario activo por mes?** Razonalo en orden de magnitud (¿centavos? ¿dólares? ¿decenas de dólares?).

**No hay respuesta correcta.** El objetivo es entrenar el ojo para "leer" arquitecturas IA desde fuera. Es una habilidad que vas a usar muchísimo cuando empieces a construir la tuya.

---

## 4. Aporte al proyecto integrador

**Esta sesión NO agrega código a TiendaPro.** El primer commit del proyecto integrador llega en S01.1 con el setup inicial.

Lo que SÍ podés hacer ahora, opcional, es escribir 1 párrafo de respuesta a:

- ¿Qué modelo creés que usaríamos para TiendaPro en MVP? ¿Por qué?
- Si TiendaPro escala a 10.000 conversaciones/día con 800 tokens input + 200 tokens output por mensaje, ¿cuánto cuesta por mes con Haiku? (Aplicá lo del ejercicio 2.1.)
- ¿Cambia tu decisión de modelo cuando ves el número?

Guarda esto en un doc local. Vamos a referenciarlo en S01.2 cuando hagamos la primera comparativa real entre proveedores.

---

**Vuelve a:** [`README de la sesión`](README.md) | **Próximo paso:** [`recursos.md`](recursos.md) → material complementario opcional.
