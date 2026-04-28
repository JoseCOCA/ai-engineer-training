# 01 — Setup del entorno

> **Objetivo:** dejar tu máquina lista para el resto del curso. Al final de este documento vas a poder ejecutar el smoke test y recibir una respuesta real de Claude. Si eso funciona, todo lo demás funciona.

**Tiempo estimado:** 30–60 minutos (la mayor parte es descargar e instalar; el contenido como tal son ~10 minutos de lectura).

---

## 1. Antes de empezar

### Sistemas operativos soportados

| SO | Estado | Notas |
|----|--------|-------|
| Linux (Ubuntu 22.04+, Fedora 38+, Arch, etc.) | ✅ Recomendado | Soporte de primera clase |
| macOS 13+ (Intel y Apple Silicon) | ✅ Soportado | Todo funciona |
| Windows 11 con WSL2 (Ubuntu) | ✅ Soportado | Trabaja siempre dentro de WSL |
| Windows nativo (sin WSL) | ❌ No soportado | Docker, paths y herramientas se complican demasiado |

> **Si estás en Windows**, instala WSL2 primero ([guía oficial](https://learn.microsoft.com/windows/wsl/install)) y trabaja dentro de Ubuntu desde la terminal de WSL. El resto de la guía asume que estás dentro de WSL.

### Qué vas a instalar

| Herramienta | Versión mínima | Para qué |
|------------|---------------|---------|
| Git | 2.40+ | Control de versiones |
| Node.js | 20 LTS | Runtime principal del curso (TypeScript) |
| pnpm | 9+ | Gestor de paquetes — más rápido que npm/yarn y mejor para monorepos |
| Python | 3.11+ | Solo para sesiones marcadas con `[Python]` |
| uv | 0.4+ | Gestor de Python — reemplaza pip, venv y poetry |
| Docker | 24+ | Contenedores para Postgres, Langfuse, Ollama |
| Docker Compose | v2 (plugin) | Orquestación local de servicios |

Si ya tienes algunas instaladas, sáltate los pasos correspondientes.

---

## 2. Instalación de herramientas

### 2.1 Git

Casi todos los sistemas ya lo traen. Verifica:

```bash
git --version
# git version 2.40.0 o superior
```

Si no lo tienes:
- **Ubuntu/Debian:** `sudo apt install git`
- **Fedora:** `sudo dnf install git`
- **macOS:** ya viene; si no, instala Xcode Command Line Tools con `xcode-select --install`

Configura tu identidad si nunca lo hiciste:

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### 2.2 Node.js + pnpm

**La forma recomendada en Linux/macOS es con [nvm](https://github.com/nvm-sh/nvm)** (Node Version Manager). Te permite tener múltiples versiones y cambiar entre ellas.

```bash
# Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# Reabre la terminal o ejecuta:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instalar Node 20 LTS y usarlo
nvm install 20
nvm use 20
nvm alias default 20

# Verificar
node --version    # v20.x.x o superior
```

> **Alternativa moderna:** [fnm](https://github.com/Schniz/fnm) o [Volta](https://volta.sh/). Si ya usas alguno, está bien.

**Instalar pnpm:**

```bash
# Opción 1 (recomendada): vía corepack (viene con Node)
corepack enable
corepack prepare pnpm@latest --activate

# Opción 2: instalación global con npm
npm install -g pnpm

# Verificar
pnpm --version    # 9.x.x o superior
```

### 2.3 Python + uv

[uv](https://docs.astral.sh/uv/) es un gestor de paquetes y proyectos Python escrito en Rust. Reemplaza `pip`, `venv`, `poetry` y `pyenv` con una sola herramienta órdenes de magnitud más rápida. **Es la opción recomendada en este curso para todo lo relacionado con Python.**

**Instalar uv:**

```bash
# Linux / macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verificar
uv --version    # 0.4.x o superior
```

**Instalar Python con uv:**

```bash
uv python install 3.12
uv python list
```

uv crea entornos virtuales aislados por proyecto automáticamente — no necesitas activar/desactivar `venv` manualmente.

### 2.4 Docker + Docker Compose

Sigue las guías oficiales según tu sistema:

- **Linux:** [Install Docker Engine](https://docs.docker.com/engine/install/) (recomendado: instala Docker Engine, no Docker Desktop, en Linux).
- **macOS / Windows-WSL:** [Docker Desktop](https://www.docker.com/products/docker-desktop/).

Tras la instalación, verifica:

```bash
docker --version              # Docker version 24.x.x o superior
docker compose version        # Docker Compose version v2.x.x o superior
docker run hello-world        # debe descargar y ejecutar el contenedor de prueba
```

**Importante en Linux:** añade tu usuario al grupo `docker` para evitar usar `sudo` en cada comando. Reinicia sesión después:

```bash
sudo usermod -aG docker $USER
```

---

## 3. Cuentas y proveedores LLM

> **El curso es proveedor-agnóstico desde el día 1.** Necesitas configurar **al menos uno** de los siguientes proveedores. Si configuras varios, el smoke test los probará todos para que veas en práctica el patrón de abstracción que vas a estudiar formalmente en el Módulo 2.

| Proveedor | Tipo | Costo | Recomendado |
|-----------|------|-------|-------------|
| **Ollama** (local) | Modelos open-source en tu máquina | Gratis | ✅ Sí (siempre que tu hardware lo permita) |
| **Google Gemini** (cloud) | API con tier gratuito amplio | Gratis hasta 1500 req/día | ✅ Sí (es la opción cloud principal del curso) |
| **Anthropic Claude** (cloud) | API premium | Hay créditos gratuitos al registro | Opcional — solo para sesiones de comparativa |
| **OpenAI** (cloud) | API premium | De pago tras el trial | Opcional — solo para sesiones de comparativa |

**Estrategia recomendada:**
1. Instala Ollama local (ver sección 5.2) — es tu motor por defecto, sin costo.
2. Crea cuenta gratuita en Google AI Studio para tener Gemini disponible cuando necesites más calidad o trabajes sin GPU.
3. Anthropic y OpenAI son **opcionales**: configúralos solo si quieres seguir las sesiones de comparativa con datos reales.

### 3.1 Google Gemini (recomendado, gratis)

Google AI Studio tiene el tier gratuito más generoso del mercado para empezar.

1. Ve a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) e inicia sesión con tu cuenta Google.
2. Click en **Create API key**. Si no tienes proyecto Cloud, crea uno nuevo desde la misma interfaz.
3. Copia el valor de la key.
4. Pégala en tu `.env`:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=tu-key-de-google
   ```

**Cuotas del tier gratis (Gemini 2.5 Flash):**
- 15 requests por minuto.
- 1500 requests por día.
- Sin necesidad de tarjeta de crédito.

Más que suficiente para todo el curso.

### 3.2 Anthropic Claude (opcional)

Solo necesario si quieres seguir las sesiones de comparativa de proveedores con datos reales en lugar de leer los ejemplos.

1. Ve a [console.anthropic.com](https://console.anthropic.com/) y crea una cuenta.
2. Anthropic suele dar **créditos gratuitos** al registro (típicamente USD 5). Si los consumes y necesitas más, carga saldo desde **Settings → Billing**.
3. Ve a **Settings → API Keys → Create Key** ([directo](https://console.anthropic.com/settings/keys)).
4. Copia la key (empieza con `sk-ant-api03-...`). **Solo se muestra una vez.**
5. Guarda la key en un gestor de secretos (1Password, Bitwarden, etc.) además del `.env`.
6. **Configura un spending limit** en **Settings → Billing → Limits** (por ejemplo, USD 10/mes) para evitar sustos.

### 3.3 OpenAI (opcional)

Mismo rol que Anthropic — solo para sesiones de comparativa.

1. Ve a [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Crea una API key.
3. Copia el valor (empieza con `sk-...`).
4. Configura límites de gasto en **Settings → Limits**.

### 3.4 Buenas prácticas con API keys

- **Nunca** hagas commit de un `.env` real. El `.gitignore` ya lo excluye, pero verifica con `git status` antes de commitear.
- **Usa keys distintas** para entornos distintos (desarrollo, CI, producción).
- **Configura límites de gasto** en la consola del proveedor. Anthropic permite poner spending limits — actívalos.
- **Rota las keys** periódicamente y al final del curso.

---

## 4. Clonar el repo y configurar variables de entorno

```bash
# Si aún no clonaste el repo
git clone <url-del-repo> curso-ai
cd curso-ai

# Copiar la plantilla a .env (este archivo SÍ está en .gitignore)
cp env.example .env
```

Edita el `.env` con tu editor favorito y completa **al menos uno** de estos proveedores:

```env
# Recomendado (gratis con tier amplio)
GOOGLE_GENERATIVE_AI_API_KEY=tu-key-de-google

# Recomendado (gratis si tienes Ollama instalado, ver sección 5.2)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# Opcional (solo para sesiones de comparativa)
ANTHROPIC_API_KEY=sk-ant-api03-tu-key-real-aqui
```

El resto de variables puedes dejarlas con los valores por defecto si solo trabajas en local.

---

## 5. Levantar los servicios base

El repo trae un `docker-compose.yml` con servicios opcionales que se activan bajo demanda usando [Compose profiles](https://docs.docker.com/compose/profiles/). Postgres + pgvector es el único que se levanta por defecto cuando ejecutas `docker compose up`.

### 5.1 Postgres + pgvector (necesario desde el Módulo 3)

```bash
docker compose up -d postgres
```

Verifica que esté corriendo:

```bash
docker compose ps
# debes ver curso-ai-postgres en estado "running" y "healthy"
```

Conéctate con tu cliente SQL favorito o desde la terminal:

```bash
docker compose exec postgres psql -U curso -d curso_ai

# Dentro del prompt psql, verifica que pgvector está disponible:
curso_ai=# CREATE EXTENSION IF NOT EXISTS vector;
curso_ai=# SELECT '[1,2,3]'::vector;
curso_ai=# \q
```

Si la extensión `vector` se crea sin error, tu Postgres está listo.

### 5.2 Ollama (recomendado desde el Módulo 1)

Ollama te permite correr modelos open-source en tu propia máquina. Es gratis, sin límites de uso y mantiene los datos en local.

**Hardware recomendado:**

| RAM disponible | Modelos sugeridos | Comportamiento |
|----------------|-------------------|----------------|
| < 8 GB | Phi-4-mini, Qwen 2.5 1.5B | Limitado, solo para experimentar |
| 8–16 GB | Llama 3.1 8B, Qwen 2.5 7B (cuantizados) | Funciona bien en CPU |
| 16–32 GB | Llama 3.1 8B sin cuantizar, Qwen 2.5 14B | Cómodo en CPU; rápido con GPU |
| 32 GB+ | Modelos 30B+ con cuantización | Equipo de gama alta |

Tener una GPU acelera la inferencia entre 5x y 50x según el modelo. Funciona también solo con CPU.

**Instalación nativa (recomendada — mejor performance que la imagen Docker):**

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Verificar
ollama --version
```

**Descargar tu primer modelo:**

```bash
ollama pull qwen2.5:7b
# Tarda algunos minutos según tu conexión (~5 GB)
```

**Probar que funciona:**

```bash
ollama run qwen2.5:7b "Saluda en español en 5 palabras"
```

Por defecto, Ollama escucha en `http://localhost:11434`. Esa URL ya está en tu `.env` como `OLLAMA_BASE_URL`.

#### Usar otros modelos

`qwen2.5:7b` es el default del curso porque es **accesible para la mayor cantidad de hardware** (corre en 8–16 GB de RAM). Si tienes hardware potente y prefieres un modelo más capaz, puedes sobrescribir el modelo en tu `.env` sin tocar el código:

```env
# En tu .env (no en env.example, que es público)
OLLAMA_MODEL=llama3.1:8b          # alternativa similar a qwen2.5:7b
OLLAMA_MODEL=qwen2.5:14b          # mejor calidad, requiere ~16 GB RAM
OLLAMA_MODEL=qwen2.5:32b          # calidad alta, requiere ~24 GB RAM
OLLAMA_MODEL=llama3.3:70b         # cercano a frontera open-source, requiere ~48 GB RAM
```

Lista actualizada de modelos disponibles: [ollama.com/library](https://ollama.com/library). Acuérdate de hacer `ollama pull <modelo>` antes de usarlo. **Para los ejercicios del curso, cualquier modelo de instrucción de 7B+ es suficiente** — los más grandes simplemente dan respuestas más pulidas.

#### Notas sobre GPU

Ollama detecta automáticamente la GPU si los drivers están bien instalados. Si tu GPU no se detecta y prefieres acelerar la inferencia:

- **NVIDIA con CUDA:** instala los drivers oficiales de NVIDIA y CUDA Toolkit. Ollama los usa automáticamente.
- **AMD con ROCm:** Ollama soporta ROCm en Linux. Verifica con `rocminfo` que tu GPU esté detectada por ROCm. Para series muy recientes puede ser necesario instalar la versión más reciente de ROCm (6.2+) y, en algunos casos, definir la variable de entorno `HSA_OVERRIDE_GFX_VERSION` antes de iniciar Ollama. Consulta la [documentación oficial de Ollama sobre GPU AMD](https://github.com/ollama/ollama/blob/main/docs/gpu.md) para los detalles más actuales.
- **Apple Silicon (M1/M2/M3/M4):** Ollama usa Metal automáticamente, sin configuración.

Si la GPU no se acelera, Ollama caerá automáticamente a CPU. La inferencia será más lenta, pero funcional.

#### Alternativa con Docker (si prefieres no instalar Ollama nativamente)

```bash
# CPU o NVIDIA
docker compose --profile local-llm up -d ollama

# AMD con ROCm — usa la imagen específica
# (edita docker-compose.yml y cambia ollama/ollama:latest a ollama/ollama:rocm)
```

### 5.3 Servicios opcionales

Cada profile se activa con `--profile`:

```bash
# Langfuse (observabilidad — Módulo 6)
docker compose --profile observability up -d

# Qdrant (BBDD vectorial alternativa — Módulo 3)
docker compose --profile qdrant up -d
```

### 5.4 Apagar servicios

```bash
# Apagar todos
docker compose down

# Apagar y eliminar volúmenes (CUIDADO: pierdes los datos locales)
docker compose down -v
```

---

## 6. Verificación: smoke test

El smoke test detecta automáticamente qué proveedores LLM tienes configurados (Ollama, Gemini, Anthropic, OpenAI) y prueba todos los disponibles. El código vive en `code/00-setup-check/`.

```bash
cd code/00-setup-check
pnpm install
pnpm smoke-test
```

**Salida esperada (los valores varían según los proveedores que tengas):**

```
== Curso AI Engineer — Smoke Test ==

Detectando proveedores configurados...
  [OK]   Ollama (local)         qwen2.5:7b
  [OK]   Google Gemini          gemini-2.5-flash
  [SKIP] Anthropic Claude       (ANTHROPIC_API_KEY no definida)
  [SKIP] OpenAI                 (OPENAI_API_KEY no definida)

Probando proveedores disponibles...

[Ollama (local) — qwen2.5:7b]
  Respuesta:    "¡Hola, mucho gusto!"
  Tokens:       in=18 out=7
  Costo:        USD 0.00000 (local)
  Tiempo:       1.234 s

[Google Gemini — gemini-2.5-flash]
  Respuesta:    "¡Hola! ¿Cómo estás?"
  Tokens:       in=14 out=8
  Costo:        USD 0.00000 (free tier)
  Tiempo:       0.621 s

== Setup verificado correctamente ==
2 de 2 proveedores configurados respondieron correctamente.
```

Si llegas hasta aquí con éxito, **estás listo para empezar el curso**.

---

## 7. Solución de problemas comunes

### El smoke test dice `Ningún proveedor configurado`
- Asegúrate de tener al menos uno de estos en tu `.env`:
  `GOOGLE_GENERATIVE_AI_API_KEY`, `OLLAMA_BASE_URL`, `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`.
- Verifica que `.env` existe en la **raíz del repo** (no dentro de `code/`).
- Verifica que las líneas `KEY=valor` no tienen espacios alrededor del `=` ni comillas.

### Error 401 Unauthorized en cualquier proveedor cloud
- La key está mal copiada o caducada — vuelve a generar una en la consola del proveedor.
- La cuenta no tiene créditos o cuota disponible.

### `Ollama: connect ECONNREFUSED 127.0.0.1:11434`
- Ollama no está corriendo. Ejecuta `ollama serve` en una terminal separada (o asegúrate de que el daemon esté activo, p.ej. `systemctl status ollama` en Linux).
- Si usas Docker, levanta el profile: `docker compose --profile local-llm up -d`.

### `Ollama: model not found`
- El modelo configurado en `OLLAMA_MODEL` no está descargado. Ejecuta `ollama pull <nombre-del-modelo>` (por ejemplo, `ollama pull qwen2.5:7b`).
- Lista los modelos descargados con `ollama list`.

### Ollama responde extremadamente lento o satura el CPU
- La inferencia está corriendo en CPU porque la GPU no fue detectada.
- Verifica drivers de GPU y revisa los logs de Ollama (`journalctl -u ollama -f` en Linux con systemd, o la salida de `ollama serve`).
- Como alternativa, usa Gemini (cloud, free tier) hasta resolver la GPU.

### Gemini: `429 RESOURCE_EXHAUSTED`
- Has excedido la cuota gratuita (15 req/min o 1500 req/día). Espera unos minutos o cambia temporalmente a Ollama.

### `connect ECONNREFUSED 127.0.0.1:5432`
- Postgres no está corriendo. Ejecuta `docker compose up -d postgres`.
- O el puerto está ocupado por otra instancia local. Cambia `POSTGRES_PORT` en `.env` (por ejemplo a `5433`) y vuelve a levantar.

### `permission denied while trying to connect to the Docker daemon`
- En Linux: añade tu usuario al grupo `docker` (`sudo usermod -aG docker $USER`) y cierra/reabre sesión.

### `pnpm: command not found`
- Tras `corepack enable`, abre una terminal nueva.
- O instala globalmente con `npm install -g pnpm`.

### Node muy viejo (`v18` o anterior)
- Algunos paquetes del curso requieren Node 20+. Actualiza con `nvm install 20 && nvm use 20`.

### El smoke test funciona pero `docker compose ps` muestra Postgres en estado `unhealthy`
- Espera 30 segundos y reintenta — el healthcheck tarda en pasar la primera vez.
- Si persiste, ejecuta `docker compose logs postgres` y revisa el error específico.

---

## 8. Próximo paso

Si vienes de JS/TS sin experiencia previa en Python, lee a continuación:

→ [`02-python-para-js-devs.md`](02-python-para-js-devs.md)

Si ya conoces Python o prefieres ir directo al contenido:

→ [`modulos/01-fundamentos/`](modulos/01-fundamentos/) — Módulo 1: Fundamentos de productos con IA
