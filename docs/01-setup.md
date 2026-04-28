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

## 3. Cuentas y API keys

### 3.1 Anthropic (Claude) — obligatorio

Es el proveedor LLM principal del curso.

1. Ve a [console.anthropic.com](https://console.anthropic.com/) y crea una cuenta.
2. Carga **al menos USD 5** en créditos. No es estrictamente obligatorio porque Anthropic da créditos gratuitos al registro, pero te ahorra dolores de cabeza.
3. Ve a **API Keys → Create Key**.
4. Copia la key (empieza con `sk-ant-api03-...`). **Solo la verás una vez.**
5. Guarda la key en un gestor de secretos (1Password, Bitwarden, etc.) además del `.env` local.

**Estimación de costo del curso completo:** entre USD 5 y USD 20 si haces todos los ejercicios y el proyecto integrador con modelos de gama media (Sonnet/Haiku). El curso prioriza modelos baratos para los ejercicios.

### 3.2 OpenAI — opcional

Solo se usa para las sesiones de **comparativa de proveedores** (Módulo 1). Puedes saltarlo y usar solo Anthropic durante todo el curso.

1. Ve a [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Crea una API key.
3. Copia el valor (empieza con `sk-...`).

### 3.3 Buenas prácticas con API keys

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

Edita el `.env` con tu editor favorito y reemplaza al menos:

```env
ANTHROPIC_API_KEY=sk-ant-api03-tu-key-real-aqui
```

El resto puedes dejarlo con los valores por defecto si solo trabajas en local.

---

## 5. Levantar los servicios base

El repo trae un `docker-compose.yml` con varios servicios. **Por defecto, solo se levanta Postgres + pgvector** (lo que necesitas para los primeros módulos). Los demás servicios usan [Compose profiles](https://docs.docker.com/compose/profiles/) y se levantan bajo demanda.

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

### 5.2 Servicios opcionales (a levantar cuando los pidan los módulos)

Cada profile se activa con `--profile`:

```bash
# Ollama (modelos open-source locales — Módulo 2)
docker compose --profile local-llm up -d

# Langfuse (observabilidad — Módulo 6)
docker compose --profile observability up -d

# Qdrant (BBDD vectorial alternativa — Módulo 3)
docker compose --profile qdrant up -d

# Todo a la vez
docker compose --profile local-llm --profile observability --profile qdrant up -d
```

### 5.3 Apagar servicios

```bash
# Apagar todos
docker compose down

# Apagar y eliminar volúmenes (CUIDADO: pierdes los datos locales)
docker compose down -v
```

---

## 6. Verificación: smoke test

El último paso es ejecutar un smoke test que llama a la API de Anthropic y verifica que tu setup completo funciona. El código vive en `code/00-setup-check/`.

```bash
cd code/00-setup-check
pnpm install
pnpm smoke-test
```

**Salida esperada (los valores varían):**

```
== Curso AI Engineer — Smoke Test ==

Verificando variables de entorno...
  OK: ANTHROPIC_API_KEY presente

Llamando a la API de Anthropic...
  Modelo: claude-haiku-4-5-20251001
  Mensaje: "Saluda en español en 5 palabras o menos"

Respuesta recibida:
  "¡Hola! ¿Cómo estás?"

Métricas:
  Input tokens:    18
  Output tokens:    8
  Costo aprox:    USD 0.00003

== Setup verificado correctamente ==
```

Si llegas hasta aquí con éxito, **estás listo para empezar el curso**.

---

## 7. Solución de problemas comunes

### `Error: ANTHROPIC_API_KEY not set`
- Verifica que `.env` existe en la raíz del repo (no dentro de `code/`).
- Verifica que la línea `ANTHROPIC_API_KEY=...` no tiene espacios alrededor del `=`.
- Asegúrate de que la key no está entre comillas.

### `Error 401 Unauthorized` al llamar a Anthropic
- La key está mal copiada o caducada.
- La cuenta no tiene créditos. Carga saldo en la consola.

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
