# Poner xTender en marcha

## Requisitos

- Node.js 22 o superior, npm 10 o superior y Python 3.10 o superior.
- Para contenedores: Docker y Docker Compose.
- Para operación persistente: PostgreSQL. Para recuperación semántica: Milvus y embeddings BGE-M3. Para originales y artefactos: un gateway SeaweedFS S3 existente. Para generación: un servidor LLM compatible con API de chat de OpenAI.

El Compose incluye web, API, PostgreSQL, embeddings, etcd, Milvus y workers de ingesta. SeaweedFS y el LLM se configuran por separado. Los pesos de modelos no se incluyen. La web utiliza actualmente una versión preliminar de Next.js fijada en el lockfile.

## Preparación

Desde la raíz del repositorio:

```bash
cp .env.local.example .env.local
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r apps/api/requirements.txt
npm ci
python scripts/init_local_data.py
```

Edita `.env.local` con tus endpoints y credenciales. El último comando crea una base vacía y conserva cualquier base local existente. El repositorio no distribuye pliegos ni corpus. Los valores `change-me` y credenciales de ejemplo son exclusivos de desarrollo.

## Desarrollo local

Arranca cada proceso en una terminal distinta, con el entorno Python activo para la API:

```bash
npm run api
```

```bash
npm run dev:web
```

Web: <http://localhost:3000>. API: <http://localhost:8000/docs>.

La configuración de la API se lee desde `.env.local`. Para usar servicios desde el host, sustituye nombres internos de Docker por endpoints accesibles: por ejemplo `MILVUS_URI=http://127.0.0.1:19530` y `EMBEDDING_API_URL=http://127.0.0.1:8010` si están publicados en esos puertos. El modo local puede utilizar memoria cuando PostgreSQL no está disponible; los datos de ese modo no son persistentes.

Para servir embeddings reales, instala además `apps/embedding_api/requirements.txt`, configura el modelo y ejecuta `npm run embeddings`. El backend determinista se reserva para las pruebas.

## Docker con infraestructura compartida

Configura SeaweedFS y el modelo, y comprueba que los contenedores pueden alcanzarlos. En el ejemplo, SeaweedFS se referencia mediante `host.docker.internal`; un hostname como `vllm` solo funciona si ese servicio es accesible desde la red del Compose.

Arranca los servicios principales con un nombre de proyecto estable para que xReview y xFollow puedan conectarse a `procureai_default`:

```bash
docker compose -p procureai --env-file .env.local up --build -d postgres etcd milvus embedding-api-fast kb-loader api web
```

El loader recibe una base vacía inicializada dentro de la imagen. Este comando no activa las descargas de corpus de los workers. Para activar la ingesta, revisa fuentes, permisos, almacenamiento y alcance temporal y arranca explícitamente los workers correspondientes:

```bash
docker compose -p procureai --env-file .env.local up -d pcsp-kb-worker official-source-worker
```

Los scripts `ingest_pcsp_kb.py`, `load_kb_postgres.py`, `upload_kb_seaweedfs.py`, `setup_milvus.py` e `index_kb_milvus.py` permiten preparar fuentes por pasos; cada uno dispone de `--help`. Los resultados son datos privados de la instalación y siguen excluidos de Git.

## Verificación

```bash
npm test
npm run build
```

Las pruebas usan una base sintética temporal. Los tests de PostgreSQL son optativos y requieren una base dedicada a pruebas:

```bash
PROCUREAI_RUN_POSTGRES_TESTS=1 PYTHONPATH=apps/api EMBEDDING_BACKEND=deterministic \
  python -m pytest apps/api/tests/test_postgres_integration.py -q
```

## Exposición de una instancia

Configura `AUTH_MODE=bearer`, un token propio y un proxy de identidad que elimine cabeceras no confiables y establezca `X-User-Id`, `X-Tenant-Id` y `X-Roles`. La integración de identidad corporativa, TLS y servicios persistentes forma parte del despliegue. Consulta [SECURITY.md](../SECURITY.md) y [la arquitectura](ARCHITECTURE.md).
