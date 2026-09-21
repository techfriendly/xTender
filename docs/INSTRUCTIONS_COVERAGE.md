# Cobertura funcional de xTender

Esta matriz describe el estado verificable del repositorio. “Implementado” significa que existe recorrido de API, persistencia y UI cuando corresponde; no equivale a aprobación jurídica ni a despliegue productivo.

| Área | Estado | Superficie actual |
| --- | --- | --- |
| Expediente común | Implementado | Alta, edición, archivo/restauración, reapertura, datos maestros, selector activo y progreso de los tres documentos principales y del informe jurídico complementario. |
| Informe de necesidad | Implementado | Entrevista y estructura propias, índice configurable, capítulos, versiones, estados, validación y DOCX. |
| PPT | Implementado | Estructura técnica propia, taxonomía de requisitos, índice por plantilla/similares, edición y regeneración selectiva, versiones, revisión y DOCX. |
| PCAP | Implementado con revisión humana obligatoria | Datos administrativos estructurados separados del texto jurídico, índice por plantilla/similares, capítulos, versiones, revisión y DOCX. |
| Informe jurídico complementario | Implementado con revisión profesional obligatoria | Estructura propia, fuentes y antecedentes examinados, capítulos versionados, estados y exportación; no se presenta como dictamen infalible. |
| Índices y documentos similares | Implementado | Plantilla con prioridad; en su ausencia, precedentes PPT/PCAP similares seleccionados; edición manual completa del índice. |
| Fuentes y trazabilidad | Implementado | Carga validada, inclusión/exclusión, hashes, fragmentos identificables, citas, origen humano/generado y auditoría. |
| Edición segura | Implementado | Autoguardado, indicador de estado, conflicto optimista, aviso al salir, búsqueda, versiones, comparación/restauración, comentarios anclados y protección del texto humano. |
| Propagación de datos comunes | Implementado | Análisis de apartados afectados, propuesta revisable, aceptar/rechazar con comentario y sin sustitución silenciosa. |
| Coherencia documental | Implementado | Errores/advertencias/recomendaciones con localización, explicación, corrección propuesta y resolución trazable. |
| Exportación | Implementado | DOCX por documento y dossier ZIP reversible con Markdown, datos, versiones, fuentes disponibles, auditoría, manifiesto y hashes. |
| Roles, aislamiento y auditoría | Implementado en la aplicación | Permisos por rol, tenant, propiedad/membresía, autenticación local o bearer y eventos auditables. |
| Plantillas corporativas | Implementado | Alta Markdown o carga PDF/DOCX/ODT/texto, secciones, versiones, archivo/restauración y vínculo por uso. |
| Base de conocimiento/RAG | Implementado; requiere infraestructura | Importación PCSP reproducible, PostgreSQL, SeaweedFS y búsqueda híbrida Milvus/BGE-M3. |
| Generación LLM | Implementado; requiere modelo configurado | Prompts específicos, presupuesto de contexto, streaming, reintentos/control de error, citas y persistencia de salida. |
| Supervisión humana de IA | Implementado | Origen de contenido visible, aceptación/rechazo por versión exacta, feedback auditado y bloqueo del estado final si falta revisión. |
| Planificación y control | Implementado | Plan anual, estudio de mercado versionado, escenarios, operadores, riesgos, cronograma, tareas y alertas de vencimiento. |
| Exploradores y alertas | Implementado | Licitaciones indexadas, normativa/doctrina oficial, búsquedas guardadas, conteo de novedades y worker periódico. |
| Presupuesto y valor estimado | Implementado | Líneas e hipótesis estructuradas, IVA, prórrogas, opciones, modificaciones, versiones y propagación confirmada. |
| Catálogo de cláusulas | Implementado | Cláusulas versionadas con variables, alcance documental, propuesta previa y sin inserción automática en texto revisado. |
| Cumplimiento y alfabetización | Implementado como control/evidencia | Matriz que separa controles de acreditaciones, perfil actualizable y módulos de uso responsable con constancia individual. |
| Multilingüismo | Parcial | Navegación ES/CA/VA/GL/EU y metadatos de idioma; la calidad final depende del modelo y de las fuentes disponibles. |
| Autenticación corporativa | Dependencia de despliegue | Existe cierre seguro y contrato con proxy bearer; falta conectar el proveedor OIDC/SSO concreto de la entidad. |
| Normativa/doctrina/jurisprudencia exhaustiva | Dependencia de corpus y licencias | BOE, DOGC, TCCSP, TACRC y EUR-Lex tienen conectores trazables; CENDOJ queda desactivado hasta contar con autorización y ningún corpus se presenta como exhaustivo. |
| Firma, registro y tramitador corporativo | No integrado | Requiere contratos, credenciales y decisiones del sistema corporativo de destino. |

## Condiciones externas de verificación

- `EMBEDDING_BACKEND=real` necesita FlagEmbedding/BGE-M3 y recursos compatibles.
- La generación necesita `LLM_BASE_URL`, `LLM_MODEL` y credenciales válidas para un endpoint OpenAI-compatible.
- La persistencia productiva necesita PostgreSQL y las migraciones `001`–`010`.
- La recuperación híbrida necesita Milvus indexado; los originales y exportaciones persistentes necesitan SeaweedFS S3.
- La automatización periódica de fuentes necesita el servicio `official-source-worker` y acceso saliente a los dominios oficiales.
- La evidencia de alojamiento UE, retención del proveedor, ENS y SSO/OIDC pertenece a la configuración y acreditación del despliegue real; la aplicación no la autoafirma.
- El modo determinista de embeddings y la semilla demo están reservados para pruebas explícitas; no se activan por defecto.
