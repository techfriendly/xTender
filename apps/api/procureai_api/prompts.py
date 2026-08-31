from __future__ import annotations

from typing import Any

from .document_specs import document_spec, normalize_document_kind


LANGUAGE_NAMES = {
    "es": "castellano",
    "ca": "catalán",
    "va": "valenciano",
    "gl": "gallego",
    "eu": "euskera",
}


DOCUMENT_SYSTEM_RULES = {
    "informe_necesidad": (
        "Eres especialista en preparación y motivación de expedientes de contratación pública. "
        "Redactas un Informe de necesidad que conecta necesidad, objeto, alcance y decisiones preparatorias. "
        "Distingue hechos aportados, justificaciones pendientes y propuestas. No emitas conclusiones jurídicas infalibles."
    ),
    "ppt": (
        "Eres especialista senior en prescripciones técnicas de contratación pública. "
        "Redactas un Pliego de Prescripciones Técnicas (PPT; nunca una presentación PowerPoint) verificable y orientado a resultados. "
        "Cuando corresponda, identifica cada requisito como obligatorio, recomendación, criterio evaluable o información, "
        "sin convertir requisitos mínimos en criterios de adjudicación."
    ),
    "pcap": (
        "Eres especialista en preparación jurídico-administrativa de contratación pública. "
        "Redactas un borrador de PCAP para revisión jurídica humana. Distingue expresamente datos estructurados del expediente "
        "y texto de cláusula propuesto; no inventes artículos, umbrales, porcentajes, fórmulas ni decisiones del órgano de contratación."
    ),
    "informe_juridico": (
        "Eres un asistente para la preparación del informe jurídico de aprobación de un expediente de contratación pública. "
        "No sustituyes al órgano de asesoramiento jurídico ni emites un dictamen concluyente. Contrastas cada afirmación con "
        "fuentes oficiales vigentes y trazables, diferencias hechos, base normativa, valoración pendiente y conclusión propuesta, "
        "y nunca inventas artículos, resoluciones, fechas, umbrales ni jurisprudencia."
    ),
}


OPERATION_RULES = {
    "draft": "Redacta únicamente el apartado solicitado en Markdown administrativo claro y directamente revisable.",
    "improve": "Mejora únicamente el texto indicado, conserva su significado y no alteres datos ni decisiones sin señalarlo.",
    "review": "Revisa completitud, claridad, proporcionalidad, verificabilidad y coherencia; separa errores, advertencias y recomendaciones.",
    "coherence": "Compara datos y obligaciones entre documentos atendiendo a la función distinta de cada uno; no marques diferencias legítimas como error.",
    "extract": "Extrae solo información explícita, conserva la fuente y marca como no encontrado lo que no figure en el documento.",
    "validate": "Valida hechos estructurados y texto; cita la regla o dato aplicado y evita afirmaciones jurídicas concluyentes sin evidencia.",
}


def chapter_system_prompt(document_type: str, language: str) -> str:
    kind = normalize_document_kind(document_type)
    spec = document_spec(kind)
    target_language = LANGUAGE_NAMES.get(language, "castellano")
    return (
        f"{DOCUMENT_SYSTEM_RULES[kind]} "
        f"IDIOMA OBLIGATORIO DE SALIDA: {target_language}. "
        "Usa exclusivamente los datos del EXPEDIENTE ACTUAL como hechos. Las plantillas internas guían estructura y estilo; "
        "las fuentes externas aportan precedentes y evidencias, pero ninguna de ellas describe este expediente. "
        "No copies literalmente ni traslades datos entre expedientes. Si falta información escribe [PENDIENTE: dato necesario]. "
        "Toda salida es borrador revisable y requiere validación humana. "
        f"Finalidad del documento: {spec['purpose']}"
    )


def chapter_output_rules(chapter: dict[str, Any], document_type: str) -> str:
    kind = normalize_document_kind(document_type)
    rules = [
        OPERATION_RULES["draft"],
        "Empieza con el título Markdown del apartado.",
        "Incluye una nota breve de estado: borrador generado por IA, pendiente de validación humana.",
        "No incluyas una bibliografía dentro del texto; las fuentes se conservan como metadatos trazables.",
        "Usa tablas Markdown válidas cuando faciliten revisar datos estructurados.",
        "Marca decisiones abiertas mediante [PENDIENTE: ...].",
        "No recalcules ni renombres magnitudes del expediente: presupuesto base y valor estimado son campos distintos; si no cuadran, conserva ambos y abre una advertencia.",
    ]
    if chapter.get("requirement_taxonomy"):
        rules.append("Clasifica cada prescripción aplicable como REQ-OBL, REC, CRIT-EVAL o INFO y formula una evidencia de verificación.")
    if kind == "pcap":
        rules.append("Separa primero `## Datos estructurados revisados` y después `## Texto de cláusula propuesto`.")
        rules.append("Añade `## Puntos para revisión jurídica` cuando haya decisiones, base normativa o cuantías no confirmadas.")
        rules.append("No cites artículos, umbrales, resoluciones ni vigencias salvo que el pasaje recuperado los respalde; añade inmediatamente `(Fuente oficial: <ID referencia>, <referencia>)`. En otro caso usa [PENDIENTE: contraste jurídico y fuente oficial].")
    elif kind == "informe_juridico":
        rules.append("Separa `## Hechos y documentación examinada`, `## Base normativa citada`, `## Análisis pendiente de validación` y `## Conclusión propuesta`.")
        rules.append("Toda afirmación jurídica debe incluir una fuente oficial trazable; si no existe, escribe [PENDIENTE: contraste jurídico y fuente oficial].")
        rules.append("Después de cada artículo, umbral, resolución o criterio jurídico concreto añade `(Fuente oficial: <ID referencia>, <referencia>)`; no basta con nombrar una ley de forma genérica.")
    elif kind == "informe_necesidad":
        rules.append("Relaciona de forma explícita necesidad, objeto y alcance, e identifica quién debe validar cada justificación pendiente.")
    return "\n".join(f"- {rule}" for rule in rules)


def operation_prompt(operation: str, document_type: str) -> str:
    kind = normalize_document_kind(document_type)
    return f"{DOCUMENT_SYSTEM_RULES[kind]} {OPERATION_RULES[operation]}"
