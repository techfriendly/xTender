# Datos locales

La distribución empieza sin expedientes ni corpus. Ejecuta `python3 scripts/init_local_data.py` para crear una base de conocimiento vacía; el comando conserva cualquier archivo existente. La imagen Docker ejecuta este paso durante su construcción.

Incorpora únicamente fuentes que puedas utilizar en tu instalación. Los scripts de ingesta, carga e indexación están en `scripts/`. El catálogo CPV completo puede generarse con `scripts/import_cpv_catalog.py`; sin él, la aplicación utiliza un catálogo de respaldo reducido.

Todo el contenido operativo de `data/`, salvo este README, está excluido de Git y del contexto de construcción Docker. Para incorporar un corpus a contenedores, configura un volumen privado o ingéstalo en los servicios de persistencia. No añadas documentos ni sus extracciones al repositorio.
