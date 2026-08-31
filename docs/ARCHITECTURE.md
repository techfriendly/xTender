# Arquitectura de xTender

## Propósito y límites

xTender coordina un expediente de contratación, sus tres documentos principales —informe de necesidad, PPT y PCAP— y, cuando corresponda, un informe jurídico de aprobación complementario. El expediente contiene los datos maestros; cada documento conserva una instantánea de esos datos, un índice editable, capítulos versionados y su propio estado. La separación evita que una actualización técnica altere automáticamente una cláusula jurídica o económica.

El producto asiste y deja trazabilidad. La aprobación técnica, económica y jurídica continúa siendo humana.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| `apps/web` | Interfaz Next.js/React, navegación del expediente, formularios, editor TipTap, estados, comparaciones, incidencias, fuentes y exportaciones. |
| `apps/api` | API FastAPI, autorización, casos de uso, prompts, recuperación, persistencia, validaciones, auditoría y generación DOCX/ZIP. |
| `apps/embedding_api` | Embeddings densos y dispersos BGE-M3 y reranking. El modo determinista es únicamente una dependencia de test explícita. |
| PostgreSQL | Fuente de verdad operacional y de trazabilidad. |
| Milvus | Índice híbrido de fragmentos de pliegos, plantillas y fuentes procesadas. |
| SeaweedFS S3 | Originales, derivados y exportaciones con claves aisladas por tenant/expediente. |
| LLM OpenAI-compatible | Sugerencia guiada, redacción, regeneración y mejora cuando existe una configuración válida. |

## Modelo operacional

Las migraciones son incrementales e idempotentes:

- `001_procureai_schema.sql`: tenants, usuarios, roles, fuentes, documentos, jobs, auditoría y configuración.
- `002_kb_schema.sql`: catálogo materializado de licitaciones, documentos y fragmentos.
- `003_elicit_runtime.sql`: expedientes, sesiones guiadas, referencias, borradores, versiones e incidencias.
- `004_template_repository.sql`: plantillas, versiones, secciones procesadas y vínculos con expedientes.
- `005_document_workflow.sql`: documento de expediente por tipo, instantáneas compartidas, propuestas de regeneración/impacto, fuentes aportadas, exportaciones, miembros y roles de usuario.
- `006_category1.sql`: planificación anual, estudios de mercado, riesgos, cronogramas, cálculos económicos, fuentes jurídicas, revisiones humanas de salidas y evidencias de alfabetización/cumplimiento.
- `007_collaboration_knowledge.sql`: sincronizaciones de corpus, búsquedas y alertas, tareas, comentarios, catálogo versionado de cláusulas, notificaciones, perfiles de impresión y visibilidad documental.
- `008_public_naming.sql`: normalización compatible de etiquetas de auditoría y datos de sistema generados con la denominación pública actual.

Relación principal:

```text
tenant
  └─ expediente (procurement_workspaces)
       ├─ datos maestros y respuestas guiadas
       ├─ fuentes y plantillas vinculadas
       ├─ documento: informe_necesidad
       │    └─ capítulos ─ versiones
       ├─ documento: ppt
       │    └─ capítulos ─ versiones
       ├─ documento: pcap
       │    └─ capítulos ─ versiones
       ├─ documento complementario: informe_juridico
       │    └─ capítulos ─ versiones
       ├─ plan, estudio de mercado, riesgos, cronograma y cálculo económico
       ├─ tareas, comentarios y revisiones humanas de salidas de IA
       ├─ propuestas de impacto/regeneración
       ├─ incidencias de validación
       └─ exportaciones y auditoría
```

PostgreSQL es preferente. La memoria local permite desarrollo controlado cuando PostgreSQL no está disponible, sin crear datos de demostración salvo que se active expresamente la bandera de seed.

## Preparación de un documento

1. El usuario crea o reabre un expediente e introduce los datos comunes.
2. Elige informe de necesidad, PPT, PCAP o el informe jurídico complementario y completa la entrevista específica.
3. Puede aportar fuentes y seleccionar referencias similares del mismo tipo documental.
4. Para el índice se aplica esta precedencia:
   - plantilla vinculada para uso de estructura;
   - estructura inferida de los documentos similares seleccionados;
   - especificación propia del tipo documental para completar apartados esenciales.
5. El índice propuesto queda pendiente de validación y se puede renombrar, reordenar, ampliar o reducir manualmente.
6. Cada capítulo se redacta con un prompt específico, los datos estructurados, la plantilla, fuentes identificadas y fragmentos de referencias similares.
7. El guardado humano genera una versión con origen `human`; la IA usa `generated` y conserva citas y traza del prompt.
8. Una regeneración de contenido existente crea una propuesta y una diferencia. Solo aceptar la propuesta crea la nueva versión.
9. El documento pasa de borrador a revisión y final después de los controles aplicables. Si la versión vigente de un capítulo fue generada, el cierre exige una decisión humana registrada sobre esa versión exacta.

## Conocimiento y automatización oficial

Los precedentes contractuales y las fuentes jurídicas se mantienen en circuitos separados para no confundir similitud documental con vigencia normativa:

- el importador y worker de PCSP obtienen anuncios y documentos públicos, calculan hashes, extraen texto y tablas, y materializan catálogo, objeto y fragmentos en PostgreSQL y SeaweedFS; la vectorización en Milvus es una capa optativa y dimensionable;
- BOE OpenData y DOGC aportan normativa con identificador, editor, fechas, estado y enlace oficial;
- TCCSP y TACRC se sincronizan de forma moderada desde sus índices públicos, conservando el original y extrayendo también PDF;
- EUR-Lex usa identificadores CELEX estables para el corpus europeo curado;
- CENDOJ permanece bloqueado mientras no exista una base de reutilización autorizada.

Cada ejecución se registra en `knowledge_sync_runs`. Las búsquedas guardadas conservan filtros y últimos resultados, generan notificaciones solo por novedades y pueden ejecutarse con el worker periódico. Los conectores fallan de forma independiente: un origen no disponible no invalida ni borra el corpus previamente persistido.

## Coherencia y propagación

Los cambios en datos compartidos se guardan primero en el expediente y generan propuestas por documento/apartado afectado. La persona revisora puede aceptar o rechazar cada propagación con una justificación; aceptar no sobrescribe directamente texto humano, sino que registra el cambio y permite regenerar de forma selectiva.

La validación determinista compara instantáneas y contenido para localizar diferencias relevantes en objeto, necesidad, presupuesto, valor estimado, impuestos, financiación, lotes, duración/prórrogas, CPV, solvencia, criterios, entregables/aceptación, SLA/penalidades, condiciones de ejecución, datos, confidencialidad y propiedad intelectual. Añade señales revisables para redundancias, ambigüedad, exigencias potencialmente restrictivas y afirmaciones normativas sin fuente. Cada incidencia tiene severidad, ubicaciones, explicación, propuesta y resolución auditada. Las diferencias legítimas pueden descartarse justificadamente.

## Recuperación y prompts

Los pliegos se fragmentan respetando Markdown, encabezados, cláusulas y tablas. Cada fragmento conserva documento, tipo, idioma, ruta de títulos, páginas, URL y hash. La recuperación limita fragmentos por documento para evitar que un precedente monopolice el contexto.

Existen instrucciones separadas por tipo documental y operación: entrevista, índice, capítulo, revisión, coherencia, mejora, extracción y validación. El contenido aportado se etiqueta como no confiable para mitigar inyección de prompts; se utiliza como evidencia, no como instrucciones. PPT/PCAP solo heredan precedentes seleccionados y compatibles con su tipo.

## Seguridad y continuidad

- Todos los endpoints salvo `/health` aplican autenticación y permisos por rol.
- La consulta de expedientes se filtra por tenant y, para usuarios no gestores, por propiedad o membresía.
- En producción el modo inseguro de cabeceras de desarrollo se cierra; el modo bearer exige token e identidad confiable inyectada por el proxy.
- Configuración y DSN se devuelven redactados; los secretos no se incorporan al repositorio.
- Las cargas aceptan una lista limitada de extensiones/MIME, tienen límite de 20 MiB, nombre saneado, hash y aislamiento por tenant/expediente.
- El contenido importado no se renderiza como HTML ejecutable.
- El autoguardado usa versión base/hash para detectar conflictos y conserva el borrador del navegador si falla la red.
- Archivar sustituye a la eliminación destructiva de expedientes y plantillas.
- Las sincronizaciones externas solo aceptan conectores conocidos, aplican límites y no siguen instrucciones contenidas en documentos recuperados.
- La salida completa se puede devolver en formatos abiertos mediante el dossier ZIP reversible, sin depender del proveedor para leer capítulos, versiones, datos o trazas.

La federación OIDC/SSO, las evidencias de alojamiento en la UE, la configuración concreta de retención y la acreditación ENS deben conectarse o aportarse en el entorno de destino. La matriz de cumplimiento distingue expresamente control implementado de evidencia o certificación pendiente. Un servidor LLM, BGE-M3, Milvus o SeaweedFS ausente se comunica como dependencia no disponible; no se falsifica una respuesta exitosa.
