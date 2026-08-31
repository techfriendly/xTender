"use client";

import clsx from "clsx";
import Image from "next/image";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Files,
  FolderKanban,
  History,
  Landmark,
  Link2,
  ListChecks,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Upload,
  Trash2,
  X,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  activateWorkspace,
  archiveWorkspace,
  applyEconomicCalculation,
  autoSelectReferences,
  completeLiteracyModule,
  compareChapterVersions,
  createEconomicCalculation,
  createClauseCatalogEntry,
  createDocumentComment,
  createMarketStudy,
  createProcurementRisk,
  createProcurementSchedule,
  createSavedSearch,
  createWorkspaceTask,
  createRegenerationProposal,
  createTemplate,
  createWorkspace,
  archiveTemplate,
  downloadDocx,
  downloadDossier,
  draftChapterStream,
  exportDocx,
  exportDossier,
  extractCpvContext,
  fetchAudit,
  fetchAnnualPlan,
  fetchAiOutputReviews,
  fetchCategory1Capabilities,
  fetchChapters,
  fetchClauseCatalog,
  fetchComplianceProfile,
  fetchDocumentComments,
  fetchEconomicCalculations,
  fetchChangeProposals,
  fetchChapterVersions,
  fetchDocumentSpecs,
  fetchImpactProposals,
  fetchLlm2Health,
  fetchLiteracyStatus,
  fetchMarketStudies,
  fetchOfficialConnectors,
  fetchProcurementRisks,
  fetchProcurementSchedules,
  fetchSavedSearches,
  fetchSources,
  fetchRegenerationProposals,
  fetchTemplateSections,
  fetchTemplates,
  fetchValidationIssues,
  fetchWorkspaceTemplates,
  fetchWorkspaces,
  fetchWorkspaceDocuments,
  fetchWorkspaceSources,
  fetchWorkspaceTasks,
  exploreLegalSources,
  exploreTenders,
  searchCpvs,
  improveChapterTextStream,
  processTemplate,
  proposeDraftIndex,
  resolveChangeProposal,
  resolveDocumentComment,
  resolveRegenerationProposal,
  resolveValidationIssue,
  runAdvancedValidation,
  runSavedSearch,
  renderClauseForWorkspace,
  reviewAiChapter,
  restoreChapterVersion,
  runCoherenceReview,
  restoreWorkspace,
  restoreTemplate,
  sendGuidedMessage,
  startGuidedSession,
  suggestGuidedAnswerStream,
  updateChapter,
  updateDocumentIndex,
  updateDocumentStatus,
  updateAcceptedReferences,
  updateWorkspaceTemplates,
  updateWorkspace,
  updateWorkspaceSource,
  saveAnnualPlanItem,
  syncOfficialSources,
  validateDraftIndex,
  uploadTemplate,
  uploadWorkspaceSource,
  type AuditEvent,
  type AnnualPlanItem,
  type AiOutputReview,
  type Category1Capability,
  type ClauseCatalogEntry,
  type ChapterVersion,
  type ChangeProposal,
  type CpvItem,
  type DocumentTemplate,
  type DocumentKind,
  type DocumentComment,
  type DocumentOverview,
  type DocumentSpec,
  type DocumentTemplateSection,
  type DraftChapter,
  type DraftIndex,
  type ImpactProposal,
  type EconomicCalculation,
  type KbSummary,
  type Llm2Health,
  type LegalKnowledgeSource,
  type LiteracyModule,
  type MarketStudy,
  type OfficialConnector,
  type ProcurementRisk,
  type ProcurementSchedule,
  type ReferenceCandidate,
  type RegenerationProposal,
  type SavedSearch,
  type SearchHit,
  type SourceRow,
  type ValidationIssue,
  type Workspace,
  type WorkspaceSource,
  type WorkspaceTask,
  type WorkspaceTemplateLink
} from "@/lib/api";
import { formatEuro, severityClass, statusLabel, type Severity } from "@/lib/data";
import { localeOptions, type Locale } from "@/lib/i18n";
import ChapterRichEditor, { type ChapterRichEditorHandle, type RichEditorSelection } from "./ChapterRichEditor";

type ModuleId = "expedientes" | "categoria1" | "elicit" | "referencias" | "indice" | "redaccion" | "validacion" | "fuentes" | "ajustes";
type GuidedNavigationTarget =
  | { type: "module"; module: ModuleId }
  | { type: "field"; field: string }
  | { type: "locale"; locale: Locale };

const documentKinds: DocumentKind[] = ["informe_necesidad", "ppt", "pcap", "informe_juridico"];

const documentLabels: Record<DocumentKind, { short: string; title: string }> = {
  informe_necesidad: { short: "Informe", title: "Informe de necesidad" },
  ppt: { short: "PPT", title: "Pliego de Prescripciones Técnicas" },
  pcap: { short: "PCAP", title: "Pliego de Cláusulas Administrativas Particulares" },
  informe_juridico: { short: "Jurídico", title: "Informe jurídico de aprobación" }
};

type IndexExperienceCopy = {
  replan: string;
  proposedFromTemplate: string;
  proposedFromSimilar: string;
  proposedFromSpec: string;
  editableHint: string;
  confirmedTitle: string;
  provisionalTitle: string;
  impactWarning: string;
  historyGuarantee: string;
  dirtyWarning: string;
  addChapter: string;
  saveStructure: string;
  newChapter: string;
  removeConfirmation: string;
  replanConfirmation: string;
};

const indexExperienceCopy: Record<Locale, IndexExperienceCopy> = {
  es: {
    replan: "Replantear índice {document}",
    proposedFromTemplate: "Estructura propuesta desde una plantilla",
    proposedFromSimilar: "Estructura propuesta desde documentos similares",
    proposedFromSpec: "Estructura base propia del tipo documental",
    editableHint: "Puedes renombrar, reordenar, añadir o quitar capítulos en cualquier momento.",
    confirmedTitle: "Índice confirmado, pero deliberadamente editable",
    provisionalTitle: "Índice provisional: revisa su estructura antes de redactar",
    impactWarning: "Guardar un cambio o replantear el índice revoca la confirmación anterior. Los capítulos retirados dejan de formar parte del documento activo y tendrás que confirmar de nuevo la estructura antes de usar la IA.",
    historyGuarantee: "No se destruye el trabajo anterior: las versiones de capítulos retirados permanecen en el historial técnico y la auditoría para poder recuperarlas o justificar la decisión.",
    dirtyWarning: "Hay cambios estructurales sin guardar. Al guardarlos se revocará cualquier confirmación previa; vuelve a confirmar el índice antes de redactar.",
    addChapter: "Añadir capítulo",
    saveStructure: "Guardar estructura",
    newChapter: "Nuevo apartado",
    removeConfirmation: "Se quitará «{chapter}» del documento activo. Sus versiones se conservarán en el historial, pero tendrás que guardar y volver a confirmar el índice. ¿Continuar?",
    replanConfirmation: "Replantear sustituirá la estructura activa y revocará su confirmación. Los capítulos que desaparezcan dejarán de mostrarse en el documento, aunque sus versiones seguirán en el historial. ¿Continuar?"
  },
  ca: {
    replan: "Replanteja l’índex {document}",
    proposedFromTemplate: "Estructura proposada des d’una plantilla",
    proposedFromSimilar: "Estructura proposada des de documents similars",
    proposedFromSpec: "Estructura base pròpia del tipus documental",
    editableHint: "Pots canviar el nom, reordenar, afegir o eliminar capítols en qualsevol moment.",
    confirmedTitle: "Índex confirmat, però deliberadament editable",
    provisionalTitle: "Índex provisional: revisa’n l’estructura abans de redactar",
    impactWarning: "Desar un canvi o replantejar l’índex revoca la confirmació anterior. Els capítols retirats deixen de formar part del document actiu i cal tornar a confirmar l’estructura abans d’usar la IA.",
    historyGuarantee: "No es destrueix el treball anterior: les versions dels capítols retirats romanen a l’historial tècnic i a l’auditoria.",
    dirtyWarning: "Hi ha canvis estructurals sense desar. En desar-los es revocarà qualsevol confirmació prèvia; torna a confirmar l’índex abans de redactar.",
    addChapter: "Afegeix capítol",
    saveStructure: "Desa l’estructura",
    newChapter: "Nou apartat",
    removeConfirmation: "Es traurà «{chapter}» del document actiu. Les versions es conservaran a l’historial, però caldrà desar i tornar a confirmar l’índex. Vols continuar?",
    replanConfirmation: "Replantejar substituirà l’estructura activa i en revocarà la confirmació. Els capítols retirats deixaran de mostrar-se, però les versions seguiran a l’historial. Vols continuar?"
  },
  va: {
    replan: "Replantejar índex {document}",
    proposedFromTemplate: "Estructura proposada des d’una plantilla",
    proposedFromSimilar: "Estructura proposada des de documents similars",
    proposedFromSpec: "Estructura base pròpia del tipus documental",
    editableHint: "Pots canviar el nom, reordenar, afegir o eliminar capítols en qualsevol moment.",
    confirmedTitle: "Índex confirmat, però deliberadament editable",
    provisionalTitle: "Índex provisional: revisa l’estructura abans de redactar",
    impactWarning: "Guardar un canvi o replantejar l’índex revoca la confirmació anterior. Els capítols retirats deixen de formar part del document actiu i cal tornar a confirmar l’estructura abans d’usar la IA.",
    historyGuarantee: "No es destruïx el treball anterior: les versions dels capítols retirats romanen en l’historial tècnic i l’auditoria.",
    dirtyWarning: "Hi ha canvis estructurals sense guardar. En guardar-los es revocarà qualsevol confirmació prèvia; torna a confirmar l’índex abans de redactar.",
    addChapter: "Afegir capítol",
    saveStructure: "Guardar estructura",
    newChapter: "Nou apartat",
    removeConfirmation: "Es llevarà «{chapter}» del document actiu. Les versions es conservaran en l’historial, però caldrà guardar i tornar a confirmar l’índex. Continuar?",
    replanConfirmation: "Replantejar substituirà l’estructura activa i revocarà la confirmació. Els capítols retirats deixaran de mostrar-se, però les versions seguiran en l’historial. Continuar?"
  },
  gl: {
    replan: "Reformular índice {document}",
    proposedFromTemplate: "Estrutura proposta desde un modelo",
    proposedFromSimilar: "Estrutura proposta desde documentos similares",
    proposedFromSpec: "Estrutura base propia do tipo documental",
    editableHint: "Podes renomear, reordenar, engadir ou retirar capítulos en calquera momento.",
    confirmedTitle: "Índice confirmado, pero deliberadamente editable",
    provisionalTitle: "Índice provisional: revisa a estrutura antes de redactar",
    impactWarning: "Gardar un cambio ou reformular o índice revoga a confirmación anterior. Os capítulos retirados deixan de formar parte do documento activo e cómpre confirmar de novo a estrutura antes de usar a IA.",
    historyGuarantee: "Non se destrúe o traballo anterior: as versións dos capítulos retirados permanecen no historial técnico e na auditoría.",
    dirtyWarning: "Hai cambios estruturais sen gardar. Ao gardalos revogarase calquera confirmación previa; confirma de novo o índice antes de redactar.",
    addChapter: "Engadir capítulo",
    saveStructure: "Gardar estrutura",
    newChapter: "Novo apartado",
    removeConfirmation: "Retirarase «{chapter}» do documento activo. As versións conservaranse no historial, pero haberá que gardar e confirmar de novo o índice. Continuar?",
    replanConfirmation: "Reformular substituirá a estrutura activa e revogará a confirmación. Os capítulos retirados deixarán de mostrarse, pero as versións seguirán no historial. Continuar?"
  },
  eu: {
    replan: "Birplanteatu {document} aurkibidea",
    proposedFromTemplate: "Txantiloi batetik proposatutako egitura",
    proposedFromSimilar: "Antzeko dokumentuetatik proposatutako egitura",
    proposedFromSpec: "Dokumentu motaren berezko oinarrizko egitura",
    editableHint: "Kapituluak edozein unetan berrizendatu, berrantolatu, gehitu edo kendu ditzakezu.",
    confirmedTitle: "Aurkibidea berretsita dago, baina editagarria izaten jarraitzen du",
    provisionalTitle: "Behin-behineko aurkibidea: berrikusi egitura idatzi aurretik",
    impactWarning: "Aldaketa bat gordetzeak edo aurkibidea birplanteatzeak aurreko berrespena baliogabetzen du. Kendutako kapituluak dokumentu aktibotik aterako dira eta egitura berriro berretsi beharko da IA erabili aurretik.",
    historyGuarantee: "Aurreko lana ez da suntsitzen: kendutako kapituluen bertsioak historia teknikoan eta auditorian gordetzen dira.",
    dirtyWarning: "Gorde gabeko egitura-aldaketak daude. Gordetzean aurreko berrespena baliogabetuko da; berretsi berriro aurkibidea idatzi aurretik.",
    addChapter: "Gehitu kapitulua",
    saveStructure: "Gorde egitura",
    newChapter: "Atal berria",
    removeConfirmation: "«{chapter}» dokumentu aktibotik kenduko da. Bertsioak historian gordeko dira, baina aurkibidea gorde eta berriro berretsi beharko da. Jarraitu?",
    replanConfirmation: "Birplanteatzeak egitura aktiboa ordeztu eta berrespena baliogabetuko du. Kendutako kapituluak ez dira agertuko, baina bertsioak historian gordeko dira. Jarraitu?"
  }
};

const navItems: Array<{ id: ModuleId; icon: typeof FolderKanban }> = [
  { id: "expedientes", icon: FolderKanban },
  { id: "categoria1", icon: Landmark },
  { id: "elicit", icon: WandSparkles },
  { id: "referencias", icon: Search },
  { id: "indice", icon: ListChecks },
  { id: "redaccion", icon: PencilLine },
  { id: "validacion", icon: ClipboardCheck },
  { id: "fuentes", icon: BookOpen }
];

type UiCopy = {
  nav: Record<ModuleId, string>;
  headings: Record<ModuleId, { label: string; title: string; subtitle: string }>;
  new: string;
  active: string;
  save: string;
  archive: string;
  restore: string;
  answer: string;
  references: string;
  proposeIndex: string;
  validateIndex: string;
  draftChapter: string;
  saveChapter: string;
  impacts: string;
  export: string;
  source: string;
  powered: string;
  ai: string;
  searchPlaceholder: string;
  semanticSearch: string;
  textSearch: string;
  previous: string;
  nextPage: string;
  pageOf: string;
  perPage: string;
};

const copy: Record<Locale, UiCopy> = {
  es: {
    nav: {
      expedientes: "Expedientes",
      categoria1: "Preparación avanzada",
      elicit: "Preparación",
      referencias: "Referencias",
      indice: "Índice",
      redaccion: "Redacción",
      validacion: "Validación",
      fuentes: "Fuentes/Exportación",
      ajustes: "Ajustes"
    },
    headings: {
      expedientes: { label: "Expedientes", title: "Gestión de expedientes", subtitle: "Busca, crea, selecciona, edita metadatos y archiva expedientes sin perder trazabilidad." },
      categoria1: { label: "Preparación avanzada", title: "Preparación inteligente de contratos", subtitle: "Planificación, estudios de mercado, exploradores oficiales, cálculo económico, riesgos, plazos y cumplimiento." },
      elicit: { label: "Preparación", title: "Ficha inicial del PPT", subtitle: "Completa solo los datos conocidos. Lo pendiente queda marcado para no inventar contenido." },
      referencias: { label: "Referencias", title: "Pliegos de referencia", subtitle: "Selección automática de plantillas y pliegos similares, siempre marcados como referencia externa." },
      indice: { label: "Índice", title: "Índice del PPT", subtitle: "Revisa la estructura antes de redactar capítulos con llm2." },
      redaccion: { label: "Redacción", title: "Redacción por capítulos", subtitle: "Genera, edita y versiona cada capítulo con contexto controlado y fuentes trazables." },
      validacion: { label: "Validación", title: "Revisión del borrador", subtitle: "Comprueba coherencia, pendientes e impactos antes de exportar." },
      fuentes: { label: "Fuentes", title: "Fuentes y exportación", subtitle: "Revisa evidencias, auditoría y genera el DOCX del expediente." },
      ajustes: { label: "Ajustes", title: "Ajustes", subtitle: "Gestiona plantillas reutilizables y parámetros preparados para el sistema." }
    },
    new: "Nuevo expediente",
    active: "Expediente activo",
    save: "Guardar metadatos",
    archive: "Archivar",
    restore: "Restaurar",
    answer: "Guardar respuesta",
    references: "Buscar referencias automáticamente",
    proposeIndex: "Proponer índice PPT",
    validateIndex: "Confirmar estructura",
    draftChapter: "Redactar con llm2",
    saveChapter: "Guardar edición",
    impacts: "Ver impactos",
    export: "Exportar DOCX",
    source: "Abrir fuente",
    powered: "powered by",
    ai: "Sistema IA con validación humana",
    searchPlaceholder: "Buscar por código, título, unidad, CPV o significado",
    semanticSearch: "Búsqueda semántica BGE-M3",
    textSearch: "Búsqueda textual",
    previous: "Anterior",
    nextPage: "Siguiente",
    pageOf: "Página",
    perPage: "10 por página"
  },
  ca: {
    nav: {
      expedientes: "Expedients",
      categoria1: "Preparació avançada",
      elicit: "Preparació",
      referencias: "Referències",
      indice: "Índex",
      redaccion: "Redacció",
      validacion: "Validació",
      fuentes: "Fonts/Exportació",
      ajustes: "Ajustos"
    },
    headings: {
      expedientes: { label: "Expedients", title: "Gestió d'expedients", subtitle: "Cerca, crea, selecciona, edita metadades i arxiva expedients sense perdre traçabilitat." },
      categoria1: { label: "Preparació avançada", title: "Preparació intel·ligent de contractes", subtitle: "Planificació, estudis de mercat, exploradors oficials, càlcul econòmic, riscos, terminis i compliment." },
      elicit: { label: "Preparació", title: "Fitxa inicial del PPT", subtitle: "Completa només les dades conegudes. El que falta queda marcat per no inventar contingut." },
      referencias: { label: "Referències", title: "Plecs de referència", subtitle: "Selecció automàtica de plantilles i plecs similars, sempre marcats com a referència externa." },
      indice: { label: "Índex", title: "Índex del PPT", subtitle: "Revisa l'estructura abans de redactar capítols amb llm2." },
      redaccion: { label: "Redacció", title: "Redacció per capítols", subtitle: "Genera, edita i versiona cada capítol amb context controlat i fonts traçables." },
      validacion: { label: "Validació", title: "Revisió de l'esborrany", subtitle: "Comprova coherència, pendents i impactes abans d'exportar." },
      fuentes: { label: "Fonts", title: "Fonts i exportació", subtitle: "Revisa evidències, auditoria i genera el DOCX de l'expedient." },
      ajustes: { label: "Ajustos", title: "Ajustos", subtitle: "Gestiona plantilles reutilitzables i paràmetres preparats per al sistema." }
    },
    new: "Nou expedient",
    active: "Expedient actiu",
    save: "Desa metadades",
    archive: "Arxiva",
    restore: "Restaura",
    answer: "Desa resposta",
    references: "Cerca referències automàticament",
    proposeIndex: "Proposa índex PPT",
    validateIndex: "Confirma estructura",
    draftChapter: "Redacta amb llm2",
    saveChapter: "Desa edició",
    impacts: "Veure impactes",
    export: "Exporta DOCX",
    source: "Obre font",
    powered: "powered by",
    ai: "Sistema IA amb validació humana",
    searchPlaceholder: "Cerca per codi, títol, unitat, CPV o significat",
    semanticSearch: "Cerca semàntica BGE-M3",
    textSearch: "Cerca textual",
    previous: "Anterior",
    nextPage: "Següent",
    pageOf: "Pàgina",
    perPage: "10 per pàgina"
  },
  va: {
    nav: {
      expedientes: "Expedients",
      categoria1: "Preparació avançada",
      elicit: "Preparació",
      referencias: "Referències",
      indice: "Índex",
      redaccion: "Redacció",
      validacion: "Validació",
      fuentes: "Fonts/Exportació",
      ajustes: "Ajustos"
    },
    headings: {
      expedientes: { label: "Expedients", title: "Gestió d'expedients", subtitle: "Busca, crea, selecciona, edita metadades i arxiva expedients sense perdre traçabilitat." },
      categoria1: { label: "Preparació avançada", title: "Preparació intel·ligent de contractes", subtitle: "Planificació, estudis de mercat, exploradors oficials, càlcul econòmic, riscos, terminis i compliment." },
      elicit: { label: "Preparació", title: "Fitxa inicial del PPT", subtitle: "Completa només les dades conegudes. El pendent queda marcat per a no inventar contingut." },
      referencias: { label: "Referències", title: "Plecs de referència", subtitle: "Selecció automàtica de plantilles i plecs similars, sempre com a referència externa." },
      indice: { label: "Índex", title: "Índex del PPT", subtitle: "Revisa l'estructura abans de redactar capítols amb llm2." },
      redaccion: { label: "Redacció", title: "Redacció per capítols", subtitle: "Genera, edita i versiona cada capítol amb context controlat i fonts traçables." },
      validacion: { label: "Validació", title: "Revisió de l'esborrany", subtitle: "Comprova coherència, pendents i impactes abans d'exportar." },
      fuentes: { label: "Fonts", title: "Fonts i exportació", subtitle: "Revisa evidències, auditoria i genera el DOCX de l'expedient." },
      ajustes: { label: "Ajustos", title: "Ajustos", subtitle: "Gestiona plantilles reutilitzables i paràmetres preparats per al sistema." }
    },
    new: "Nou expedient",
    active: "Expedient actiu",
    save: "Guardar metadades",
    archive: "Arxivar",
    restore: "Restaurar",
    answer: "Guardar resposta",
    references: "Buscar referències automàticament",
    proposeIndex: "Proposar índex PPT",
    validateIndex: "Confirmar estructura",
    draftChapter: "Redactar amb llm2",
    saveChapter: "Guardar edició",
    impacts: "Vore impactes",
    export: "Exportar DOCX",
    source: "Obrir font",
    powered: "powered by",
    ai: "Sistema IA amb validació humana",
    searchPlaceholder: "Buscar per codi, títol, unitat, CPV o significat",
    semanticSearch: "Busca semàntica BGE-M3",
    textSearch: "Busca textual",
    previous: "Anterior",
    nextPage: "Següent",
    pageOf: "Pàgina",
    perPage: "10 per pàgina"
  },
  gl: {
    nav: {
      expedientes: "Expedientes",
      categoria1: "Preparación avanzada",
      elicit: "Preparación",
      referencias: "Referencias",
      indice: "Índice",
      redaccion: "Redacción",
      validacion: "Validación",
      fuentes: "Fontes/Exportación",
      ajustes: "Axustes"
    },
    headings: {
      expedientes: { label: "Expedientes", title: "Xestión de expedientes", subtitle: "Busca, crea, selecciona, edita metadatos e arquiva expedientes sen perder trazabilidade." },
      categoria1: { label: "Preparación avanzada", title: "Preparación intelixente de contratos", subtitle: "Planificación, estudos de mercado, exploradores oficiais, cálculo económico, riscos, prazos e cumprimento." },
      elicit: { label: "Preparación", title: "Ficha inicial do PPT", subtitle: "Completa só os datos coñecidos. O pendente queda marcado para non inventar contido." },
      referencias: { label: "Referencias", title: "Pregos de referencia", subtitle: "Selección automática de modelos e pregos similares, sempre marcados como referencia externa." },
      indice: { label: "Índice", title: "Índice do PPT", subtitle: "Revisa a estrutura antes de redactar capítulos con llm2." },
      redaccion: { label: "Redacción", title: "Redacción por capítulos", subtitle: "Xera, edita e versiona cada capítulo con contexto controlado e fontes trazables." },
      validacion: { label: "Validación", title: "Revisión do borrador", subtitle: "Comproba coherencia, pendentes e impactos antes de exportar." },
      fuentes: { label: "Fontes", title: "Fontes e exportación", subtitle: "Revisa evidencias, auditoría e xera o DOCX do expediente." },
      ajustes: { label: "Axustes", title: "Axustes", subtitle: "Xestiona modelos reutilizables e parámetros preparados para o sistema." }
    },
    new: "Novo expediente",
    active: "Expediente activo",
    save: "Gardar metadatos",
    archive: "Arquivar",
    restore: "Restaurar",
    answer: "Gardar resposta",
    references: "Buscar referencias automaticamente",
    proposeIndex: "Propor índice PPT",
    validateIndex: "Confirmar estrutura",
    draftChapter: "Redactar con llm2",
    saveChapter: "Gardar edición",
    impacts: "Ver impactos",
    export: "Exportar DOCX",
    source: "Abrir fonte",
    powered: "powered by",
    ai: "Sistema IA con validación humana",
    searchPlaceholder: "Buscar por código, título, unidade, CPV ou significado",
    semanticSearch: "Busca semántica BGE-M3",
    textSearch: "Busca textual",
    previous: "Anterior",
    nextPage: "Seguinte",
    pageOf: "Páxina",
    perPage: "10 por páxina"
  },
  eu: {
    nav: {
      expedientes: "Espedienteak",
      categoria1: "Prestaketa aurreratua",
      elicit: "Prestaketa",
      referencias: "Erreferentziak",
      indice: "Aurkibidea",
      redaccion: "Idazketa",
      validacion: "Balidazioa",
      fuentes: "Iturriak/Esportazioa",
      ajustes: "Ezarpenak"
    },
    headings: {
      expedientes: { label: "Espedienteak", title: "Espedienteen kudeaketa", subtitle: "Bilatu, sortu, hautatu, metadatuak editatu eta artxibatu trazabilitatea galdu gabe." },
      categoria1: { label: "Prestaketa aurreratua", title: "Kontratuen prestaketa adimenduna", subtitle: "Plangintza, merkatu-azterketak, iturri ofizialak, kalkulu ekonomikoa, arriskuak, epeak eta betetzea." },
      elicit: { label: "Prestaketa", title: "PPTaren hasierako fitxa", subtitle: "Ezagutzen diren datuak bakarrik bete. Falta dena markatuta geratzen da." },
      referencias: { label: "Erreferentziak", title: "Erreferentziazko pleguak", subtitle: "Txantiloi eta antzeko pleguen hautaketa automatikoa, beti kanpoko erreferentzia gisa." },
      indice: { label: "Aurkibidea", title: "PPTaren aurkibidea", subtitle: "Egitura berrikusi llm2rekin kapituluak idatzi aurretik." },
      redaccion: { label: "Idazketa", title: "Kapituluen idazketa", subtitle: "Sortu, editatu eta bertsionatu kapituluak testuinguru kontrolatuarekin eta iturri trazagarriekin." },
      validacion: { label: "Balidazioa", title: "Zirriborroaren berrikuspena", subtitle: "Koherentzia, hutsuneak eta eraginak egiaztatu esportatu aurretik." },
      fuentes: { label: "Iturriak", title: "Iturriak eta esportazioa", subtitle: "Ebidentziak, auditoria eta espedientearen DOCX esportazioa berrikusi." },
      ajustes: { label: "Ezarpenak", title: "Ezarpenak", subtitle: "Txantiloi berrerabilgarriak eta sistemarako parametroak kudeatu." }
    },
    new: "Espediente berria",
    active: "Espediente aktiboa",
    save: "Metadatuak gorde",
    archive: "Artxibatu",
    restore: "Leheneratu",
    answer: "Erantzuna gorde",
    references: "Bilatu erreferentziak automatikoki",
    proposeIndex: "Proposatu PPT aurkibidea",
    validateIndex: "Egitura berretsi",
    draftChapter: "Idatzi llm2rekin",
    saveChapter: "Gorde edizioa",
    impacts: "Ikusi eraginak",
    export: "Esportatu DOCX",
    source: "Ireki iturria",
    powered: "powered by",
    ai: "Giza balidazioa duen IA sistema",
    searchPlaceholder: "Bilatu kodea, izenburua, unitatea, CPV edo esanahia",
    semanticSearch: "BGE-M3 bilaketa semantikoa",
    textSearch: "Testu bilaketa",
    previous: "Aurrekoa",
    nextPage: "Hurrengoa",
    pageOf: "Orria",
    perPage: "10 orriko"
  }
};

type CaptionSet = {
  labels: Record<string, string>;
  fields: Record<string, string>;
  questions: Record<string, string>;
  tips: Record<string, string>;
  nextActions: Record<string, { title: string; detail: string }>;
  validation: Record<string, string>;
  statuses: Record<string, string>;
};

type MetadataDraft = {
  file_number: string;
  title: string;
  unit: string;
  contracting_body: string;
  promoting_unit: string;
  object: string;
  need: string;
  budget: string;
  estimated_value: string;
  tax_rate: string;
  funding: string;
  cpv: string;
  cpv_codes: string[];
  contract_type: string;
  procedure: string;
  duration: string;
  extensions: string;
  contract_manager: string;
  data_protection: string;
  confidentiality: string;
  intellectual_property: string;
  publication_date: string;
  submission_deadline: string;
  award_date: string;
  formalization_date: string;
  start_date: string;
  end_date: string;
  lots: string;
};

const metadataFieldCopy: Record<Locale, Record<string, string>> = {
  es: {
    organization: "Organización y responsabilidad",
    contractingBody: "Órgano de contratación",
    promotingUnit: "Unidad promotora (denominación formal)",
    need: "Necesidad que se pretende satisfacer",
    economics: "Datos económicos y financiación",
    taxRate: "IVA aplicable (%)",
    funding: "Financiación e impacto presupuestario",
    extensions: "Prórrogas previstas",
    contractManager: "Responsable del contrato",
    safeguards: "Protección y titularidad de la información",
    dataProtection: "Protección de datos",
    confidentiality: "Confidencialidad",
    intellectualProperty: "Propiedad intelectual"
  },
  ca: {
    organization: "Organització i responsabilitat",
    contractingBody: "Òrgan de contractació",
    promotingUnit: "Unitat promotora (denominació formal)",
    need: "Necessitat que es pretén satisfer",
    economics: "Dades econòmiques i finançament",
    taxRate: "IVA aplicable (%)",
    funding: "Finançament i impacte pressupostari",
    extensions: "Pròrrogues previstes",
    contractManager: "Responsable del contracte",
    safeguards: "Protecció i titularitat de la informació",
    dataProtection: "Protecció de dades",
    confidentiality: "Confidencialitat",
    intellectualProperty: "Propietat intel·lectual"
  },
  va: {
    organization: "Organització i responsabilitat",
    contractingBody: "Òrgan de contractació",
    promotingUnit: "Unitat promotora (denominació formal)",
    need: "Necessitat que es pretén satisfer",
    economics: "Dades econòmiques i finançament",
    taxRate: "IVA aplicable (%)",
    funding: "Finançament i impacte pressupostari",
    extensions: "Pròrrogues previstes",
    contractManager: "Responsable del contracte",
    safeguards: "Protecció i titularitat de la informació",
    dataProtection: "Protecció de dades",
    confidentiality: "Confidencialitat",
    intellectualProperty: "Propietat intel·lectual"
  },
  gl: {
    organization: "Organización e responsabilidade",
    contractingBody: "Órgano de contratación",
    promotingUnit: "Unidade promotora (denominación formal)",
    need: "Necesidade que se pretende satisfacer",
    economics: "Datos económicos e financiamento",
    taxRate: "IVE aplicable (%)",
    funding: "Financiamento e impacto orzamentario",
    extensions: "Prórrogas previstas",
    contractManager: "Responsable do contrato",
    safeguards: "Protección e titularidade da información",
    dataProtection: "Protección de datos",
    confidentiality: "Confidencialidade",
    intellectualProperty: "Propiedade intelectual"
  },
  eu: {
    organization: "Antolaketa eta erantzukizuna",
    contractingBody: "Kontratazio-organoa",
    promotingUnit: "Unitate sustatzailea (izen formalarekin)",
    need: "Bete nahi den beharra",
    economics: "Datu ekonomikoak eta finantzaketa",
    taxRate: "Aplikatu beharreko BEZa (%)",
    funding: "Finantzaketa eta aurrekontu-eragina",
    extensions: "Aurreikusitako luzapenak",
    contractManager: "Kontratuaren arduraduna",
    safeguards: "Informazioaren babesa eta titulartasuna",
    dataProtection: "Datuen babesa",
    confidentiality: "Konfidentzialtasuna",
    intellectualProperty: "Jabetza intelektuala"
  }
};

type TemplateUploadDraft = {
  name: string;
  document_type: string;
  language: string;
  tags: string;
  notes?: string;
};

const templateDocumentTypes = [
  { value: "ppt", label: "PPT" },
  { value: "pcap", label: "PCAP" },
  { value: "informe_necesidad", label: "Informe de necesidad" },
  { value: "otros", label: "Otros" }
];

function templateDocumentTypeLabel(value?: string | null) {
  const normalized = (value || "").toLowerCase();
  return templateDocumentTypes.find((type) => type.value === normalized)?.label ?? (value || "PPT").toUpperCase();
}

const templateUi: Record<Locale, Record<string, string>> = {
  es: {
    templatesTab: "Plantillas",
    systemTab: "Sistema",
    repositoryTitle: "Repositorio de plantillas",
    repositoryCopy: "Gestiona guías internas reutilizables. Sirven para estructura y estilo; no se copian literalmente.",
    uploadTemplate: "Subir plantilla",
    createTemplate: "Crear plantilla Markdown",
    searchPlaceholder: "Buscar por nombre, tipo o etiquetas",
    statusAll: "Todos los estados",
    typeAll: "Todos los tipos",
    active: "Activas",
    archived: "Archivadas",
    processing: "Procesando",
    error: "Error",
    noTemplates: "No hay plantillas con esos filtros.",
    detailsTitle: "Detalle de plantilla",
    noTemplateSelected: "Selecciona una plantilla para revisar su índice.",
    sections: "Secciones detectadas",
    noSections: "No se han detectado secciones todavía.",
    archive: "Archivar",
    restore: "Restaurar",
    process: "Procesar",
    version: "Versión activa",
    sourceFile: "Fichero",
    language: "Idioma",
    tags: "Etiquetas",
    name: "Nombre",
    documentType: "Tipo documental",
    chooseFile: "PDF, DOCX u ODT",
    upload: "Subir",
    templateStepTitle: "Plantilla del expediente",
    templateInternalTip: "La plantilla guía estructura y estilo; no se copia literalmente.",
    referenceDifferenceTip: "Los pliegos de referencia son ejemplos externos; las plantillas son guías internas.",
    linkedTemplates: "Plantillas vinculadas",
    noLinkedTemplates: "Aún no hay plantilla vinculada.",
    chooseFromRepository: "Elegir del repositorio",
    uploadForWorkspace: "Subir para este expediente",
    removeTemplate: "Quitar plantilla",
    notesLabel: "Notas e indicaciones específicas",
    notesPlaceholder: "Ej.: respetar el índice municipal, mantener tono administrativo sobrio...",
    selectTemplate: "Selecciona una plantilla",
    linkTemplate: "Vincular plantilla",
    openSettings: "Abrir Ajustes > Plantillas",
    systemTitle: "Sistema",
    systemCopy: "Espacio preparado para parámetros técnicos, modelos e integraciones."
  },
  ca: {
    templatesTab: "Plantilles",
    systemTab: "Sistema",
    repositoryTitle: "Repositori de plantilles",
    repositoryCopy: "Gestiona guies internes reutilitzables. Serveixen per a estructura i estil; no es copien literalment.",
    uploadTemplate: "Pujar plantilla",
    createTemplate: "Crear plantilla Markdown",
    searchPlaceholder: "Cercar per nom, tipus o etiquetes",
    statusAll: "Tots els estats",
    typeAll: "Tots els tipus",
    active: "Actives",
    archived: "Arxivades",
    processing: "Processant",
    error: "Error",
    noTemplates: "No hi ha plantilles amb aquests filtres.",
    detailsTitle: "Detall de plantilla",
    noTemplateSelected: "Selecciona una plantilla per revisar-ne l'índex.",
    sections: "Seccions detectades",
    noSections: "Encara no s'han detectat seccions.",
    archive: "Arxivar",
    restore: "Restaurar",
    process: "Processar",
    version: "Versió activa",
    sourceFile: "Fitxer",
    language: "Idioma",
    tags: "Etiquetes",
    name: "Nom",
    documentType: "Tipus documental",
    chooseFile: "PDF, DOCX o ODT",
    upload: "Pujar",
    templateStepTitle: "Plantilla de l'expedient",
    templateInternalTip: "La plantilla guia estructura i estil; no es copia literalment.",
    referenceDifferenceTip: "Els plecs de referència són exemples externs; les plantilles són guies internes.",
    linkedTemplates: "Plantilles vinculades",
    noLinkedTemplates: "Encara no hi ha cap plantilla vinculada.",
    chooseFromRepository: "Triar del repositori",
    uploadForWorkspace: "Pujar per a aquest expedient",
    removeTemplate: "Treure plantilla",
    notesLabel: "Notes i indicacions específiques",
    notesPlaceholder: "Ex.: respectar l'índex municipal, mantenir un to administratiu sobri...",
    selectTemplate: "Selecciona una plantilla",
    linkTemplate: "Vincular plantilla",
    openSettings: "Obrir Ajustos > Plantilles",
    systemTitle: "Sistema",
    systemCopy: "Espai preparat per a paràmetres tècnics, models i integracions."
  },
  va: {
    templatesTab: "Plantilles",
    systemTab: "Sistema",
    repositoryTitle: "Repositori de plantilles",
    repositoryCopy: "Gestiona guies internes reutilitzables. Servixen per a estructura i estil; no es copien literalment.",
    uploadTemplate: "Pujar plantilla",
    createTemplate: "Crear plantilla Markdown",
    searchPlaceholder: "Buscar per nom, tipus o etiquetes",
    statusAll: "Tots els estats",
    typeAll: "Tots els tipus",
    active: "Actives",
    archived: "Arxivades",
    processing: "Processant",
    error: "Error",
    noTemplates: "No hi ha plantilles amb estos filtres.",
    detailsTitle: "Detall de plantilla",
    noTemplateSelected: "Selecciona una plantilla per a revisar-ne l'índex.",
    sections: "Seccions detectades",
    noSections: "Encara no s'han detectat seccions.",
    archive: "Arxivar",
    restore: "Restaurar",
    process: "Processar",
    version: "Versió activa",
    sourceFile: "Fitxer",
    language: "Idioma",
    tags: "Etiquetes",
    name: "Nom",
    documentType: "Tipus documental",
    chooseFile: "PDF, DOCX o ODT",
    upload: "Pujar",
    templateStepTitle: "Plantilla de l'expedient",
    templateInternalTip: "La plantilla guia estructura i estil; no es copia literalment.",
    referenceDifferenceTip: "Els plecs de referència són exemples externs; les plantilles són guies internes.",
    linkedTemplates: "Plantilles vinculades",
    noLinkedTemplates: "Encara no hi ha cap plantilla vinculada.",
    chooseFromRepository: "Triar del repositori",
    uploadForWorkspace: "Pujar per a este expedient",
    removeTemplate: "Llevar plantilla",
    notesLabel: "Notes i indicacions específiques",
    notesPlaceholder: "Ex.: respectar l'índex municipal, mantindre un to administratiu sobri...",
    selectTemplate: "Selecciona una plantilla",
    linkTemplate: "Vincular plantilla",
    openSettings: "Obrir Ajustos > Plantilles",
    systemTitle: "Sistema",
    systemCopy: "Espai preparat per a paràmetres tècnics, models i integracions."
  },
  gl: {
    templatesTab: "Modelos",
    systemTab: "Sistema",
    repositoryTitle: "Repositorio de modelos",
    repositoryCopy: "Xestiona guías internas reutilizables. Serven para estrutura e estilo; non se copian literalmente.",
    uploadTemplate: "Subir modelo",
    createTemplate: "Crear modelo Markdown",
    searchPlaceholder: "Buscar por nome, tipo ou etiquetas",
    statusAll: "Todos os estados",
    typeAll: "Todos os tipos",
    active: "Activos",
    archived: "Arquivados",
    processing: "Procesando",
    error: "Erro",
    noTemplates: "Non hai modelos con eses filtros.",
    detailsTitle: "Detalle do modelo",
    noTemplateSelected: "Selecciona un modelo para revisar o seu índice.",
    sections: "Seccións detectadas",
    noSections: "Aínda non se detectaron seccións.",
    archive: "Arquivar",
    restore: "Restaurar",
    process: "Procesar",
    version: "Versión activa",
    sourceFile: "Ficheiro",
    language: "Idioma",
    tags: "Etiquetas",
    name: "Nome",
    documentType: "Tipo documental",
    chooseFile: "PDF, DOCX ou ODT",
    upload: "Subir",
    templateStepTitle: "Modelo do expediente",
    templateInternalTip: "O modelo guía estrutura e estilo; non se copia literalmente.",
    referenceDifferenceTip: "Os pregos de referencia son exemplos externos; os modelos son guías internas.",
    linkedTemplates: "Modelos vinculados",
    noLinkedTemplates: "Aínda non hai modelo vinculado.",
    chooseFromRepository: "Escoller do repositorio",
    uploadForWorkspace: "Subir para este expediente",
    removeTemplate: "Quitar modelo",
    notesLabel: "Notas e indicacións específicas",
    notesPlaceholder: "Ex.: respectar o índice municipal, manter ton administrativo sobrio...",
    selectTemplate: "Selecciona un modelo",
    linkTemplate: "Vincular modelo",
    openSettings: "Abrir Axustes > Modelos",
    systemTitle: "Sistema",
    systemCopy: "Espazo preparado para parámetros técnicos, modelos e integracións."
  },
  eu: {
    templatesTab: "Txantiloiak",
    systemTab: "Sistema",
    repositoryTitle: "Txantiloien biltegia",
    repositoryCopy: "Barne gida berrerabilgarriak kudeatu. Egitura eta estiloa gidatzen dute; ez dira hitzez hitz kopiatzen.",
    uploadTemplate: "Igo txantiloia",
    createTemplate: "Sortu Markdown txantiloia",
    searchPlaceholder: "Bilatu izena, mota edo etiketak",
    statusAll: "Egoera guztiak",
    typeAll: "Mota guztiak",
    active: "Aktiboak",
    archived: "Artxibatuak",
    processing: "Prozesatzen",
    error: "Errorea",
    noTemplates: "Ez dago iragazki horietako txantiloirik.",
    detailsTitle: "Txantiloiaren xehetasuna",
    noTemplateSelected: "Hautatu txantiloi bat aurkibidea berrikusteko.",
    sections: "Detektatutako atalak",
    noSections: "Oraindik ez da atalik detektatu.",
    archive: "Artxibatu",
    restore: "Leheneratu",
    process: "Prozesatu",
    version: "Bertsio aktiboa",
    sourceFile: "Fitxategia",
    language: "Hizkuntza",
    tags: "Etiketak",
    name: "Izena",
    documentType: "Dokumentu mota",
    chooseFile: "PDF, DOCX edo ODT",
    upload: "Igo",
    templateStepTitle: "Espedientearen txantiloia",
    templateInternalTip: "Txantiloiak egitura eta estiloa gidatzen ditu; ez da hitzez hitz kopiatzen.",
    referenceDifferenceTip: "Erreferentziazko pleguak kanpoko adibideak dira; txantiloiak barne gidak dira.",
    linkedTemplates: "Lotutako txantiloiak",
    noLinkedTemplates: "Oraindik ez dago lotutako txantiloirik.",
    chooseFromRepository: "Aukeratu biltegitik",
    uploadForWorkspace: "Igo espediente honetarako",
    removeTemplate: "Kendu txantiloia",
    notesLabel: "Ohar eta jarraibide zehatzak",
    notesPlaceholder: "Adib.: udal aurkibidea errespetatu, tonu administratibo soila mantendu...",
    selectTemplate: "Hautatu txantiloia",
    linkTemplate: "Lotu txantiloia",
    openSettings: "Ireki Ezarpenak > Txantiloiak",
    systemTitle: "Sistema",
    systemCopy: "Parametro teknikoak, ereduak eta integrazioak prestatzeko espazioa."
  }
};

const captions: Record<Locale, CaptionSet> = {
  es: {
    labels: {
      navAria: "Navegación principal",
      checkingLlm: "Comprobando llm2...",
      llmUnavailable: "No se puede consultar llm2",
      llmReachable: "llm2 accesible",
      llmNotReachable: "llm2 no accesible",
      modelConfigured: "modelo configurado",
      noResponse: "sin respuesta",
      working: "Trabajando: {task}",
      newWorkspaceTitle: "Nuevo expediente asistido",
      pendingUnit: "Unidad promotora pendiente",
      languageTooltip: "Cambia el idioma de la interfaz y de la redacción IA. Las citas se conservan en su idioma original.",
      audit: "Auditoría",
      admin: "Admin",
      searchTooltip: "Busca coincidencias exactas y, si BGE-M3 está disponible, expedientes con significado parecido.",
      includeArchivedTooltip: "Muestra expedientes archivados sin restaurarlos.",
      includeArchived: "Ver archivados",
      workspacesPanel: "Expedientes",
      unitPending: "Unidad pendiente",
      cpvPending: "CPV pendiente",
      restoreTooltip: "Devuelve el expediente al trabajo normal.",
      noWorkspaces: "No hay expedientes con esos filtros.",
      paginationAria: "Paginación de expedientes",
      requiredCompletion: "Obligatorios",
      requiredCompletionTooltip: "Porcentaje de campos obligatorios ya rellenados: ficha inicial, metadatos, CPV, procedimiento y fechas.",
      metadataPanel: "Metadatos del expediente activo",
      metadataNewPanel: "Ficha del nuevo expediente",
      metadataUnsaved: "Cambios sin guardar",
      createWorkspaceButton: "Crear expediente",
      cancel: "Cancelar",
      unsavedTitle: "Hay cambios pendientes",
      unsavedText: "Antes de cambiar de expediente, decide qué hacer con la ficha que está abierta.",
      guidedUnsavedTitle: "Respuesta sin guardar",
      guidedUnsavedText: "Antes de cambiar de paso, pestaña o idioma, guarda la respuesta activa o decide continuar sin guardarla.",
      saveAndContinue: "Guardar y cambiar",
      discardAndContinue: "Cambiar sin guardar",
      keepEditing: "Seguir editando",
      fileNumber: "Número de expediente",
      title: "Título",
      unit: "Unidad promotora",
      object: "Objeto",
      need: "Necesidad",
      budget: "Presupuesto (EUR, sin IVA)",
      estimatedValue: "VEC (EUR, sin IVA)",
      cpv: "CPV",
      cpvSearch: "Buscar CPV",
      cpvSearchPlaceholder: "Busca por código o significado: pellets, software, limpieza...",
      selectedCpvs: "CPV seleccionados",
      noCpvSuggestions: "No hay CPV candidatos con ese texto.",
      cpvSource: "Catálogo CPV 2008 TED/SIMAP",
      removeCpv: "Quitar CPV",
      contractType: "Tipo de contrato",
      procedure: "Procedimiento",
      duration: "Duración",
      dates: "Fechas previstas",
      fillTypicalDates: "Rellenar fechas tipo",
      publicationDate: "Publicación",
      submissionDeadline: "Fin de presentación",
      awardDate: "Adjudicación",
      formalizationDate: "Formalización",
      startDate: "Inicio",
      endDate: "Fin",
      lots: "Lotes",
      prepPanel: "Ficha inicial",
      prepIntro: "Pasos adaptados al tipo documental. Completa uno, guarda y avanza.",
      saved: "Guardado",
      pending: "Pendiente",
      stepOf: "Paso {current} de {total}",
      guideTitle: "Guía paso a paso",
      guideOne: "Lee la pregunta activa.",
      guideTwo: "Escribe una respuesta normal o pulsa Generar con IA.",
      guideThree: "Guarda y avanza. Lo pendiente se marca para no inventar contenido.",
      completeQuestion: "La ficha inicial ya tiene una base suficiente.",
      answerPlaceholder: "Ejemplo: servicio de plataforma IA para preparar pliegos con supervisión humana...",
      suggestEnabled: "Propone una respuesta breve para este dato usando llm2 y el objeto contractual como base.",
      suggestBlocked: "Primero escribe el servicio, suministro u obra que se quiere contratar.",
      generateAi: "Generar con IA",
      guidedStreaming: "llm2 está escribiendo la respuesta...",
      expandDetail: "Aumentar detalle",
      expandEnabled: "Amplía el texto actual con más detalle en el idioma seleccionado.",
      expandBlocked: "Escribe una base mínima antes de aumentar el detalle.",
      expandBlockedTooltip: "Escribe al menos {count} palabras para poder aumentar el detalle.",
      saveAnswerShort: "Guardar",
      summary: "Resumen",
      responses: "{count} respuestas",
      noAnswers: "Aún no hay respuestas guardadas.",
      referencesPanel: "Referencias automáticas",
      queryIn: "sin filtro CPV/idioma",
      referencesCopy: "La búsqueda devuelve hasta 15 pliegos completos similares, sin filtrar por CPV ni idioma. Marca las fuentes que quieras usar; los chunks quedan como apoyo interno trazable.",
      searchableCorpus: "{ppt} PPT buscables · {documents} documentos totales · {chunks} chunks",
      searchableCorpusTooltip: "Documentos disponibles en la base de conocimiento para comparar por similitud semántica.",
      referencesTooltip: "Extrae la idea esencial del expediente, busca los 15 pliegos PPT más parecidos y conserva sus chunks solo para ayudar a redactar e inferir índice.",
      useReference: "Usar fuente",
      selectedReference: "Fuente marcada para redactar",
      unselectedReference: "No se usará al redactar",
      referenceScore: "Similitud relativa",
      referenceScoreTooltip: "Ranking relativo de parecido frente a las demás referencias encontradas. No es calidad jurídica ni completitud.",
      sourceTooltip: "Abre la fuente antes de reutilizarla.",
      noReferences: "Pulsa buscar referencias automáticamente. Se buscará por significado, sin depender del CPV.",
      indexPanel: "Índice PPT propuesto",
      validated: "confirmado",
      required: "obligatorio",
      recommended: "recomendable",
      chapterPending: "pendientes: {count}",
      indexEmpty: "Pulsa \"{action}\" cuando tengas una primera ficha del expediente.",
      whyValidateTitle: "Antes de redactar",
      whyValidateCopy: "xTender no redacta el PPT entero de golpe. Primero propone estructura y campos pendientes. Una persona confirma la estructura y luego se redacta capítulo a capítulo.",
      expediente: "Expediente",
      document: "Documento",
      firstPpt: "PPT primero",
      validation: "Validación",
      humanRegistered: "humana registrada",
      chaptersPanel: "Capítulos",
      noDraft: "Sin redactar",
      editorDefault: "Editor por capítulos",
      output: "Salida {lang}",
      editorCopy: "Al redactar, xTender envía a llm2 la ficha del expediente, la estructura confirmada, capítulos ya escritos y referencias externas marcadas como referencia. El capítulo se redacta en el idioma seleccionado arriba.",
      streaming: "llm2 está escribiendo el capítulo...",
      previewAria: "Vista previa del capítulo",
      markdownTitle: "Fuente Markdown",
      selectedChars: "{count} caracteres seleccionados",
      editorVisualTitle: "Editor visual",
      editorToolbar: "Herramientas de formato del capítulo",
      markdownToggle: "Markdown",
      markdownShowTooltip: "Muestra la fuente Markdown para ajustes finos.",
      markdownHideTooltip: "Oculta la fuente Markdown y vuelve al editor visual.",
      toolbarBold: "Negrita",
      toolbarItalic: "Cursiva",
      toolbarHeading2: "Título",
      toolbarHeading3: "Subtítulo",
      toolbarBulletList: "Lista con viñetas",
      toolbarOrderedList: "Lista numerada",
      toolbarQuote: "Cita",
      toolbarLink: "Enlace",
      toolbarLinkPrompt: "Pega la URL del enlace",
      toolbarTable: "Tabla",
      toolbarClear: "Limpiar formato",
      customInstructionLabel: "Prompt específico para mejorar (ej.: mejora el 2.1 con criterios medibles)",
      customInstructionPlaceholder: "Ej.: hazlo más técnico, añade criterios medibles, reduce ambigüedad...",
      customInstructionTooltip: "Se aplica al botón Generar. Si hay texto seleccionado, solo cambia ese fragmento.",
      generatePrompt: "Generar",
      chapterPlaceholder: "Genera o escribe el capítulo aquí...",
      draftTooltip: "Llama a llm2 con contexto del expediente y capítulos de referencia etiquetados como externos.",
      improveSelectionTooltip: "Mejora solo el texto seleccionado en {lang}.",
      improveChapterTooltip: "Añade más detalle al capítulo completo en {lang}.",
      undoText: "Volver atrás",
      redoText: "Ir hacia delante",
      impactsPanel: "Impactos propuestos",
      impactsCopy: "Si cambias presupuesto, duración, lotes, CPV o datos, el sistema te avisa de capítulos que conviene revisar.",
      impactsEmpty: "Pulsa Ver impactos después de editar un capítulo.",
      markdownEmpty: "El capítulo renderizado aparecerá aquí mientras llm2 escribe o cuando pegues Markdown.",
      validationPanel: "Validación para dummies",
      exportPanel: "Exportación",
      exportCopy: "Exporta el borrador trazable. Si SeaweedFS está configurado, queda almacenado como artefacto del expediente.",
      acceptedSources: "Fuentes aceptadas",
      recentAudit: "Auditoría reciente",
      noAudit: "Todavía no hay eventos para este expediente.",
      pendingValue: "pendiente",
      budgetWithoutVat: "{value} EUR sin IVA",
      improveSelectionInstruction: "Mejora y añade más detalle al fragmento seleccionado.",
      improveChapterInstruction: "Añade más detalle al capítulo manteniendo su estructura.",
      improveBlocked: "No se puede mejorar este texto todavía.",
      suggestBlockedGeneric: "No se puede sugerir este dato todavía.",
      apiError: "api_error"
    },
    fields: {
      object: "Objeto contractual",
      need: "Necesidad pública",
      included: "Prestaciones incluidas",
      excluded: "Prestaciones excluidas",
      outcome: "Resultado esperado",
      budget: "Presupuesto (EUR, sin IVA)",
      duration: "Duración",
      lots: "Lotes",
      template: "Plantilla",
      language: "Idioma",
      security: "Seguridad y datos",
      references: "Referencias a usar o evitar"
    },
    questions: {
      object: "¿Qué servicio, suministro u obra se quiere contratar?",
      need: "¿Cuál es la necesidad pública o administrativa que lo justifica?",
      included: "¿Qué prestaciones deben quedar incluidas?",
      excluded: "¿Qué prestaciones deben quedar expresamente fuera?",
      outcome: "¿Qué resultado debe conseguir el contrato?",
      budget: "¿Cuál es el presupuesto en EUR, sin IVA?",
      duration: "¿Qué duración inicial y prórrogas se prevén?",
      lots: "¿Debe dividirse en lotes o se quiere analizar esa decisión?",
      template: "¿Existe una plantilla de la entidad que deba respetarse?",
      language: "¿El documento final debe redactarse en castellano, catalán, valenciano, gallego, euskera o varios idiomas?",
      security: "¿Hay requisitos de seguridad, datos personales, interoperabilidad o integración?",
      references: "¿Hay ejemplos de contratos anteriores que se quieran usar o evitar?",
      fallback: "¿Qué dato quieres aportar ahora?"
    },
    tips: {
      activeWorkspace: "Todo lo que hagas se guarda en este expediente. Cámbialo aquí antes de editar.",
      create: "Crea un expediente borrador con campos incompletos. Lo puedes completar poco a poco.",
      archive: "No borra nada. Oculta el expediente normal y conserva historial, versiones y auditoría.",
      prep: "Completa la ficha sin tecnicismos. Si no sabes algo, escribe pendiente y el sistema lo marcará.",
      export: "Genera un DOCX trazable. Los borradores no son definitivos sin validación humana.",
      audit: "Abre el registro de acciones, validaciones, cambios y exportaciones.",
      admin: "Configuración, idiomas, plantillas, roles y parámetros de IA."
    },
    nextActions: {
      noWorkspace: { title: "Crea un expediente para empezar", detail: "Nuevo expediente" },
      completePrep: { title: "Completa la ficha inicial", detail: "Responde solo lo imprescindible" },
      references: { title: "Busca referencias automáticamente", detail: "El sistema selecciona pliegos similares" },
      index: { title: "Propón el índice del PPT", detail: "Antes de redactar" },
      validate: { title: "Confirma la estructura", detail: "Control humano obligatorio" },
      draft: { title: "Redacta el primer capítulo", detail: "Capítulo a capítulo" },
      export: { title: "Revisa impactos y exporta", detail: "Borrador DOCX trazable" }
    },
    validation: {
      indexTitle: "Estructura pendiente de confirmar",
      indexOk: "Estructura confirmada.",
      indexText: "Confirma la estructura antes de redactar capítulos definitivos.",
      chaptersTitle: "Capítulos sin versión",
      chaptersText: "{count} capítulos aún sin borrador.",
      exportTitle: "Exportación trazable",
      exportText: "El DOCX debe indicar que es borrador si hay capítulos sin validar.",
      redaction: "Redacción",
      export: "Exportación"
    },
    statuses: {
      borrador: "borrador",
      en_preparacion: "en preparación",
      en_revision: "en revisión",
      validado: "validado",
      exportado: "exportado",
      archivado: "archivado",
      aceptada: "aceptada",
      pendiente: "pendiente",
      fijada: "fijada"
    }
  },
  ca: {
    labels: {
      navAria: "Navegació principal",
      checkingLlm: "Comprovant llm2...",
      llmUnavailable: "No es pot consultar llm2",
      llmReachable: "llm2 accessible",
      llmNotReachable: "llm2 no accessible",
      modelConfigured: "model configurat",
      noResponse: "sense resposta",
      working: "Treballant: {task}",
      newWorkspaceTitle: "Nou expedient assistit",
      pendingUnit: "Unitat promotora pendent",
      languageTooltip: "Canvia l'idioma de la interfície i de la redacció IA. Les cites es conserven en l'idioma original.",
      audit: "Auditoria",
      admin: "Admin",
      searchTooltip: "Cerca coincidències exactes i, si BGE-M3 està disponible, expedients amb significat semblant.",
      includeArchivedTooltip: "Mostra expedients arxivats sense restaurar-los.",
      includeArchived: "Veure arxivats",
      workspacesPanel: "Expedients",
      unitPending: "Unitat pendent",
      cpvPending: "CPV pendent",
      restoreTooltip: "Retorna l'expedient al treball normal.",
      noWorkspaces: "No hi ha expedients amb aquests filtres.",
      paginationAria: "Paginació d'expedients",
      requiredCompletion: "Obligatoris",
      requiredCompletionTooltip: "Percentatge de camps obligatoris ja emplenats: fitxa inicial, metadades, CPV, procediment i dates.",
      metadataPanel: "Metadades de l'expedient actiu",
      metadataNewPanel: "Fitxa del nou expedient",
      metadataUnsaved: "Canvis sense desar",
      createWorkspaceButton: "Crear expedient",
      cancel: "Cancel·lar",
      unsavedTitle: "Hi ha canvis pendents",
      unsavedText: "Abans de canviar d'expedient, decideix què vols fer amb la fitxa oberta.",
      guidedUnsavedTitle: "Resposta sense desar",
      guidedUnsavedText: "Abans de canviar de pas, pestanya o idioma, desa la resposta activa o decideix continuar sense desar-la.",
      saveAndContinue: "Desar i canviar",
      discardAndContinue: "Canviar sense desar",
      keepEditing: "Continuar editant",
      fileNumber: "Número d'expedient",
      title: "Títol",
      unit: "Unitat promotora",
      object: "Objecte",
      need: "Necessitat",
      budget: "Pressupost (EUR, sense IVA)",
      estimatedValue: "VEC (EUR, sense IVA)",
      cpv: "CPV",
      cpvSearch: "Cercar CPV",
      cpvSearchPlaceholder: "Cerca per codi o significat: pèl·lets, programari, neteja...",
      selectedCpvs: "CPV seleccionats",
      noCpvSuggestions: "No hi ha CPV candidats amb aquest text.",
      cpvSource: "Catàleg CPV 2008 TED/SIMAP",
      removeCpv: "Treure CPV",
      contractType: "Tipus de contracte",
      procedure: "Procediment",
      duration: "Durada",
      dates: "Dates previstes",
      fillTypicalDates: "Omplir dates tipus",
      publicationDate: "Publicació",
      submissionDeadline: "Fi de presentació",
      awardDate: "Adjudicació",
      formalizationDate: "Formalització",
      startDate: "Inici",
      endDate: "Fi",
      lots: "Lots",
      prepPanel: "Fitxa inicial",
      prepIntro: "Passos adaptats al tipus documental. Completa'n un, desa i avança.",
      saved: "Desat",
      pending: "Pendent",
      stepOf: "Pas {current} de {total}",
      guideTitle: "Guia pas a pas",
      guideOne: "Llegeix la pregunta activa.",
      guideTwo: "Escriu una resposta normal o prem Generar amb IA.",
      guideThree: "Desa i avança. El que queda pendent es marca per no inventar contingut.",
      completeQuestion: "La fitxa inicial ja té una base suficient.",
      answerPlaceholder: "Exemple: servei de plataforma IA per preparar plecs amb supervisió humana...",
      suggestEnabled: "Proposa una resposta breu per a aquesta dada amb llm2 i l'objecte contractual com a base.",
      suggestBlocked: "Primer escriu el servei, subministrament o obra que es vol contractar.",
      generateAi: "Generar amb IA",
      guidedStreaming: "llm2 està escrivint la resposta...",
      expandDetail: "Augmentar detall",
      expandEnabled: "Amplia el text actual amb més detall en l'idioma seleccionat.",
      expandBlocked: "Escriu una base mínima abans d'augmentar el detall.",
      expandBlockedTooltip: "Escriu almenys {count} paraules per poder augmentar el detall.",
      saveAnswerShort: "Desar",
      summary: "Resum",
      responses: "{count} respostes",
      noAnswers: "Encara no hi ha respostes desades.",
      referencesPanel: "Referències automàtiques",
      queryIn: "sense filtre CPV/idioma",
      referencesCopy: "La cerca retorna fins a 15 plecs complets similars, sense filtrar per CPV ni idioma. Marca les fonts que vulguis usar; els chunks queden com a suport intern traçable.",
      searchableCorpus: "{ppt} PPT cercables · {documents} documents totals · {chunks} chunks",
      searchableCorpusTooltip: "Documents disponibles a la base de coneixement per comparar per similitud semàntica.",
      referencesTooltip: "Extreu la idea essencial de l'expedient, cerca els 15 plecs PPT més semblants i conserva els seus chunks només per ajudar a redactar i inferir índex.",
      useReference: "Usar font",
      selectedReference: "Font marcada per redactar",
      unselectedReference: "No s'usarà en redactar",
      referenceScore: "Similitud relativa",
      referenceScoreTooltip: "Rànquing relatiu de semblança respecte de les altres referències trobades. No és qualitat jurídica ni completesa.",
      sourceTooltip: "Obre la font abans de reutilitzar-la.",
      noReferences: "Prem cercar referències automàticament. Es buscarà per significat, sense dependre del CPV.",
      indexPanel: "Índex PPT proposat",
      validated: "confirmat",
      required: "obligatori",
      recommended: "recomanable",
      chapterPending: "pendents: {count}",
      indexEmpty: "Prem \"{action}\" quan tinguis una primera fitxa de l'expedient.",
      whyValidateTitle: "Abans de redactar",
      whyValidateCopy: "xTender no redacta el PPT sencer de cop. Primer proposa estructura i camps pendents. Una persona confirma l'estructura i després es redacta capítol a capítol.",
      expediente: "Expedient",
      document: "Document",
      firstPpt: "PPT primer",
      validation: "Validació",
      humanRegistered: "humana registrada",
      chaptersPanel: "Capítols",
      noDraft: "Sense redactar",
      editorDefault: "Editor per capítols",
      output: "Sortida {lang}",
      editorCopy: "En redactar, xTender envia a llm2 la fitxa de l'expedient, l'estructura confirmada, capítols ja escrits i referències externes marcades com a referència. El capítol es redacta en l'idioma seleccionat a dalt.",
      streaming: "llm2 està escrivint el capítol...",
      previewAria: "Vista prèvia del capítol",
      markdownTitle: "Font Markdown",
      selectedChars: "{count} caràcters seleccionats",
      editorVisualTitle: "Editor visual",
      editorToolbar: "Eines de format del capítol",
      markdownToggle: "Markdown",
      markdownShowTooltip: "Mostra la font Markdown per a ajustos fins.",
      markdownHideTooltip: "Amaga la font Markdown i torna a l'editor visual.",
      toolbarBold: "Negreta",
      toolbarItalic: "Cursiva",
      toolbarHeading2: "Títol",
      toolbarHeading3: "Subtítol",
      toolbarBulletList: "Llista amb pics",
      toolbarOrderedList: "Llista numerada",
      toolbarQuote: "Cita",
      toolbarLink: "Enllaç",
      toolbarLinkPrompt: "Enganxa l'URL de l'enllaç",
      toolbarTable: "Taula",
      toolbarClear: "Neteja el format",
      customInstructionLabel: "Prompt específic per millorar (ex.: millora el 2.1 amb criteris mesurables)",
      customInstructionPlaceholder: "Ex.: fes-ho més tècnic, afegeix criteris mesurables, redueix ambigüitat...",
      customInstructionTooltip: "S'aplica al botó Generar. Si hi ha text seleccionat, només canvia aquest fragment.",
      generatePrompt: "Generar",
      chapterPlaceholder: "Genera o escriu el capítol aquí...",
      draftTooltip: "Crida llm2 amb context de l'expedient i capítols de referència etiquetats com a externs.",
      improveSelectionTooltip: "Millora només el text seleccionat en {lang}.",
      improveChapterTooltip: "Afegeix més detall al capítol complet en {lang}.",
      undoText: "Tornar enrere",
      redoText: "Anar endavant",
      impactsPanel: "Impactes proposats",
      impactsCopy: "Si canvies pressupost, durada, lots, CPV o dades, el sistema t'avisa dels capítols que convé revisar.",
      impactsEmpty: "Prem Veure impactes després d'editar un capítol.",
      markdownEmpty: "El capítol renderitzat apareixerà aquí mentre llm2 escriu o quan enganxis Markdown.",
      validationPanel: "Validació per a principiants",
      exportPanel: "Exportació",
      exportCopy: "Exporta l'esborrany traçable. Si SeaweedFS està configurat, queda emmagatzemat com a artefacte de l'expedient.",
      acceptedSources: "Fonts acceptades",
      recentAudit: "Auditoria recent",
      noAudit: "Encara no hi ha esdeveniments per a aquest expedient.",
      pendingValue: "pendent",
      budgetWithoutVat: "{value} EUR sense IVA",
      improveSelectionInstruction: "Millora i afegeix més detall al fragment seleccionat.",
      improveChapterInstruction: "Afegeix més detall al capítol mantenint-ne l'estructura.",
      improveBlocked: "Encara no es pot millorar aquest text.",
      suggestBlockedGeneric: "Encara no es pot suggerir aquesta dada.",
      apiError: "api_error"
    },
    fields: {
      object: "Objecte contractual",
      need: "Necessitat pública",
      included: "Prestacions incloses",
      excluded: "Prestacions excloses",
      outcome: "Resultat esperat",
      budget: "Pressupost (EUR, sense IVA)",
      duration: "Durada",
      lots: "Lots",
      template: "Plantilla",
      language: "Idioma",
      security: "Seguretat i dades",
      references: "Referències a usar o evitar"
    },
    questions: {
      object: "Quin servei, subministrament o obra es vol contractar?",
      need: "Quina necessitat pública o administrativa ho justifica?",
      included: "Quines prestacions han de quedar incloses?",
      excluded: "Quines prestacions han de quedar expressament fora?",
      outcome: "Quin resultat ha d'aconseguir el contracte?",
      budget: "Quin és el pressupost en EUR, sense IVA?",
      duration: "Quina durada inicial i quines pròrrogues es preveuen?",
      lots: "S'ha de dividir en lots o es vol analitzar aquesta decisió?",
      template: "Hi ha una plantilla de l'entitat que s'hagi de respectar?",
      language: "El document final s'ha de redactar en castellà, català, valencià, gallec, euskera o diversos idiomes?",
      security: "Hi ha requisits de seguretat, dades personals, interoperabilitat o integració?",
      references: "Hi ha exemples de contractes anteriors que es vulguin usar o evitar?",
      fallback: "Quina dada vols aportar ara?"
    },
    tips: {
      activeWorkspace: "Tot el que facis es desa en aquest expedient. Canvia'l aquí abans d'editar.",
      create: "Crea un expedient esborrany amb camps incomplets. El pots completar a poc a poc.",
      archive: "No esborra res. Oculta l'expedient normal i conserva historial, versions i auditoria.",
      prep: "Completa la fitxa sense tecnicismes. Si no saps alguna cosa, escriu pendent i el sistema ho marcarà.",
      export: "Genera un DOCX traçable. Els esborranys no són definitius sense validació humana.",
      audit: "Obre el registre d'accions, validacions, canvis i exportacions.",
      admin: "Configuració, idiomes, plantilles, rols i paràmetres d'IA."
    },
    nextActions: {
      noWorkspace: { title: "Crea un expedient per començar", detail: "Nou expedient" },
      completePrep: { title: "Completa la fitxa inicial", detail: "Respon només l'imprescindible" },
      references: { title: "Cerca referències automàticament", detail: "El sistema selecciona plecs similars" },
      index: { title: "Proposa l'índex del PPT", detail: "Abans de redactar" },
      validate: { title: "Confirma l'estructura", detail: "Control humà obligatori" },
      draft: { title: "Redacta el primer capítol", detail: "Capítol a capítol" },
      export: { title: "Revisa impactes i exporta", detail: "Esborrany DOCX traçable" }
    },
    validation: {
      indexTitle: "Estructura pendent de confirmar",
      indexOk: "Estructura confirmada.",
      indexText: "Confirma l'estructura abans de redactar capítols definitius.",
      chaptersTitle: "Capítols sense versió",
      chaptersText: "{count} capítols encara sense esborrany.",
      exportTitle: "Exportació traçable",
      exportText: "El DOCX ha d'indicar que és esborrany si hi ha capítols sense validar.",
      redaction: "Redacció",
      export: "Exportació"
    },
    statuses: {
      borrador: "esborrany",
      en_preparacion: "en preparació",
      en_revision: "en revisió",
      validado: "validat",
      exportado: "exportat",
      archivado: "arxivat",
      aceptada: "acceptada",
      pendiente: "pendent",
      fijada: "fixada"
    }
  },
  va: {
    labels: {
      navAria: "Navegació principal",
      checkingLlm: "Comprovant llm2...",
      llmUnavailable: "No es pot consultar llm2",
      llmReachable: "llm2 accessible",
      llmNotReachable: "llm2 no accessible",
      modelConfigured: "model configurat",
      noResponse: "sense resposta",
      working: "Treballant: {task}",
      newWorkspaceTitle: "Nou expedient assistit",
      pendingUnit: "Unitat promotora pendent",
      languageTooltip: "Canvia l'idioma de la interfície i de la redacció IA. Les cites es conserven en l'idioma original.",
      audit: "Auditoria",
      admin: "Admin",
      searchTooltip: "Busca coincidències exactes i, si BGE-M3 està disponible, expedients amb significat paregut.",
      includeArchivedTooltip: "Mostra expedients arxivats sense restaurar-los.",
      includeArchived: "Vore arxivats",
      workspacesPanel: "Expedients",
      unitPending: "Unitat pendent",
      cpvPending: "CPV pendent",
      restoreTooltip: "Torna l'expedient al treball normal.",
      noWorkspaces: "No hi ha expedients amb estos filtres.",
      paginationAria: "Paginació d'expedients",
      requiredCompletion: "Obligatoris",
      requiredCompletionTooltip: "Percentatge de camps obligatoris ja omplits: fitxa inicial, metadades, CPV, procediment i dates.",
      metadataPanel: "Metadades de l'expedient actiu",
      metadataNewPanel: "Fitxa del nou expedient",
      metadataUnsaved: "Canvis sense guardar",
      createWorkspaceButton: "Crear expedient",
      cancel: "Cancel·lar",
      unsavedTitle: "Hi ha canvis pendents",
      unsavedText: "Abans de canviar d'expedient, decidix què vols fer amb la fitxa oberta.",
      guidedUnsavedTitle: "Resposta sense guardar",
      guidedUnsavedText: "Abans de canviar de pas, pestanya o idioma, guarda la resposta activa o decidix continuar sense guardar-la.",
      saveAndContinue: "Guardar i canviar",
      discardAndContinue: "Canviar sense guardar",
      keepEditing: "Continuar editant",
      fileNumber: "Número d'expedient",
      title: "Títol",
      unit: "Unitat promotora",
      object: "Objecte",
      need: "Necessitat",
      budget: "Pressupost (EUR, sense IVA)",
      estimatedValue: "VEC (EUR, sense IVA)",
      cpv: "CPV",
      cpvSearch: "Buscar CPV",
      cpvSearchPlaceholder: "Busca per codi o significat: pèl·lets, programari, neteja...",
      selectedCpvs: "CPV seleccionats",
      noCpvSuggestions: "No hi ha CPV candidats amb este text.",
      cpvSource: "Catàleg CPV 2008 TED/SIMAP",
      removeCpv: "Llevar CPV",
      contractType: "Tipus de contracte",
      procedure: "Procediment",
      duration: "Duració",
      dates: "Dates previstes",
      fillTypicalDates: "Omplir dates tipus",
      publicationDate: "Publicació",
      submissionDeadline: "Fi de presentació",
      awardDate: "Adjudicació",
      formalizationDate: "Formalització",
      startDate: "Inici",
      endDate: "Fi",
      lots: "Lots",
      prepPanel: "Fitxa inicial",
      prepIntro: "Passos adaptats al tipus documental. Completa'n un, guarda i avança.",
      saved: "Guardat",
      pending: "Pendent",
      stepOf: "Pas {current} de {total}",
      guideTitle: "Guia pas a pas",
      guideOne: "Llig la pregunta activa.",
      guideTwo: "Escriu una resposta normal o prem Generar amb IA.",
      guideThree: "Guarda i avança. El que queda pendent es marca per a no inventar contingut.",
      completeQuestion: "La fitxa inicial ja té una base suficient.",
      answerPlaceholder: "Exemple: servici de plataforma IA per a preparar plecs amb supervisió humana...",
      suggestEnabled: "Proposa una resposta breu per a esta dada amb llm2 i l'objecte contractual com a base.",
      suggestBlocked: "Primer escriu el servici, subministrament o obra que es vol contractar.",
      generateAi: "Generar amb IA",
      guidedStreaming: "llm2 està escrivint la resposta...",
      expandDetail: "Augmentar detall",
      expandEnabled: "Amplia el text actual amb més detall en l'idioma seleccionat.",
      expandBlocked: "Escriu una base mínima abans d'augmentar el detall.",
      expandBlockedTooltip: "Escriu almenys {count} paraules per a poder augmentar el detall.",
      saveAnswerShort: "Guardar",
      summary: "Resum",
      responses: "{count} respostes",
      noAnswers: "Encara no hi ha respostes guardades.",
      referencesPanel: "Referències automàtiques",
      queryIn: "sense filtre CPV/idioma",
      referencesCopy: "La busca torna fins a 15 plecs complets semblants, sense filtrar per CPV ni idioma. Marca les fonts que vulgues usar; els chunks queden com a suport intern traçable.",
      searchableCorpus: "{ppt} PPT buscables · {documents} documents totals · {chunks} chunks",
      searchableCorpusTooltip: "Documents disponibles en la base de coneixement per a comparar per similitud semàntica.",
      referencesTooltip: "Extrau la idea essencial de l'expedient, busca els 15 plecs PPT més semblants i conserva els seus chunks només per a ajudar a redactar i inferir índex.",
      useReference: "Usar font",
      selectedReference: "Font marcada per a redactar",
      unselectedReference: "No s'usarà en redactar",
      referenceScore: "Similitud relativa",
      referenceScoreTooltip: "Rànquing relatiu de semblança respecte de les altres referències trobades. No és qualitat jurídica ni completesa.",
      sourceTooltip: "Obri la font abans de reutilitzar-la.",
      noReferences: "Prem buscar referències automàticament. Es buscarà per significat, sense dependre del CPV.",
      indexPanel: "Índex PPT proposat",
      validated: "confirmat",
      required: "obligatori",
      recommended: "recomanable",
      chapterPending: "pendents: {count}",
      indexEmpty: "Prem \"{action}\" quan tingues una primera fitxa de l'expedient.",
      whyValidateTitle: "Abans de redactar",
      whyValidateCopy: "xTender no redacta el PPT sencer de colp. Primer proposa estructura i camps pendents. Una persona confirma l'estructura i després es redacta capítol a capítol.",
      expediente: "Expedient",
      document: "Document",
      firstPpt: "PPT primer",
      validation: "Validació",
      humanRegistered: "humana registrada",
      chaptersPanel: "Capítols",
      noDraft: "Sense redactar",
      editorDefault: "Editor per capítols",
      output: "Eixida {lang}",
      editorCopy: "En redactar, xTender envia a llm2 la fitxa de l'expedient, l'estructura confirmada, capítols ja escrits i referències externes marcades com a referència. El capítol es redacta en l'idioma seleccionat dalt.",
      streaming: "llm2 està escrivint el capítol...",
      previewAria: "Vista prèvia del capítol",
      markdownTitle: "Font Markdown",
      selectedChars: "{count} caràcters seleccionats",
      editorVisualTitle: "Editor visual",
      editorToolbar: "Ferramentes de format del capítol",
      markdownToggle: "Markdown",
      markdownShowTooltip: "Mostra la font Markdown per a ajustos fins.",
      markdownHideTooltip: "Amaga la font Markdown i torna a l'editor visual.",
      toolbarBold: "Negreta",
      toolbarItalic: "Cursiva",
      toolbarHeading2: "Títol",
      toolbarHeading3: "Subtítol",
      toolbarBulletList: "Llista amb pics",
      toolbarOrderedList: "Llista numerada",
      toolbarQuote: "Cita",
      toolbarLink: "Enllaç",
      toolbarLinkPrompt: "Apega l'URL de l'enllaç",
      toolbarTable: "Taula",
      toolbarClear: "Netejar format",
      customInstructionLabel: "Prompt específic per a millorar (ex.: millora el 2.1 amb criteris mesurables)",
      customInstructionPlaceholder: "Ex.: fes-ho més tècnic, afig criteris mesurables, reduïx ambigüitat...",
      customInstructionTooltip: "S'aplica al botó Generar. Si hi ha text seleccionat, només canvia eixe fragment.",
      generatePrompt: "Generar",
      chapterPlaceholder: "Genera o escriu el capítol ací...",
      draftTooltip: "Crida llm2 amb context de l'expedient i capítols de referència etiquetats com a externs.",
      improveSelectionTooltip: "Millora només el text seleccionat en {lang}.",
      improveChapterTooltip: "Afig més detall al capítol complet en {lang}.",
      undoText: "Tornar arrere",
      redoText: "Anar avant",
      impactsPanel: "Impactes proposats",
      impactsCopy: "Si canvies pressupost, duració, lots, CPV o dades, el sistema t'avisa dels capítols que convé revisar.",
      impactsEmpty: "Prem Vore impactes després d'editar un capítol.",
      markdownEmpty: "El capítol renderitzat apareixerà ací mentre llm2 escriu o quan apegues Markdown.",
      validationPanel: "Validació per a principiants",
      exportPanel: "Exportació",
      exportCopy: "Exporta l'esborrany traçable. Si SeaweedFS està configurat, queda emmagatzemat com a artefacte de l'expedient.",
      acceptedSources: "Fonts acceptades",
      recentAudit: "Auditoria recent",
      noAudit: "Encara no hi ha esdeveniments per a este expedient.",
      pendingValue: "pendent",
      budgetWithoutVat: "{value} EUR sense IVA",
      improveSelectionInstruction: "Millora i afig més detall al fragment seleccionat.",
      improveChapterInstruction: "Afig més detall al capítol mantenint-ne l'estructura.",
      improveBlocked: "Encara no es pot millorar este text.",
      suggestBlockedGeneric: "Encara no es pot suggerir esta dada.",
      apiError: "api_error"
    },
    fields: {
      object: "Objecte contractual",
      need: "Necessitat pública",
      included: "Prestacions incloses",
      excluded: "Prestacions excloses",
      outcome: "Resultat esperat",
      budget: "Pressupost (EUR, sense IVA)",
      duration: "Duració",
      lots: "Lots",
      template: "Plantilla",
      language: "Idioma",
      security: "Seguretat i dades",
      references: "Referències a usar o evitar"
    },
    questions: {
      object: "Quin servici, subministrament o obra es vol contractar?",
      need: "Quina necessitat pública o administrativa ho justifica?",
      included: "Quines prestacions han de quedar incloses?",
      excluded: "Quines prestacions han de quedar expressament fora?",
      outcome: "Quin resultat ha d'aconseguir el contracte?",
      budget: "Quin és el pressupost en EUR, sense IVA?",
      duration: "Quina duració inicial i quines pròrrogues es preveuen?",
      lots: "S'ha de dividir en lots o es vol analitzar eixa decisió?",
      template: "Hi ha una plantilla de l'entitat que s'haja de respectar?",
      language: "El document final s'ha de redactar en castellà, català, valencià, gallec, euskera o diversos idiomes?",
      security: "Hi ha requisits de seguretat, dades personals, interoperabilitat o integració?",
      references: "Hi ha exemples de contractes anteriors que es vulguen usar o evitar?",
      fallback: "Quina dada vols aportar ara?"
    },
    tips: {
      activeWorkspace: "Tot el que faces es guarda en este expedient. Canvia'l ací abans d'editar.",
      create: "Crea un expedient esborrany amb camps incomplets. El pots completar a poc a poc.",
      archive: "No esborra res. Oculta l'expedient normal i conserva historial, versions i auditoria.",
      prep: "Completa la fitxa sense tecnicismes. Si no saps alguna cosa, escriu pendent i el sistema ho marcarà.",
      export: "Genera un DOCX traçable. Els esborranys no són definitius sense validació humana.",
      audit: "Obri el registre d'accions, validacions, canvis i exportacions.",
      admin: "Configuració, idiomes, plantilles, rols i paràmetres d'IA."
    },
    nextActions: {
      noWorkspace: { title: "Crea un expedient per a començar", detail: "Nou expedient" },
      completePrep: { title: "Completa la fitxa inicial", detail: "Respon només l'imprescindible" },
      references: { title: "Busca referències automàticament", detail: "El sistema selecciona plecs similars" },
      index: { title: "Proposa l'índex del PPT", detail: "Abans de redactar" },
      validate: { title: "Confirma l'estructura", detail: "Control humà obligatori" },
      draft: { title: "Redacta el primer capítol", detail: "Capítol a capítol" },
      export: { title: "Revisa impactes i exporta", detail: "Esborrany DOCX traçable" }
    },
    validation: {
      indexTitle: "Estructura pendent de confirmar",
      indexOk: "Estructura confirmada.",
      indexText: "Confirma l'estructura abans de redactar capítols definitius.",
      chaptersTitle: "Capítols sense versió",
      chaptersText: "{count} capítols encara sense esborrany.",
      exportTitle: "Exportació traçable",
      exportText: "El DOCX ha d'indicar que és esborrany si hi ha capítols sense validar.",
      redaction: "Redacció",
      export: "Exportació"
    },
    statuses: {
      borrador: "esborrany",
      en_preparacion: "en preparació",
      en_revision: "en revisió",
      validado: "validat",
      exportado: "exportat",
      archivado: "arxivat",
      aceptada: "acceptada",
      pendiente: "pendent",
      fijada: "fixada"
    }
  },
  gl: {
    labels: {
      navAria: "Navegación principal",
      checkingLlm: "Comprobando llm2...",
      llmUnavailable: "Non se pode consultar llm2",
      llmReachable: "llm2 accesible",
      llmNotReachable: "llm2 non accesible",
      modelConfigured: "modelo configurado",
      noResponse: "sen resposta",
      working: "Traballando: {task}",
      newWorkspaceTitle: "Novo expediente asistido",
      pendingUnit: "Unidade promotora pendente",
      languageTooltip: "Cambia o idioma da interface e da redacción IA. As citas consérvanse no idioma orixinal.",
      audit: "Auditoría",
      admin: "Admin",
      searchTooltip: "Busca coincidencias exactas e, se BGE-M3 está dispoñible, expedientes con significado parecido.",
      includeArchivedTooltip: "Mostra expedientes arquivados sen restauralos.",
      includeArchived: "Ver arquivados",
      workspacesPanel: "Expedientes",
      unitPending: "Unidade pendente",
      cpvPending: "CPV pendente",
      restoreTooltip: "Devolve o expediente ao traballo normal.",
      noWorkspaces: "Non hai expedientes con eses filtros.",
      paginationAria: "Paxinación de expedientes",
      requiredCompletion: "Obrigatorios",
      requiredCompletionTooltip: "Porcentaxe de campos obrigatorios xa cubertos: ficha inicial, metadatos, CPV, procedemento e datas.",
      metadataPanel: "Metadatos do expediente activo",
      metadataNewPanel: "Ficha do novo expediente",
      metadataUnsaved: "Cambios sen gardar",
      createWorkspaceButton: "Crear expediente",
      cancel: "Cancelar",
      unsavedTitle: "Hai cambios pendentes",
      unsavedText: "Antes de cambiar de expediente, decide que facer coa ficha aberta.",
      guidedUnsavedTitle: "Resposta sen gardar",
      guidedUnsavedText: "Antes de cambiar de paso, pestana ou idioma, garda a resposta activa ou decide continuar sen gardala.",
      saveAndContinue: "Gardar e cambiar",
      discardAndContinue: "Cambiar sen gardar",
      keepEditing: "Seguir editando",
      fileNumber: "Número de expediente",
      title: "Título",
      unit: "Unidade promotora",
      object: "Obxecto",
      need: "Necesidade",
      budget: "Orzamento (EUR, sen IVE)",
      estimatedValue: "VEC (EUR, sen IVE)",
      cpv: "CPV",
      cpvSearch: "Buscar CPV",
      cpvSearchPlaceholder: "Busca por código ou significado: pellets, software, limpeza...",
      selectedCpvs: "CPV seleccionados",
      noCpvSuggestions: "Non hai CPV candidatos con ese texto.",
      cpvSource: "Catálogo CPV 2008 TED/SIMAP",
      removeCpv: "Quitar CPV",
      contractType: "Tipo de contrato",
      procedure: "Procedemento",
      duration: "Duración",
      dates: "Datas previstas",
      fillTypicalDates: "Encher datas tipo",
      publicationDate: "Publicación",
      submissionDeadline: "Fin de presentación",
      awardDate: "Adxudicación",
      formalizationDate: "Formalización",
      startDate: "Inicio",
      endDate: "Fin",
      lots: "Lotes",
      prepPanel: "Ficha inicial",
      prepIntro: "Pasos adaptados ao tipo documental. Completa un, garda e avanza.",
      saved: "Gardado",
      pending: "Pendente",
      stepOf: "Paso {current} de {total}",
      guideTitle: "Guía paso a paso",
      guideOne: "Le a pregunta activa.",
      guideTwo: "Escribe unha resposta normal ou preme Xerar con IA.",
      guideThree: "Garda e avanza. O pendente márcase para non inventar contido.",
      completeQuestion: "A ficha inicial xa ten unha base suficiente.",
      answerPlaceholder: "Exemplo: servizo de plataforma IA para preparar pregos con supervisión humana...",
      suggestEnabled: "Propón unha resposta breve para este dato usando llm2 e o obxecto contractual como base.",
      suggestBlocked: "Primeiro escribe o servizo, subministración ou obra que se quere contratar.",
      generateAi: "Xerar con IA",
      guidedStreaming: "llm2 está escribindo a resposta...",
      expandDetail: "Aumentar detalle",
      expandEnabled: "Amplía o texto actual con máis detalle no idioma seleccionado.",
      expandBlocked: "Escribe unha base mínima antes de aumentar o detalle.",
      expandBlockedTooltip: "Escribe polo menos {count} palabras para poder aumentar o detalle.",
      saveAnswerShort: "Gardar",
      summary: "Resumo",
      responses: "{count} respostas",
      noAnswers: "Aínda non hai respostas gardadas.",
      referencesPanel: "Referencias automáticas",
      queryIn: "sen filtro CPV/idioma",
      referencesCopy: "A busca devolve ata 15 pregos completos similares, sen filtrar por CPV nin idioma. Marca as fontes que queiras usar; os chunks quedan como apoio interno trazable.",
      searchableCorpus: "{ppt} PPT buscables · {documents} documentos totais · {chunks} chunks",
      searchableCorpusTooltip: "Documentos dispoñibles na base de coñecemento para comparar por similitude semántica.",
      referencesTooltip: "Extrae a idea esencial do expediente, busca os 15 pregos PPT máis parecidos e conserva os seus chunks só para axudar a redactar e inferir índice.",
      useReference: "Usar fonte",
      selectedReference: "Fonte marcada para redactar",
      unselectedReference: "Non se usará ao redactar",
      referenceScore: "Similitude relativa",
      referenceScoreTooltip: "Ránking relativo de parecido fronte ás demais referencias atopadas. Non é calidade xurídica nin completitude.",
      sourceTooltip: "Abre a fonte antes de reutilizala.",
      noReferences: "Preme buscar referencias automaticamente. Buscarase polo significado, sen depender do CPV.",
      indexPanel: "Índice PPT proposto",
      validated: "confirmado",
      required: "obrigatorio",
      recommended: "recomendable",
      chapterPending: "pendentes: {count}",
      indexEmpty: "Preme \"{action}\" cando teñas unha primeira ficha do expediente.",
      whyValidateTitle: "Antes de redactar",
      whyValidateCopy: "xTender non redacta o PPT enteiro dunha vez. Primeiro propón estrutura e campos pendentes. Unha persoa confirma a estrutura e despois redáctase capítulo a capítulo.",
      expediente: "Expediente",
      document: "Documento",
      firstPpt: "PPT primeiro",
      validation: "Validación",
      humanRegistered: "humana rexistrada",
      chaptersPanel: "Capítulos",
      noDraft: "Sen redactar",
      editorDefault: "Editor por capítulos",
      output: "Saída {lang}",
      editorCopy: "Ao redactar, xTender envía a llm2 a ficha do expediente, a estrutura confirmada, capítulos xa escritos e referencias externas marcadas como referencia. O capítulo redáctase no idioma seleccionado arriba.",
      streaming: "llm2 está escribindo o capítulo...",
      previewAria: "Vista previa do capítulo",
      markdownTitle: "Fonte Markdown",
      selectedChars: "{count} caracteres seleccionados",
      editorVisualTitle: "Editor visual",
      editorToolbar: "Ferramentas de formato do capítulo",
      markdownToggle: "Markdown",
      markdownShowTooltip: "Mostra a fonte Markdown para axustes finos.",
      markdownHideTooltip: "Oculta a fonte Markdown e volve ao editor visual.",
      toolbarBold: "Negra",
      toolbarItalic: "Cursiva",
      toolbarHeading2: "Título",
      toolbarHeading3: "Subtítulo",
      toolbarBulletList: "Lista con viñetas",
      toolbarOrderedList: "Lista numerada",
      toolbarQuote: "Cita",
      toolbarLink: "Ligazón",
      toolbarLinkPrompt: "Pega o URL da ligazón",
      toolbarTable: "Táboa",
      toolbarClear: "Limpar formato",
      customInstructionLabel: "Prompt específico para mellorar (ex.: mellora o 2.1 con criterios medibles)",
      customInstructionPlaceholder: "Ex.: faino máis técnico, engade criterios medibles, reduce ambigüidade...",
      customInstructionTooltip: "Aplícase ao botón Xerar. Se hai texto seleccionado, só cambia ese fragmento.",
      generatePrompt: "Xerar",
      chapterPlaceholder: "Xera ou escribe o capítulo aquí...",
      draftTooltip: "Chama a llm2 con contexto do expediente e capítulos de referencia etiquetados como externos.",
      improveSelectionTooltip: "Mellora só o texto seleccionado en {lang}.",
      improveChapterTooltip: "Engade máis detalle ao capítulo completo en {lang}.",
      undoText: "Volver atrás",
      redoText: "Ir cara adiante",
      impactsPanel: "Impactos propostos",
      impactsCopy: "Se cambias orzamento, duración, lotes, CPV ou datos, o sistema avísate dos capítulos que convén revisar.",
      impactsEmpty: "Preme Ver impactos despois de editar un capítulo.",
      markdownEmpty: "O capítulo renderizado aparecerá aquí mentres llm2 escribe ou cando pegues Markdown.",
      validationPanel: "Validación para principiantes",
      exportPanel: "Exportación",
      exportCopy: "Exporta o borrador trazable. Se SeaweedFS está configurado, queda almacenado como artefacto do expediente.",
      acceptedSources: "Fontes aceptadas",
      recentAudit: "Auditoría recente",
      noAudit: "Aínda non hai eventos para este expediente.",
      pendingValue: "pendente",
      budgetWithoutVat: "{value} EUR sen IVE",
      improveSelectionInstruction: "Mellora e engade máis detalle ao fragmento seleccionado.",
      improveChapterInstruction: "Engade máis detalle ao capítulo mantendo a súa estrutura.",
      improveBlocked: "Aínda non se pode mellorar este texto.",
      suggestBlockedGeneric: "Aínda non se pode suxerir este dato.",
      apiError: "api_error"
    },
    fields: {
      object: "Obxecto contractual",
      need: "Necesidade pública",
      included: "Prestacións incluídas",
      excluded: "Prestacións excluídas",
      outcome: "Resultado esperado",
      budget: "Orzamento (EUR, sen IVE)",
      duration: "Duración",
      lots: "Lotes",
      template: "Modelo",
      language: "Idioma",
      security: "Seguridade e datos",
      references: "Referencias a usar ou evitar"
    },
    questions: {
      object: "Que servizo, subministración ou obra se quere contratar?",
      need: "Cal é a necesidade pública ou administrativa que o xustifica?",
      included: "Que prestacións deben quedar incluídas?",
      excluded: "Que prestacións deben quedar expresamente fóra?",
      outcome: "Que resultado debe conseguir o contrato?",
      budget: "Cal é o orzamento en EUR, sen IVE?",
      duration: "Que duración inicial e prórrogas se prevén?",
      lots: "Debe dividirse en lotes ou quérese analizar esa decisión?",
      template: "Existe un modelo da entidade que deba respectarse?",
      language: "O documento final debe redactarse en castelán, catalán, valenciano, galego, éuscaro ou varios idiomas?",
      security: "Hai requisitos de seguridade, datos persoais, interoperabilidade ou integración?",
      references: "Hai exemplos de contratos anteriores que se queiran usar ou evitar?",
      fallback: "Que dato queres achegar agora?"
    },
    tips: {
      activeWorkspace: "Todo o que fagas gárdase neste expediente. Cámbiao aquí antes de editar.",
      create: "Crea un expediente borrador con campos incompletos. Pódelo completar pouco a pouco.",
      archive: "Non borra nada. Oculta o expediente normal e conserva historial, versións e auditoría.",
      prep: "Completa a ficha sen tecnicismos. Se non sabes algo, escribe pendente e o sistema marcarao.",
      export: "Xera un DOCX trazable. Os borradores non son definitivos sen validación humana.",
      audit: "Abre o rexistro de accións, validacións, cambios e exportacións.",
      admin: "Configuración, idiomas, modelos, roles e parámetros de IA."
    },
    nextActions: {
      noWorkspace: { title: "Crea un expediente para empezar", detail: "Novo expediente" },
      completePrep: { title: "Completa a ficha inicial", detail: "Responde só o imprescindible" },
      references: { title: "Busca referencias automaticamente", detail: "O sistema selecciona pregos similares" },
      index: { title: "Propón o índice do PPT", detail: "Antes de redactar" },
      validate: { title: "Confirma a estrutura", detail: "Control humano obrigatorio" },
      draft: { title: "Redacta o primeiro capítulo", detail: "Capítulo a capítulo" },
      export: { title: "Revisa impactos e exporta", detail: "Borrador DOCX trazable" }
    },
    validation: {
      indexTitle: "Estrutura pendente de confirmar",
      indexOk: "Estrutura confirmada.",
      indexText: "Confirma a estrutura antes de redactar capítulos definitivos.",
      chaptersTitle: "Capítulos sen versión",
      chaptersText: "{count} capítulos aínda sen borrador.",
      exportTitle: "Exportación trazable",
      exportText: "O DOCX debe indicar que é borrador se hai capítulos sen validar.",
      redaction: "Redacción",
      export: "Exportación"
    },
    statuses: {
      borrador: "borrador",
      en_preparacion: "en preparación",
      en_revision: "en revisión",
      validado: "validado",
      exportado: "exportado",
      archivado: "arquivado",
      aceptada: "aceptada",
      pendiente: "pendente",
      fijada: "fixada"
    }
  },
  eu: {
    labels: {
      navAria: "Nabigazio nagusia",
      checkingLlm: "llm2 egiaztatzen...",
      llmUnavailable: "Ezin da llm2 kontsultatu",
      llmReachable: "llm2 erabilgarri",
      llmNotReachable: "llm2 ez dago erabilgarri",
      modelConfigured: "eredu konfiguratua",
      noResponse: "erantzunik gabe",
      working: "Lanean: {task}",
      newWorkspaceTitle: "Lagundutako espediente berria",
      pendingUnit: "Unitate sustatzailea pendiente",
      languageTooltip: "Interfazearen eta IA bidezko idazketaren hizkuntza aldatzen du. Aipuak jatorrizko hizkuntzan mantentzen dira.",
      audit: "Auditoria",
      admin: "Admin",
      searchTooltip: "Bat-etortze zehatzak bilatzen ditu eta, BGE-M3 erabilgarri badago, esanahi antzekoa duten espedienteak ere bai.",
      includeArchivedTooltip: "Artxibatutako espedienteak erakusten ditu leheneratu gabe.",
      includeArchived: "Ikusi artxibatuak",
      workspacesPanel: "Espedienteak",
      unitPending: "Unitatea pendiente",
      cpvPending: "CPV pendiente",
      restoreTooltip: "Espedientea ohiko lanera itzultzen du.",
      noWorkspaces: "Ez dago iragazki horiekin bat datorren espedienterik.",
      paginationAria: "Espedienteen orrikatzea",
      requiredCompletion: "Nahitaezkoak",
      requiredCompletionTooltip: "Dagoeneko betetako nahitaezko eremuen ehunekoa: hasierako fitxa, metadatuak, CPV, prozedura eta datak.",
      metadataPanel: "Espediente aktiboaren metadatuak",
      metadataNewPanel: "Espediente berriaren fitxa",
      metadataUnsaved: "Gorde gabeko aldaketak",
      createWorkspaceButton: "Sortu espedientea",
      cancel: "Utzi",
      unsavedTitle: "Aldaketak gordetzeke daude",
      unsavedText: "Espedientez aldatu aurretik, erabaki zer egin irekitako fitxarekin.",
      guidedUnsavedTitle: "Gorde gabeko erantzuna",
      guidedUnsavedText: "Pausoz, fitxaz edo hizkuntzaz aldatu aurretik, gorde erantzun aktiboa edo jarraitu gorde gabe.",
      saveAndContinue: "Gorde eta aldatu",
      discardAndContinue: "Aldatu gorde gabe",
      keepEditing: "Editatzen jarraitu",
      fileNumber: "Espediente zenbakia",
      title: "Izenburua",
      unit: "Unitate sustatzailea",
      object: "Xedea",
      need: "Beharrizana",
      budget: "Aurrekontua (EUR, BEZik gabe)",
      estimatedValue: "VEC (EUR, BEZik gabe)",
      cpv: "CPV",
      cpvSearch: "Bilatu CPV",
      cpvSearchPlaceholder: "Bilatu kodez edo esanahiz: pelletak, softwarea, garbiketa...",
      selectedCpvs: "Hautatutako CPVak",
      noCpvSuggestions: "Ez dago testu horretarako CPV hautagairik.",
      cpvSource: "CPV 2008 TED/SIMAP katalogoa",
      removeCpv: "Kendu CPV",
      contractType: "Kontratu mota",
      procedure: "Prozedura",
      duration: "Iraupena",
      dates: "Aurreikusitako datak",
      fillTypicalDates: "Bete data tipoak",
      publicationDate: "Argitalpena",
      submissionDeadline: "Aurkezteko azken eguna",
      awardDate: "Esleipena",
      formalizationDate: "Formalizazioa",
      startDate: "Hasiera",
      endDate: "Amaiera",
      lots: "Sortak",
      prepPanel: "Hasierako fitxa",
      prepIntro: "Dokumentu motara egokitutako urratsak. Bete bat, gorde eta aurrera egin.",
      saved: "Gordeta",
      pending: "Pendiente",
      stepOf: "{current}. urratsa / {total}",
      guideTitle: "Urratsez urratseko gida",
      guideOne: "Irakurri galdera aktiboa.",
      guideTwo: "Idatzi erantzun arrunt bat edo sakatu Sortu IArekin.",
      guideThree: "Gorde eta aurrera egin. Falta dena markatuta geratzen da edukirik asma ez dadin.",
      completeQuestion: "Hasierako fitxak nahikoa oinarri du.",
      answerPlaceholder: "Adibidea: pleguak giza gainbegiratzearekin prestatzeko IA plataforma zerbitzua...",
      suggestEnabled: "Datu honetarako erantzun laburra proposatzen du llm2rekin eta kontratuaren xedea oinarri hartuta.",
      suggestBlocked: "Lehenik idatzi kontratatu nahi den zerbitzua, hornidura edo obra.",
      generateAi: "Sortu IArekin",
      guidedStreaming: "llm2 erantzuna idazten ari da...",
      expandDetail: "Xehetasun gehiago",
      expandEnabled: "Zabaldu uneko testua xehetasun gehiagorekin hautatutako hizkuntzan.",
      expandBlocked: "Idatzi gutxieneko oinarri bat xehetasuna handitu aurretik.",
      expandBlockedTooltip: "Idatzi gutxienez {count} hitz xehetasuna handitu ahal izateko.",
      saveAnswerShort: "Gorde",
      summary: "Laburpena",
      responses: "{count} erantzun",
      noAnswers: "Oraindik ez dago gordetako erantzunik.",
      referencesPanel: "Erreferentzia automatikoak",
      queryIn: "CPV/hizkuntza iragazkirik gabe",
      referencesCopy: "Bilaketak gehienez antzeko 15 plegu oso itzultzen ditu, CPV edo hizkuntzaren arabera iragazi gabe. Markatu erabili nahi dituzun iturriak; chunkak barneko laguntza trazagarri gisa geratzen dira.",
      searchableCorpus: "{ppt} PPT bilagarri · {documents} dokumentu guztira · {chunks} chunk",
      searchableCorpusTooltip: "Ezagutza-basean dauden dokumentuak, antzekotasun semantikoaren arabera alderatzeko.",
      referencesTooltip: "Espedientearen funtsezko ideia ateratzen du, antzekoen diren 15 PPT pleguak bilatzen ditu eta haien chunkak gordetzen ditu idazketan eta aurkibidea inferitzen laguntzeko soilik.",
      useReference: "Iturria erabili",
      selectedReference: "Idazteko markatutako iturria",
      unselectedReference: "Ez da idazketan erabiliko",
      referenceScore: "Antzekotasun erlatiboa",
      referenceScoreTooltip: "Aurkitutako gainerako erreferentziekiko antzekotasun-ranking erlatiboa. Ez da kalitate juridikoa edo osotasuna.",
      sourceTooltip: "Ireki iturria berrerabili aurretik.",
      noReferences: "Sakatu erreferentziak automatikoki bilatzeko. Esanahiaren arabera bilatuko da, CPVren mende egon gabe.",
      indexPanel: "Proposatutako PPT aurkibidea",
      validated: "berretsita",
      required: "nahitaezkoa",
      recommended: "gomendagarria",
      chapterPending: "pendienteak: {count}",
      indexEmpty: "Sakatu \"{action}\" espedientearen lehen fitxa duzunean.",
      whyValidateTitle: "Idatzi aurretik",
      whyValidateCopy: "xTenderrek ez du PPT osoa batera idazten. Lehenik egitura eta falta diren eremuak proposatzen ditu. Pertsona batek egitura berresten du eta gero kapituluak banan-banan idazten dira.",
      expediente: "Espedientea",
      document: "Dokumentua",
      firstPpt: "Lehenik PPT",
      validation: "Balidazioa",
      humanRegistered: "gizakiak erregistratua",
      chaptersPanel: "Kapituluak",
      noDraft: "Idatzi gabe",
      editorDefault: "Kapituluen editorea",
      output: "Irteera {lang}",
      editorCopy: "Idaztean, xTenderrek llm2ri espedientearen fitxa, berretsitako egitura, dagoeneko idatzitako kapituluak eta kanpoko erreferentzia gisa markatutako erreferentziak bidaltzen dizkio. Kapitulua goian hautatutako hizkuntzan idazten da.",
      streaming: "llm2 kapitulua idazten ari da...",
      previewAria: "Kapituluaren aurrebista",
      markdownTitle: "Markdown editagarria",
      selectedChars: "{count} karaktere hautatuta",
      editorVisualTitle: "Editore bisuala",
      editorToolbar: "Kapituluaren formatua emateko tresnak",
      markdownToggle: "Markdown",
      markdownShowTooltip: "Markdown iturburua erakusten du doikuntza zehatzetarako.",
      markdownHideTooltip: "Markdown iturburua ezkutatu eta editore bisualera itzultzen da.",
      toolbarBold: "Lodia",
      toolbarItalic: "Etzana",
      toolbarHeading2: "Izenburua",
      toolbarHeading3: "Azpiizenburua",
      toolbarBulletList: "Buletdun zerrenda",
      toolbarOrderedList: "Zenbakidun zerrenda",
      toolbarQuote: "Aipua",
      toolbarLink: "Esteka",
      toolbarLinkPrompt: "Itsatsi estekaren URLa",
      toolbarTable: "Taula",
      toolbarClear: "Garbitu formatua",
      customInstructionLabel: "Hobetzeko prompt zehatza (adib.: hobetu 2.1 irizpide neurgarriekin)",
      customInstructionPlaceholder: "Adib.: egin teknikoago, gehitu irizpide neurgarriak, murriztu anbiguotasuna...",
      customInstructionTooltip: "Sortu botoiari aplikatzen zaio. Testua hautatuta badago, zati hori bakarrik aldatzen du.",
      generatePrompt: "Sortu",
      chapterPlaceholder: "Sortu edo idatzi kapitulua hemen...",
      draftTooltip: "llm2ri deitzen dio espedientearen testuinguruarekin eta kanpoko gisa etiketatutako erreferentzia-kapituluak erabiliz.",
      improveSelectionTooltip: "Hautatutako testua bakarrik hobetu {lang} hizkuntzan.",
      improveChapterTooltip: "Kapitulu osoari xehetasun gehiago gehitu {lang} hizkuntzan.",
      undoText: "Atzera egin",
      redoText: "Aurrera egin",
      impactsPanel: "Proposatutako eraginak",
      impactsCopy: "Aurrekontua, iraupena, sortak, CPV edo datuak aldatzen badituzu, sistemak berrikusi beharreko kapituluak jakinarazten dizkizu.",
      impactsEmpty: "Sakatu Ikusi eraginak kapitulu bat editatu ondoren.",
      markdownEmpty: "Errendatutako kapitulua hemen agertuko da llm2 idazten ari den bitartean edo Markdown itsasten duzunean.",
      validationPanel: "Hasiberrientzako balidazioa",
      exportPanel: "Esportazioa",
      exportCopy: "Esportatu trazagarria den zirriborroa. SeaweedFS konfiguratuta badago, espedientearen artefaktu gisa gordetzen da.",
      acceptedSources: "Onartutako iturriak",
      recentAudit: "Azken auditoria",
      noAudit: "Oraindik ez dago gertaerarik espediente honetarako.",
      pendingValue: "pendiente",
      budgetWithoutVat: "{value} EUR BEZik gabe",
      improveSelectionInstruction: "Hobetu eta gehitu xehetasun gehiago hautatutako zatian.",
      improveChapterInstruction: "Gehitu xehetasun gehiago kapituluari, egitura mantenduz.",
      improveBlocked: "Oraindik ezin da testu hau hobetu.",
      suggestBlockedGeneric: "Oraindik ezin da datu hau proposatu.",
      apiError: "api_error"
    },
    fields: {
      object: "Kontratuaren xedea",
      need: "Beharrizan publikoa",
      included: "Sartutako prestazioak",
      excluded: "Kanpo utzitako prestazioak",
      outcome: "Espero den emaitza",
      budget: "Aurrekontua (EUR, BEZik gabe)",
      duration: "Iraupena",
      lots: "Sortak",
      template: "Txantiloia",
      language: "Hizkuntza",
      security: "Segurtasuna eta datuak",
      references: "Erabili edo saihestu beharreko erreferentziak"
    },
    questions: {
      object: "Zer zerbitzu, hornidura edo obra kontratatu nahi da?",
      need: "Zein beharrizan publiko edo administratibok justifikatzen du?",
      included: "Zein prestazio sartu behar dira?",
      excluded: "Zein prestazio utzi behar dira espresuki kanpo?",
      outcome: "Zein emaitza lortu behar du kontratuak?",
      budget: "Zein da aurrekontua EURtan, BEZik gabe?",
      duration: "Zein hasierako iraupen eta luzapen aurreikusten dira?",
      lots: "Sortatan banatu behar da edo erabaki hori aztertu nahi da?",
      template: "Errespetatu beharreko erakundearen txantiloirik badago?",
      language: "Azken dokumentua gaztelaniaz, katalanez, valentzieraz, galegoz, euskaraz edo hizkuntza batzuetan idatzi behar da?",
      security: "Badago segurtasun, datu pertsonal, elkarreragingarritasun edo integrazio baldintzarik?",
      references: "Erabili edo saihestu nahi diren aurreko kontratuen adibiderik badago?",
      fallback: "Zer datu eman nahi duzu orain?"
    },
    tips: {
      activeWorkspace: "Egiten duzun guztia espediente honetan gordetzen da. Aldatu hemen editatu aurretik.",
      create: "Sortu eremu osatugabeak dituen zirriborro-espedientea. Pixkanaka osa dezakezu.",
      archive: "Ez du ezer ezabatzen. Espedientea ohiko lanetik ezkutatzen du eta historia, bertsioak eta auditoria gordetzen ditu.",
      prep: "Bete fitxa teknizismorik gabe. Zerbait ez badakizu, idatzi pendiente eta sistemak markatuko du.",
      export: "DOCX trazagarria sortzen du. Zirriborroak ez dira behin betikoak giza balidaziorik gabe.",
      audit: "Ekintzen, balidazioen, aldaketen eta esportazioen erregistroa irekitzen du.",
      admin: "Konfigurazioa, hizkuntzak, txantiloiak, rolak eta IA parametroak."
    },
    nextActions: {
      noWorkspace: { title: "Sortu espediente bat hasteko", detail: "Espediente berria" },
      completePrep: { title: "Osatu hasierako fitxa", detail: "Erantzun ezinbestekoa bakarrik" },
      references: { title: "Bilatu erreferentziak automatikoki", detail: "Sistemak antzeko pleguak hautatzen ditu" },
      index: { title: "Proposatu PPT aurkibidea", detail: "Idatzi aurretik" },
      validate: { title: "Egitura berretsi", detail: "Giza kontrola nahitaezkoa" },
      draft: { title: "Idatzi lehen kapitulua", detail: "Kapituluak banan-banan" },
      export: { title: "Berrikusi eraginak eta esportatu", detail: "DOCX zirriborro trazagarria" }
    },
    validation: {
      indexTitle: "Egitura berresteko dago",
      indexOk: "Egitura berretsita.",
      indexText: "Berretsi egitura behin betiko kapituluak idatzi aurretik.",
      chaptersTitle: "Bertsiorik gabeko kapituluak",
      chaptersText: "{count} kapitulu oraindik zirriborrorik gabe.",
      exportTitle: "Esportazio trazagarria",
      exportText: "DOCXak zirriborroa dela adierazi behar du kapituluak balidatu gabe badaude.",
      redaction: "Idazketa",
      export: "Esportazioa"
    },
    statuses: {
      borrador: "zirriborroa",
      en_preparacion: "prestatzen",
      en_revision: "berrikusten",
      validado: "balidatuta",
      exportado: "esportatuta",
      archivado: "artxibatuta",
      aceptada: "onartuta",
      pendiente: "pendiente",
      fijada: "finkatuta"
    }
  }
};

const guidedFieldOrders: Record<DocumentKind, string[]> = {
  informe_necesidad: ["need", "own_means", "object", "included", "procedure", "lots", "duration", "budget_impact", "solvency", "award_criteria", "special_execution_conditions", "data_protection", "template", "references"],
  ppt: ["object", "need", "functional_requirements", "non_functional_requirements", "architecture", "methodology", "deliverables", "technical_team", "service_levels", "security", "support", "template", "references"],
  pcap: ["object", "lots", "price_system", "duration", "procedure", "solvency", "award_criteria", "guarantees", "offer_submission", "special_execution_conditions", "penalties", "data_protection", "template", "references"],
  informe_juridico: ["object", "competence", "procedure", "price_system", "lots", "solvency", "legal_sources", "observations", "template", "references"]
};

const guidedFieldLabels: Record<string, string> = {
  object: "Objeto y alcance",
  need: "Necesidad y antecedentes",
  own_means: "Medios propios",
  included: "Alcance incluido",
  procedure: "Procedimiento",
  lots: "Lotes",
  duration: "Duración y prórrogas",
  budget_impact: "Economía e impacto",
  solvency: "Solvencia",
  award_criteria: "Criterios de adjudicación",
  special_execution_conditions: "Condiciones de ejecución",
  data_protection: "Datos y confidencialidad",
  functional_requirements: "Requisitos funcionales",
  non_functional_requirements: "Requisitos no funcionales",
  architecture: "Arquitectura e interoperabilidad",
  methodology: "Servicios y metodología",
  deliverables: "Entregables y aceptación",
  technical_team: "Equipo técnico",
  service_levels: "SLA e indicadores",
  security: "Seguridad",
  support: "Soporte y transferencia",
  price_system: "Presupuesto y precio",
  guarantees: "Anormalidad y garantías",
  offer_submission: "Presentación de ofertas",
  penalties: "Modificaciones y penalidades",
  competence: "Competencia y aprobación",
  legal_sources: "Normativa y doctrina",
  observations: "Observaciones y conclusión",
  template: "Plantilla de la entidad",
  references: "Documentos similares"
};

const guidedQuestionFallbacks: Record<string, string> = {
  own_means: "¿Por qué los medios propios son insuficientes o resulta idónea la contratación externa?",
  budget_impact: "¿Cuál es el presupuesto, valor estimado, financiación e impacto presupuestario?",
  solvency: "¿Qué solvencia resulta proporcionada al objeto y riesgos del contrato?",
  award_criteria: "¿Qué criterios se aplicarán y cómo se vinculan al objeto?",
  special_execution_conditions: "¿Qué condiciones especiales de ejecución y obligaciones deben preverse?",
  data_protection: "¿Qué tratamiento requieren los datos, la confidencialidad y la propiedad intelectual?",
  functional_requirements: "¿Qué requisitos funcionales obligatorios debe cumplir la prestación?",
  non_functional_requirements: "¿Qué requisitos no funcionales, de calidad y accesibilidad son aplicables?",
  architecture: "¿Qué arquitectura, interoperabilidad e integraciones deben respetarse?",
  methodology: "¿Qué servicios, actividades, fases y metodología se esperan?",
  deliverables: "¿Qué entregables, pruebas y criterios de aceptación se utilizarán?",
  technical_team: "¿Qué perfiles, dedicaciones y organización mínima requiere el servicio?",
  service_levels: "¿Qué niveles de servicio, indicadores y seguimiento deben medirse?",
  support: "¿Qué soporte, mantenimiento, transferencia y devolución del servicio se requieren?",
  price_system: "¿Cómo se determinan presupuesto, valor estimado, precio, impuestos y financiación?",
  guarantees: "¿Cómo se tratarán las ofertas anormalmente bajas y las garantías?",
  offer_submission: "¿Qué forma, plazo y documentación se exigirán para presentar ofertas?",
  penalties: "¿Qué modificaciones, penalidades, resolución y recursos deben revisarse?"
};
const workspacePageSize = 10;
const templatePageSize = 10;
const llm2HealthRefreshMs = 60_000;
const guidedExpandMinWords = 12;
const contractTypeOptions: Record<Locale, Array<{ value: string; label: string }>> = {
  es: [
    { value: "Obras", label: "Obras" },
    { value: "Suministros", label: "Suministros" },
    { value: "Servicios", label: "Servicios" },
    { value: "Concesión de obras", label: "Concesión de obras" },
    { value: "Concesión de servicios", label: "Concesión de servicios" },
    { value: "Mixto", label: "Mixto" }
  ],
  ca: [
    { value: "Obras", label: "Obres" },
    { value: "Suministros", label: "Subministraments" },
    { value: "Servicios", label: "Serveis" },
    { value: "Concesión de obras", label: "Concessió d'obres" },
    { value: "Concesión de servicios", label: "Concessió de serveis" },
    { value: "Mixto", label: "Mixt" }
  ],
  va: [
    { value: "Obras", label: "Obres" },
    { value: "Suministros", label: "Subministraments" },
    { value: "Servicios", label: "Servicis" },
    { value: "Concesión de obras", label: "Concessió d'obres" },
    { value: "Concesión de servicios", label: "Concessió de servicis" },
    { value: "Mixto", label: "Mixt" }
  ],
  gl: [
    { value: "Obras", label: "Obras" },
    { value: "Suministros", label: "Subministracións" },
    { value: "Servicios", label: "Servizos" },
    { value: "Concesión de obras", label: "Concesión de obras" },
    { value: "Concesión de servicios", label: "Concesión de servizos" },
    { value: "Mixto", label: "Mixto" }
  ],
  eu: [
    { value: "Obras", label: "Obrak" },
    { value: "Suministros", label: "Hornidurak" },
    { value: "Servicios", label: "Zerbitzuak" },
    { value: "Concesión de obras", label: "Obra-emakida" },
    { value: "Concesión de servicios", label: "Zerbitzu-emakida" },
    { value: "Mixto", label: "Mistoa" }
  ]
};
const procedureOptions: Record<Locale, Array<{ value: string; label: string }>> = {
  es: [
    { value: "Abierto", label: "Abierto" },
    { value: "Abierto simplificado", label: "Abierto simplificado" },
    { value: "Abierto simplificado abreviado", label: "Abierto simplificado abreviado" },
    { value: "Restringido", label: "Restringido" },
    { value: "Negociado sin publicidad", label: "Negociado sin publicidad" },
    { value: "Licitación con negociación", label: "Licitación con negociación" },
    { value: "Diálogo competitivo", label: "Diálogo competitivo" },
    { value: "Asociación para la innovación", label: "Asociación para la innovación" },
    { value: "Contrato menor", label: "Contrato menor" },
    { value: "Sistema dinámico de adquisición", label: "Sistema dinámico de adquisición" },
    { value: "Acuerdo marco", label: "Acuerdo marco" }
  ],
  ca: [
    { value: "Abierto", label: "Obert" },
    { value: "Abierto simplificado", label: "Obert simplificat" },
    { value: "Abierto simplificado abreviado", label: "Obert simplificat abreujat" },
    { value: "Restringido", label: "Restringit" },
    { value: "Negociado sin publicidad", label: "Negociat sense publicitat" },
    { value: "Licitación con negociación", label: "Licitació amb negociació" },
    { value: "Diálogo competitivo", label: "Diàleg competitiu" },
    { value: "Asociación para la innovación", label: "Associació per a la innovació" },
    { value: "Contrato menor", label: "Contracte menor" },
    { value: "Sistema dinámico de adquisición", label: "Sistema dinàmic d'adquisició" },
    { value: "Acuerdo marco", label: "Acord marc" }
  ],
  va: [
    { value: "Abierto", label: "Obert" },
    { value: "Abierto simplificado", label: "Obert simplificat" },
    { value: "Abierto simplificado abreviado", label: "Obert simplificat abreujat" },
    { value: "Restringido", label: "Restringit" },
    { value: "Negociado sin publicidad", label: "Negociat sense publicitat" },
    { value: "Licitación con negociación", label: "Licitació amb negociació" },
    { value: "Diálogo competitivo", label: "Diàleg competitiu" },
    { value: "Asociación para la innovación", label: "Associació per a la innovació" },
    { value: "Contrato menor", label: "Contracte menor" },
    { value: "Sistema dinámico de adquisición", label: "Sistema dinàmic d'adquisició" },
    { value: "Acuerdo marco", label: "Acord marc" }
  ],
  gl: [
    { value: "Abierto", label: "Aberto" },
    { value: "Abierto simplificado", label: "Aberto simplificado" },
    { value: "Abierto simplificado abreviado", label: "Aberto simplificado abreviado" },
    { value: "Restringido", label: "Restrinxido" },
    { value: "Negociado sin publicidad", label: "Negociado sen publicidade" },
    { value: "Licitación con negociación", label: "Licitación con negociación" },
    { value: "Diálogo competitivo", label: "Diálogo competitivo" },
    { value: "Asociación para la innovación", label: "Asociación para a innovación" },
    { value: "Contrato menor", label: "Contrato menor" },
    { value: "Sistema dinámico de adquisición", label: "Sistema dinámico de adquisición" },
    { value: "Acuerdo marco", label: "Acordo marco" }
  ],
  eu: [
    { value: "Abierto", label: "Irekia" },
    { value: "Abierto simplificado", label: "Irekia sinplifikatua" },
    { value: "Abierto simplificado abreviado", label: "Irekia sinplifikatu laburtua" },
    { value: "Restringido", label: "Murriztua" },
    { value: "Negociado sin publicidad", label: "Publizitaterik gabeko negoziatua" },
    { value: "Licitación con negociación", label: "Negoziazio bidezko lizitazioa" },
    { value: "Diálogo competitivo", label: "Elkarrizketa lehiakorra" },
    { value: "Asociación para la innovación", label: "Berrikuntzarako lankidetza" },
    { value: "Contrato menor", label: "Kontratu txikia" },
    { value: "Sistema dinámico de adquisición", label: "Erosketa-sistema dinamikoa" },
    { value: "Acuerdo marco", label: "Esparru-akordioa" }
  ]
};

export default function Home() {
  const [locale, setLocale] = useState<Locale>("es");
  const ui = copy[locale] ?? copy.es;
  const tx = captions[locale] ?? captions.es;
  const [activeModule, setActiveModule] = useState<ModuleId>("expedientes");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceResults, setWorkspaceResults] = useState<Workspace[]>([]);
  const [workspaceTotal, setWorkspaceTotal] = useState(0);
  const [workspacePage, setWorkspacePage] = useState(1);
  const [workspacePages, setWorkspacePages] = useState(1);
  const [workspaceSearchMode, setWorkspaceSearchMode] = useState("updated_at");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [llm2Health, setLlm2Health] = useState<Llm2Health>({ reachable: false, status: "checking", detail: "Comprobando llm2..." });
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [kbSummary, setKbSummary] = useState<KbSummary | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePages, setTemplatePages] = useState(1);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateStatus, setTemplateStatus] = useState("activa");
  const [templateDocumentType, setTemplateDocumentType] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSections, setTemplateSections] = useState<DocumentTemplateSection[]>([]);
  const [workspaceTemplateLinks, setWorkspaceTemplateLinks] = useState<WorkspaceTemplateLink[]>([]);
  const [activeDocumentType, setActiveDocumentType] = useState<DocumentKind>("ppt");
  const [documentSpecs, setDocumentSpecs] = useState<DocumentSpec[]>([]);
  const [documentOverview, setDocumentOverview] = useState<DocumentOverview[]>([]);
  const [references, setReferences] = useState<ReferenceCandidate[]>([]);
  const [draftIndex, setDraftIndex] = useState<DraftIndex | null>(null);
  const [chapters, setChapters] = useState<ChapterVersion[]>([]);
  const [chapterVersions, setChapterVersions] = useState<ChapterVersion[]>([]);
  const [versionComparison, setVersionComparison] = useState<Awaited<ReturnType<typeof compareChapterVersions>> | null>(null);
  const [regenerationProposals, setRegenerationProposals] = useState<RegenerationProposal[]>([]);
  const [changeProposals, setChangeProposals] = useState<ChangeProposal[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [aiOutputReviews, setAiOutputReviews] = useState<AiOutputReview[]>([]);
  const [documentComments, setDocumentComments] = useState<DocumentComment[]>([]);
  const [workspaceSources, setWorkspaceSources] = useState<WorkspaceSource[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "conflict" | "error">("saved");
  const [selectedChapterId, setSelectedChapterId] = useState("ppt-objeto-alcance");
  const [editorContent, setEditorContent] = useState("");
  const [chapterSelection, setChapterSelection] = useState<RichEditorSelection>({ text: "", characters: 0 });
  const [chapterInstruction, setChapterInstruction] = useState("");
  const [editorUndoStack, setEditorUndoStack] = useState<string[]>([]);
  const [editorRedoStack, setEditorRedoStack] = useState<string[]>([]);
  const [impacts, setImpacts] = useState<ImpactProposal[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [answerUndoStack, setAnswerUndoStack] = useState<string[]>([]);
  const [answerRedoStack, setAnswerRedoStack] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentField, setCurrentField] = useState("object");
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState("");
  const [streamingChapterId, setStreamingChapterId] = useState("");
  const [streamingGuidedField, setStreamingGuidedField] = useState("");
  const [exportResult, setExportResult] = useState("");
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>(() => emptyMetadataDraft());
  const [metadataBaseline, setMetadataBaseline] = useState<MetadataDraft>(() => emptyMetadataDraft());
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newWorkspaceDraft, setNewWorkspaceDraft] = useState<MetadataDraft>(() => emptyMetadataDraft());
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState("");
  const [switchPromptOpen, setSwitchPromptOpen] = useState(false);
  const [pendingGuidedNavigation, setPendingGuidedNavigation] = useState<GuidedNavigationTarget | null>(null);
  const guidedResetLockRef = useRef<string | null>(null);
  const editorManualSnapshotRef = useRef<string | null>(null);
  const richEditorRef = useRef<ChapterRichEditorHandle | null>(null);
  const skipNextEditorHydrationRef = useRef(false);
  const answerManualSnapshotRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosavedContentRef = useRef("");

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces.find((workspace) => workspace.status !== "archivado") ?? workspaces[0],
    [activeWorkspaceId, workspaces]
  );
  const activeWorkspaceIndex = activeWorkspace?.document_indexes?.[activeDocumentType]
    ?? (activeWorkspace?.target_document === activeDocumentType ? activeWorkspace?.draft_index : undefined);
  const draftIndexForActiveDocument = draftIndex?.document_type === activeDocumentType ? draftIndex : null;
  const visibleChapters = draftIndexForActiveDocument?.chapters ?? activeWorkspaceIndex?.chapters ?? [];
  const selectedChapter = visibleChapters.find((chapter) => chapter.chapter_id === selectedChapterId) ?? visibleChapters[0];
  const selectedVersion = chapters.find((chapter) => chapter.chapter_id === selectedChapter?.chapter_id);
  const activeDocumentExists = Boolean(documentOverview.find((document) => document.document_type === activeDocumentType)?.exists);
  const acceptedReferences = activeWorkspace?.references_by_document?.[activeDocumentType]?.accepted
    ?? (activeWorkspace?.target_document === activeDocumentType ? activeWorkspace?.references?.accepted : [])
    ?? [];
  const activeDocumentSpec = documentSpecs.find((document) => document.document_type === activeDocumentType);
  const baseHeading = ui.headings[activeModule];
  const heading = {
    ...baseHeading,
    title: ["expedientes", "categoria1", "ajustes"].includes(activeModule)
      ? baseHeading.title
      : ["elicit", "indice"].includes(activeModule)
        ? baseHeading.title.replaceAll("PPT", documentLabels[activeDocumentType].short)
        : `${baseHeading.title} · ${documentLabels[activeDocumentType].short}`
  };
  const metadataDirty = useMemo(() => !metadataDraftEquals(metadataDraft, metadataBaseline), [metadataDraft, metadataBaseline]);
  const guidedDirty = useMemo(() => {
    if (activeModule !== "elicit" || !activeWorkspace || streamingGuidedField) return false;
    return normalizeAnswerDraft(answerText) !== normalizeAnswerDraft(guidedFieldValue(activeWorkspace, currentField));
  }, [activeModule, activeWorkspace, answerText, currentField, streamingGuidedField]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    async function refreshLlm2Health() {
      try {
        const health = await fetchLlm2Health();
        if (alive) setLlm2Health(health);
      } catch (error) {
        if (!alive) return;
        setLlm2Health({
          reachable: false,
          status: "error",
          detail: error instanceof Error ? error.message : tx.labels.llmUnavailable
        });
      }
    }
    refreshLlm2Health();
    const timer = window.setInterval(refreshLlm2Health, llm2HealthRefreshMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // Health polling is mounted once; a locale switch must not duplicate the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setWorkspacePage(1);
  }, [workspaceQuery, includeArchived]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshWorkspacePage(workspacePage);
    }, workspaceQuery.trim() ? 280 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceQuery, includeArchived, workspacePage]);

  useEffect(() => {
    setTemplatePage(1);
  }, [templateQuery, templateStatus, templateDocumentType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshTemplates(templatePage);
    }, templateQuery.trim() ? 280 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateQuery, templateStatus, templateDocumentType, templatePage]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateSections([]);
      return;
    }
    let cancelled = false;
    fetchTemplateSections(selectedTemplateId)
      .then((response) => {
        if (!cancelled) setTemplateSections(response.sections);
      })
      .catch(() => {
        if (!cancelled) setTemplateSections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const documentReferences = activeWorkspace.references_by_document?.[activeDocumentType]
      ?? (activeWorkspace.target_document === activeDocumentType ? activeWorkspace.references : undefined);
    setReferences(documentReferences?.proposed ?? []);
    const nextIndex = activeWorkspace.document_indexes?.[activeDocumentType]
      ?? (activeWorkspace.target_document === activeDocumentType ? activeWorkspace.draft_index ?? null : null);
    setDraftIndex(nextIndex);
    if (!nextIndex?.chapters.some((chapter) => chapter.chapter_id === selectedChapterId)) {
      setSelectedChapterId(nextIndex?.chapters[0]?.chapter_id ?? `${activeDocumentType}-sin-indice`);
    }
    if (guidedResetLockRef.current === activeWorkspace.id) {
      guidedResetLockRef.current = null;
    } else {
      const field = normalizeGuidedField(activeWorkspace, firstIncompleteGuidedField(activeWorkspace) ?? activeWorkspace.elicit?.current_field);
      setCurrentField(field);
      setCurrentQuestion(questionFor(field, tx));
      setAnswerText(guidedFieldValue(activeWorkspace, field));
      setAnswerUndoStack([]);
      setAnswerRedoStack([]);
      answerManualSnapshotRef.current = null;
    }
    loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, activeWorkspace?.updated_at, activeDocumentType, locale]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const requested = activeWorkspace.target_document === "memoria" ? "informe_necesidad" : activeWorkspace.target_document;
    if (requested && documentKinds.includes(requested as DocumentKind)) {
      setActiveDocumentType(requested as DocumentKind);
    }
    // The persisted workspace identity is the boundary: unrelated workspace refreshes must not override a user's document switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const nextMetadata = metadataDraftFromWorkspace(activeWorkspace);
    setMetadataDraft(nextMetadata);
    setMetadataBaseline(nextMetadata);
    // Hydrate drafts only from a persisted workspace revision so local edits are never reset by referential changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, activeWorkspace?.updated_at]);

  useEffect(() => {
    if (streamingChapterId) return;
    if (skipNextEditorHydrationRef.current) {
      skipNextEditorHydrationRef.current = false;
      return;
    }
    setEditorContent(stripExternalReferencesSection(selectedVersion?.content ?? ""));
    setChapterSelection({ text: "", characters: 0 });
    setEditorUndoStack([]);
    setEditorRedoStack([]);
    editorManualSnapshotRef.current = null;
    lastAutosavedContentRef.current = stripExternalReferencesSection(selectedVersion?.content ?? "");
    setSaveState("saved");
    // Version identity, not every content echo from autosave, controls editor hydration and cursor preservation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion?.version_id, selectedChapterId, streamingChapterId]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  useEffect(() => {
    const protectPendingChanges = (event: BeforeUnloadEvent) => {
      if (!["pending", "saving", "conflict", "error"].includes(saveState)) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectPendingChanges);
    return () => window.removeEventListener("beforeunload", protectPendingChanges);
  }, [saveState]);

  useEffect(() => {
    if (activeModule !== "elicit" || !activeWorkspace) return;
    const field = normalizeGuidedField(activeWorkspace, currentField || firstIncompleteGuidedField(activeWorkspace));
    setCurrentField(field);
    setCurrentQuestion(questionFor(field, tx));
    setAnswerText(guidedFieldValue(activeWorkspace, field));
    setAnswerUndoStack([]);
    setAnswerRedoStack([]);
    answerManualSnapshotRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, activeWorkspace?.id, locale]);

  useEffect(() => {
    if (!activeWorkspace || !activeDocumentExists || !visibleChapters.some((chapter) => chapter.chapter_id === selectedChapterId)) {
      setChapterVersions([]);
      setRegenerationProposals([]);
      setDocumentComments([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchChapterVersions(activeWorkspace.id, selectedChapterId),
      fetchRegenerationProposals(activeWorkspace.id, selectedChapterId),
      fetchDocumentComments(activeWorkspace.id, selectedChapterId, true)
    ]).then(([versions, proposals, comments]) => {
      if (cancelled) return;
      setChapterVersions(versions.items);
      setRegenerationProposals(proposals.items);
      setDocumentComments(comments.items);
      setVersionComparison(null);
    }).catch(() => {
      if (cancelled) return;
      setChapterVersions([]);
      setRegenerationProposals([]);
      setDocumentComments([]);
    });
    return () => {
      cancelled = true;
    };
    // Primitive chapter/workspace identities avoid refetching on every derived array instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, selectedChapterId, activeDocumentType, activeDocumentExists, visibleChapters.length]);

  async function loadInitialData() {
    try {
      setApiError("");
      const [workspaceResponse, workspacePageResponse, sourceResponse, templateResponse, specResponse] = await Promise.all([
        fetchWorkspaces(true),
        fetchWorkspaces(false, { page: 1, page_size: workspacePageSize }),
        fetchSources(),
        fetchTemplates({ status: templateStatus, page: 1, page_size: templatePageSize }),
        fetchDocumentSpecs()
      ]);
      setWorkspaces(workspaceResponse.items);
      setActiveWorkspaceId(workspaceResponse.active_workspace_id ?? workspaceResponse.items.find((item) => item.status !== "archivado")?.id ?? "");
      applyWorkspacePage(workspacePageResponse);
      setSources(sourceResponse.items);
      setKbSummary(sourceResponse.summary);
      applyTemplatePage(templateResponse);
      setDocumentSpecs(specResponse.items);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
    }
  }

  function applyWorkspacePage(response: Awaited<ReturnType<typeof fetchWorkspaces>>) {
    setWorkspaceResults(response.items);
    setWorkspaceTotal(response.total ?? response.items.length);
    setWorkspacePages(response.pages ?? 1);
    setWorkspaceSearchMode(response.search_mode ?? "updated_at");
    if (response.page && response.page !== workspacePage) setWorkspacePage(response.page);
  }

  async function refreshWorkspacePage(page = workspacePage) {
    try {
      const response = await fetchWorkspaces(includeArchived, {
        query: workspaceQuery,
        page,
        page_size: workspacePageSize
      });
      applyWorkspacePage(response);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
    }
  }

  async function loadWorkspaceDetail(workspaceId: string, documentType: DocumentKind = activeDocumentType) {
    try {
      const chapterResponse = await fetchChapters(workspaceId, documentType);
      const [auditResponse, templateLinkResponse, documentResponse, sourceResponse, changeResponse, issueResponse, aiReviewResponse] = await Promise.all([
        fetchAudit(workspaceId).catch(() => ({ events: [] as AuditEvent[], trace_id: "partial" })),
        fetchWorkspaceTemplates(workspaceId).catch(() => ({ templates: [] as WorkspaceTemplateLink[], trace_id: "partial", workspace_id: workspaceId })),
        fetchWorkspaceDocuments(workspaceId).catch(() => ({ items: [] as DocumentOverview[], trace_id: "partial", workspace_id: workspaceId })),
        fetchWorkspaceSources(workspaceId).catch(() => ({ items: [] as WorkspaceSource[], trace_id: "partial", workspace_id: workspaceId })),
        fetchChangeProposals(workspaceId).catch(() => ({ items: [] as ChangeProposal[], trace_id: "partial", workspace_id: workspaceId })),
        fetchValidationIssues(workspaceId, true).catch(() => ({ items: [] as ValidationIssue[], trace_id: "partial", workspace_id: workspaceId })),
        fetchAiOutputReviews(workspaceId).catch(() => ({ items: [] as AiOutputReview[], trace_id: "partial" }))
      ]);
      setChapters(chapterResponse.chapters);
      setAuditEvents(auditResponse.events);
      setWorkspaceTemplateLinks(templateLinkResponse.templates);
      setDocumentOverview(documentResponse.items);
      setWorkspaceSources(sourceResponse.items);
      setChangeProposals(changeResponse.items);
      setValidationIssues(issueResponse.items);
      setAiOutputReviews(aiReviewResponse.items);
      const detailChapterId = chapterResponse.chapters.some((chapter) => chapter.chapter_id === selectedChapterId)
        ? selectedChapterId
        : chapterResponse.chapters[0]?.chapter_id;
      if (detailChapterId) {
        const [versionResponse, regenerationResponse] = await Promise.all([
          fetchChapterVersions(workspaceId, detailChapterId).catch(() => ({ items: [] as ChapterVersion[] })),
          fetchRegenerationProposals(workspaceId, detailChapterId).catch(() => ({ items: [] as RegenerationProposal[] }))
        ]);
        setChapterVersions(versionResponse.items);
        setRegenerationProposals(regenerationResponse.items);
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
    }
  }

  function applyTemplatePage(response: Awaited<ReturnType<typeof fetchTemplates>>) {
    setTemplates(response.items);
    setTemplateTotal(response.total ?? response.items.length);
    setTemplatePages(response.pages ?? 1);
    if (response.page && response.page !== templatePage) setTemplatePage(response.page);
    if (!selectedTemplateId && response.items[0]) setSelectedTemplateId(response.items[0].id);
  }

  async function refreshTemplates(page = templatePage) {
    try {
      const response = await fetchTemplates({
        status: templateStatus || undefined,
        document_type: templateDocumentType || undefined,
        query: templateQuery,
        page,
        page_size: templatePageSize
      });
      applyTemplatePage(response);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
    }
  }

  async function refreshWorkspaces(nextActiveId?: string) {
    const [response, pageResponse] = await Promise.all([
      fetchWorkspaces(true),
      fetchWorkspaces(includeArchived, { query: workspaceQuery, page: workspacePage, page_size: workspacePageSize })
    ]);
    setWorkspaces(response.items);
    applyWorkspacePage(pageResponse);
    setActiveWorkspaceId(nextActiveId ?? response.active_workspace_id ?? activeWorkspaceId);
  }

  async function runAction<T>(label: string, task: () => Promise<T>) {
    try {
      setBusy(label);
      setApiError("");
      return await task();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function handleCreateMarkdownTemplate(draft: TemplateUploadDraft, markdown: string) {
    const result = await runAction("template-create", () =>
      createTemplate({
        name: draft.name.trim() || templateUi[locale].createTemplate,
        document_type: draft.document_type || "ppt",
        language: draft.language || locale,
        tags: parseTemplateTags(draft.tags),
        markdown
      })
    );
    if (result) {
      setSelectedTemplateId(result.template.id);
      await refreshTemplates(1);
    }
  }

  async function handleUploadTemplateRepository(file: File, draft: TemplateUploadDraft) {
    const result = await runAction("template-upload", () =>
      uploadTemplate({
        file,
        name: draft.name.trim() || file.name.replace(/\.[^.]+$/, ""),
        document_type: draft.document_type || "ppt",
        language: draft.language || locale,
        tags: parseTemplateTags(draft.tags)
      })
    );
    if (result) {
      setSelectedTemplateId(result.template.id);
      await refreshTemplates(1);
    }
  }

  async function handleUploadWorkspaceTemplate(file: File, draft: TemplateUploadDraft) {
    if (!activeWorkspace) return;
    const result = await runAction("template-upload-workspace", () =>
      uploadTemplate({
        file,
        name: draft.name.trim() || file.name.replace(/\.[^.]+$/, ""),
        document_type: draft.document_type || "ppt",
        language: draft.language || locale,
        tags: parseTemplateTags(draft.tags),
        workspace_id: activeWorkspace.id
      })
    );
    if (result) {
      setSelectedTemplateId(result.template.id);
      await refreshTemplates(1);
      await refreshWorkspaces(activeWorkspace.id);
      await loadWorkspaceDetail(activeWorkspace.id);
    }
  }

  async function handleLinkWorkspaceTemplate(templateId: string, notes = "") {
    if (!activeWorkspace || !templateId) return;
    const nextLinks: WorkspaceTemplateLink[] = [
      ...workspaceTemplateLinks.filter((link) => link.template_id !== templateId),
      { template_id: templateId, usage: "estructura", notes }
    ];
    const result = await runAction("template-link", () => updateWorkspaceTemplates(activeWorkspace.id, nextLinks));
    if (result) {
      setWorkspaceTemplateLinks(result.templates);
      setWorkspaces((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
      setWorkspaceResults((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
      await refreshWorkspaces(activeWorkspace.id);
    }
  }

  async function handleRemoveWorkspaceTemplate(templateId: string) {
    if (!activeWorkspace || !templateId) return;
    const nextLinks = workspaceTemplateLinks.filter((link) => link.template_id !== templateId);
    const result = await runAction("template-unlink", () => updateWorkspaceTemplates(activeWorkspace.id, nextLinks));
    if (result) {
      setWorkspaceTemplateLinks(result.templates);
      setWorkspaces((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
      setWorkspaceResults((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
      await refreshWorkspaces(activeWorkspace.id);
    }
  }

  async function handleArchiveTemplate(templateId: string) {
    const result = await runAction("template-archive", () => archiveTemplate(templateId));
    if (result) {
      if (selectedTemplateId === templateId) setSelectedTemplateId("");
      await refreshTemplates();
      if (activeWorkspace) await loadWorkspaceDetail(activeWorkspace.id);
    }
  }

  async function handleRestoreTemplate(templateId: string) {
    const result = await runAction("template-restore", () => restoreTemplate(templateId));
    if (result) {
      setSelectedTemplateId(templateId);
      await refreshTemplates();
    }
  }

  async function handleProcessTemplate(templateId: string) {
    const result = await runAction("template-process", () => processTemplate(templateId));
    if (result) {
      setSelectedTemplateId(templateId);
      await refreshTemplates();
      const sections = await fetchTemplateSections(templateId);
      setTemplateSections(sections.sections);
    }
  }

  function handleOpenCreateWorkspace() {
    setNewWorkspaceDraft(emptyMetadataDraft());
    setNewWorkspaceOpen(true);
  }

  async function handleCreateWorkspace() {
    const result = await runAction("create", () =>
      createWorkspace(metadataPayloadFromDraft(newWorkspaceDraft, locale, tx.labels.newWorkspaceTitle, tx.labels.pendingUnit))
    );
    if (result) {
      setNewWorkspaceOpen(false);
      setActiveWorkspaceId(result.workspace.id);
      await refreshWorkspaces(result.workspace.id);
      setActiveModule("expedientes");
    }
  }

  function applyGuidedField(field: string) {
    const nextField = normalizeGuidedField(activeWorkspace, field);
    if (!nextField) return;
    if (activeWorkspace) guidedResetLockRef.current = activeWorkspace.id;
    setCurrentField(nextField);
    setCurrentQuestion(questionFor(nextField, tx));
    setAnswerText(guidedFieldValue(activeWorkspace, nextField));
  }

  function applyGuidedNavigation(target: GuidedNavigationTarget) {
    if (target.type === "field") {
      applyGuidedField(target.field);
      return;
    }
    if (target.type === "module") {
      setActiveModule(target.module);
      return;
    }
    setLocale(target.locale);
  }

  function requestGuidedNavigation(target: GuidedNavigationTarget) {
    if (target.type === "field" && target.field === currentField) return;
    if (target.type === "module" && target.module === activeModule) return;
    if (target.type === "locale" && target.locale === locale) return;
    if (guidedDirty) {
      setPendingGuidedNavigation(target);
      return;
    }
    applyGuidedNavigation(target);
  }

  async function handleGuidedNavigationPrompt(mode: "save" | "discard" | "cancel") {
    if (mode === "cancel") {
      setPendingGuidedNavigation(null);
      return;
    }
    const target = pendingGuidedNavigation;
    if (!target) return;
    if (mode === "save") {
      const saved = await handleSendAnswer(false);
      if (!saved) return;
    }
    if (mode === "discard") {
      setAnswerText(guidedFieldValue(activeWorkspace, currentField));
    }
    setPendingGuidedNavigation(null);
    applyGuidedNavigation(target);
  }

  async function performActivate(id: string) {
    const result = await runAction("activate", () => activateWorkspace(id));
    if (result) {
      setActiveWorkspaceId(result.active_workspace_id);
      await refreshWorkspaces(result.active_workspace_id);
    }
  }

  async function handleActivate(id: string) {
    if (!id || id === activeWorkspaceId) return;
    if (metadataDirty) {
      setPendingWorkspaceId(id);
      setSwitchPromptOpen(true);
      return;
    }
    await performActivate(id);
  }

  async function handleSwitchAfterPrompt(mode: "save" | "discard" | "cancel") {
    if (mode === "cancel") {
      setSwitchPromptOpen(false);
      setPendingWorkspaceId("");
      return;
    }
    const targetId = pendingWorkspaceId;
    if (!targetId) return;
    if (mode === "save") {
      const saved = await saveMetadataDraft();
      if (!saved) return;
    }
    if (mode === "discard" && activeWorkspace) {
      const resetDraft = metadataDraftFromWorkspace(activeWorkspace);
      setMetadataDraft(resetDraft);
      setMetadataBaseline(resetDraft);
    }
    setSwitchPromptOpen(false);
    setPendingWorkspaceId("");
    await performActivate(targetId);
  }

  async function handleArchive(id: string) {
    await runAction("archive", () => archiveWorkspace(id));
    await refreshWorkspaces();
  }

  async function handleRestore(id: string) {
    const result = await runAction("restore", () => restoreWorkspace(id));
    if (result) await refreshWorkspaces(result.active_workspace_id);
  }

  async function saveMetadataDraft() {
    if (!activeWorkspace) return;
    const payload = metadataPayloadFromDraft(metadataDraft, locale, activeWorkspace.title, "");
    const result = await runAction("save", () => updateWorkspace(activeWorkspace.id, payload));
    if (result) {
      const savedDraft = metadataDraftFromWorkspace(result.workspace);
      setMetadataDraft(savedDraft);
      setMetadataBaseline(savedDraft);
      await refreshWorkspaces(activeWorkspace.id);
    }
    return result;
  }

  async function handleSaveMetadata() {
    await saveMetadataDraft();
  }

  async function ensureSession() {
    if (!activeWorkspace) return "";
    if (sessionId) return sessionId;
    const session = await startGuidedSession(activeWorkspace.id, locale, activeDocumentType);
    setSessionId(session.session_id);
    if (session.next_field) setCurrentField(session.next_field);
    setCurrentQuestion(session.next_question);
    return session.session_id;
  }

  async function handleSendAnswer(advance = false) {
    if (!activeWorkspace || !answerText.trim()) return false;
    const id = await ensureSession();
    if (!id) return false;
    const result = await runAction("answer", () => sendGuidedMessage(id, activeWorkspace.id, currentField, answerText, locale));
    if (result) {
      const targetField = normalizeGuidedField(
        result.workspace,
        advance ? adjacentGuidedField(currentField, 1, result.workspace) ?? firstIncompleteGuidedField(result.workspace) ?? result.next_field ?? currentField : currentField
      );
      if (activeWorkspace) guidedResetLockRef.current = activeWorkspace.id;
      setCurrentField(targetField);
      setCurrentQuestion(questionFor(targetField, tx));
      setAnswerText(guidedFieldValue(result.workspace, targetField));
      setAnswerUndoStack([]);
      setAnswerRedoStack([]);
      answerManualSnapshotRef.current = null;
      await refreshWorkspaces(activeWorkspace.id);
    }
    return Boolean(result);
  }

  async function handleSuggestAnswer(field: string, mode: "suggest" | "expand" = "suggest") {
    if (!activeWorkspace || streamingGuidedField) return;
    const objectHint = field === "object"
      ? answerText
      : guidedFieldValue(activeWorkspace, "object") || guidedFieldValue(activeWorkspace, "need") || answerText;
    if (!objectHint.trim()) {
      setApiError(tx.labels.suggestBlocked);
      return;
    }
    const previousAnswer = answerText;
    if (mode === "expand" && countWords(previousAnswer) < guidedExpandMinWords) {
      setApiError(tx.labels.expandBlocked);
      return;
    }
    setBusy(mode === "expand" ? "aumentar-detalle" : "sugerir-respuesta");
    setStreamingGuidedField(field);
    setApiError("");
    let streamedText = "";
    rememberAnswerSnapshot(previousAnswer);
    answerManualSnapshotRef.current = null;
    setAnswerText("");
    try {
      await suggestGuidedAnswerStream(activeWorkspace.id, field, {
        language: locale,
        currentValue: previousAnswer,
        objectHint,
        mode
      }, (event) => {
        if (event.type === "token") {
          streamedText += event.delta;
          setAnswerText(streamedText);
        } else if (event.type === "replace") {
          streamedText = event.content;
          setAnswerText(event.content);
        } else if (event.type === "final" && event.suggestion.trim()) {
          streamedText = event.suggestion.trim();
          setAnswerText(streamedText);
        } else if (event.type === "blocked") {
          setApiError(event.reason ?? tx.labels.suggestBlockedGeneric);
          setAnswerText(previousAnswer);
        } else if (event.type === "error") {
          setApiError(event.detail || tx.labels.apiError);
          setAnswerText(previousAnswer);
        }
      });
    } catch (error) {
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
      setAnswerText(previousAnswer);
    } finally {
      setStreamingGuidedField("");
      setBusy("");
    }
  }

  async function handleReferences() {
    if (!activeWorkspace) return;
    const rawQuery = [activeWorkspace.title, activeWorkspace.object, activeWorkspace.need, activeWorkspace.lots].filter(Boolean).join(" ");
    const result = await runAction("references", async () => {
      const context = await extractCpvContext({
        title: activeWorkspace.title,
        object: activeWorkspace.object,
        need: activeWorkspace.need,
        language: activeWorkspace.language || locale
      }).catch(() => null);
      const essentialQuery = context?.query?.trim();
      const typedQuery = [essentialQuery, activeWorkspace.contract_type].filter(Boolean).join(" ").trim();
      return autoSelectReferences(activeWorkspace.id, typedQuery || rawQuery, activeDocumentType);
    });
    if (result) {
      setReferences(result.references);
      await refreshWorkspaces(activeWorkspace.id);
      setActiveModule("referencias");
    }
  }

  async function handleToggleReference(referenceId: string, enabled: boolean) {
    if (!activeWorkspace) return;
    const current = activeWorkspace.references_by_document?.[activeDocumentType]?.accepted
      ?? (activeWorkspace.target_document === activeDocumentType ? activeWorkspace.references?.accepted : [])
      ?? [];
    const next = enabled
      ? Array.from(new Set([...current, referenceId]))
      : current.filter((item) => item !== referenceId);
    const result = await runAction("references-save", () => updateAcceptedReferences(activeWorkspace.id, next, activeDocumentType));
    if (result) {
      setReferences(result.references);
      setWorkspaces((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
      setWorkspaceResults((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
    }
  }

  async function handleProposeIndex() {
    if (!activeWorkspace) return;
    const currentIndex = draftIndexForActiveDocument ?? activeWorkspaceIndex;
    const hasPersistedContent = chapters.some((chapter) => Boolean(chapter.content?.trim()));
    if ((currentIndex?.validated || hasPersistedContent) && !window.confirm(indexExperienceCopy[locale].replanConfirmation)) {
      return;
    }
    const result = await runAction("index", () => proposeDraftIndex(activeWorkspace.id, locale, activeDocumentType));
    if (result) {
      setDraftIndex(result.index);
      setSelectedChapterId(result.index.chapters[0]?.chapter_id ?? `${activeDocumentType}-sin-capitulos`);
      await refreshWorkspaces(activeWorkspace.id);
      setActiveModule("indice");
    }
  }

  async function handleValidateIndex(chapters: DraftChapter[]) {
    if (!activeWorkspace || !chapters.length) return;
    let indexId = draftIndex?.index_id ?? activeWorkspaceIndex?.index_id;
    if (!indexId) {
      const initialized = await runAction("index-initialize", () => updateDocumentIndex(activeWorkspace.id, activeDocumentType, chapters));
      if (!initialized) return;
      setDraftIndex(initialized.index);
      setSelectedChapterId(initialized.index.chapters[0]?.chapter_id ?? `${activeDocumentType}-sin-capitulos`);
      indexId = initialized.index.index_id;
    }
    if (!indexId) return;
    const result = await runAction("validate-index", () => validateDraftIndex(indexId));
    if (result) {
      setDraftIndex(result.index);
      await refreshWorkspaces(activeWorkspace.id);
    }
  }

  async function handleSelectDocument(documentType: DocumentKind) {
    if (documentType === activeDocumentType || !activeWorkspace) return;
    if (saveState !== "saved") {
      setApiError("Hay cambios del capítulo pendientes de guardar. Espera al guardado automático o resuelve el conflicto antes de cambiar de documento.");
      return;
    }
    setActiveDocumentType(documentType);
    setSessionId("");
    const nextIndex = activeWorkspace.document_indexes?.[documentType];
    setDraftIndex(nextIndex ?? null);
    setSelectedChapterId(nextIndex?.chapters[0]?.chapter_id ?? `${documentType}-sin-indice`);
    const result = await runAction("document-switch", () => updateWorkspace(activeWorkspace.id, { target_document: documentType }));
    if (result) {
      setWorkspaces((items) => items.map((item) => item.id === result.workspace.id ? result.workspace : item));
    }
  }

  async function handleUpdateIndex(chapters: DraftChapter[]) {
    if (!activeWorkspace || !chapters.length) return;
    const result = await runAction("index-update", () => updateDocumentIndex(activeWorkspace.id, activeDocumentType, chapters));
    if (result) {
      setDraftIndex(result.index);
      if (!result.index.chapters.some((chapter) => chapter.chapter_id === selectedChapterId)) {
        setSelectedChapterId(result.index.chapters[0]?.chapter_id ?? `${activeDocumentType}-sin-capitulos`);
      }
      await refreshWorkspaces(activeWorkspace.id);
      await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
    }
  }

  async function handleDocumentStatus(status: "borrador" | "en_revision" | "final") {
    if (!activeWorkspace) return;
    const result = await runAction("document-status", () => updateDocumentStatus(
      activeWorkspace.id,
      activeDocumentType,
      status,
      `Cambio de estado a ${status} solicitado desde la interfaz`
    ));
    if (result) await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
  }

  async function handleCreateRegeneration() {
    if (!activeWorkspace || !selectedChapter) return;
    const result = await runAction("regeneration", () => createRegenerationProposal(
      activeWorkspace.id,
      selectedChapter.chapter_id,
      activeDocumentType,
      locale,
      chapterInstruction.trim() || "Mejora el apartado conservando las decisiones humanas y marca cualquier dato pendiente."
    ));
    if (result) setRegenerationProposals((items) => [result.proposal, ...items]);
  }

  async function handleResolveRegeneration(proposalId: string, decision: "aceptar" | "rechazar", comment: string) {
    if (!activeWorkspace) return;
    const result = await runAction("regeneration-resolve", () => resolveRegenerationProposal(proposalId, decision, comment));
    if (!result) return;
    await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
    const proposals = await fetchRegenerationProposals(activeWorkspace.id, selectedChapterId);
    setRegenerationProposals(proposals.items);
  }

  async function handleRestoreVersion(versionId: string) {
    if (!activeWorkspace || !selectedChapter) return;
    if (!window.confirm("Se creará una nueva versión a partir de la seleccionada. La versión actual seguirá en el historial. ¿Continuar?")) return;
    const result = await runAction("version-restore", () => restoreChapterVersion(
      activeWorkspace.id,
      selectedChapter.chapter_id,
      versionId,
      "Restauración confirmada desde la interfaz"
    ));
    if (result) await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
  }

  async function handleCompareVersion(versionId: string) {
    const currentVersionId = chapterVersions[0]?.version_id;
    if (!activeWorkspace || !selectedChapter || !currentVersionId || currentVersionId === versionId) return;
    const result = await runAction("version-compare", () => compareChapterVersions(
      activeWorkspace.id,
      selectedChapter.chapter_id,
      versionId,
      currentVersionId
    ));
    if (result) setVersionComparison(result);
  }

  async function handleRunValidation() {
    if (!activeWorkspace) return;
    const result = await runAction("coherence", async () => {
      await Promise.all([runCoherenceReview(activeWorkspace.id), runAdvancedValidation(activeWorkspace.id)]);
      return fetchValidationIssues(activeWorkspace.id, true);
    });
    if (result) setValidationIssues(result.items);
  }

  async function handleReviewAiChapter(decision: "aceptado" | "rechazado", comment: string) {
    if (!activeWorkspace || !selectedVersion?.version_id || !selectedChapterId) return;
    const result = await runAction("ai-review", () => reviewAiChapter(activeWorkspace.id, selectedChapterId, selectedVersion.version_id!, decision, comment));
    if (result) {
      const response = await fetchAiOutputReviews(activeWorkspace.id);
      setAiOutputReviews(response.items);
    }
  }

  async function handleAddDocumentComment(comment: string, anchorText?: string) {
    if (!activeWorkspace || !selectedChapterId) return;
    const result = await runAction("comment-add", () => createDocumentComment(activeWorkspace.id, {
      document_type: activeDocumentType,
      chapter_id: selectedChapterId,
      version_id: selectedVersion?.version_id,
      anchor_text: anchorText || undefined,
      comment_text: comment,
      mentions: []
    }));
    if (result) {
      const response = await fetchDocumentComments(activeWorkspace.id, selectedChapterId, true);
      setDocumentComments(response.items);
    }
  }

  async function handleResolveDocumentComment(commentId: string, status: "abierto" | "resuelto") {
    if (!activeWorkspace) return;
    const result = await runAction("comment-resolve", () => resolveDocumentComment(activeWorkspace.id, commentId, status));
    if (result) setDocumentComments((items) => items.map((item) => item.id === commentId ? { ...item, status } : item));
  }

  async function handleResolveIssue(issueId: string, status: ValidationIssue["status"], comment: string) {
    if (!activeWorkspace) return;
    const result = await runAction("issue-resolve", () => resolveValidationIssue(issueId, status, comment));
    if (result) {
      const response = await fetchValidationIssues(activeWorkspace.id, true);
      setValidationIssues(response.items);
    }
  }

  async function handleResolveChange(proposalId: string, decision: "aceptar" | "rechazar", comment: string) {
    if (!activeWorkspace) return;
    const result = await runAction("change-resolve", () => resolveChangeProposal(proposalId, decision, comment));
    if (result) {
      const response = await fetchChangeProposals(activeWorkspace.id);
      setChangeProposals(response.items);
    }
  }

  async function handleUploadSource(file: File, title?: string) {
    if (!activeWorkspace) return;
    const result = await runAction("source-upload", () => uploadWorkspaceSource(activeWorkspace.id, file, title));
    if (result) setWorkspaceSources((items) => [result.source, ...items]);
  }

  async function handleToggleWorkspaceSource(sourceId: string, included: boolean) {
    if (!activeWorkspace) return;
    const result = await runAction("source-toggle", () => updateWorkspaceSource(activeWorkspace.id, sourceId, included));
    if (result) setWorkspaceSources((items) => items.map((item) => item.id === sourceId ? result.source : item));
  }

  function rememberAnswerSnapshot(snapshot = answerText) {
    setAnswerUndoStack((previous) => {
      if (previous[previous.length - 1] === snapshot) return previous;
      return [...previous.slice(-19), snapshot];
    });
    setAnswerRedoStack([]);
  }

  function handleAnswerChange(nextText: string) {
    if (!streamingGuidedField && answerManualSnapshotRef.current === null) {
      answerManualSnapshotRef.current = answerText;
      rememberAnswerSnapshot(answerText);
    }
    setAnswerText(nextText);
  }

  function handleAnswerUndo() {
    const previous = answerUndoStack[answerUndoStack.length - 1];
    if (previous === undefined || streamingGuidedField) return;
    setAnswerUndoStack((items) => items.slice(0, -1));
    setAnswerRedoStack((items) => [answerText, ...items].slice(0, 20));
    setAnswerText(previous);
    answerManualSnapshotRef.current = null;
  }

  function handleAnswerRedo() {
    const next = answerRedoStack[0];
    if (next === undefined || streamingGuidedField) return;
    setAnswerRedoStack((items) => items.slice(1));
    setAnswerUndoStack((items) => [...items.slice(-19), answerText]);
    setAnswerText(next);
    answerManualSnapshotRef.current = null;
  }

  function rememberEditorSnapshot(snapshot = editorContent) {
    const cleanSnapshot = stripExternalReferencesSection(snapshot);
    setEditorUndoStack((previous) => {
      if (previous[previous.length - 1] === cleanSnapshot) return previous;
      return [...previous.slice(-19), cleanSnapshot];
    });
    setEditorRedoStack([]);
  }

  function handleEditorChange(nextContent: string) {
    if (!streamingChapterId && editorManualSnapshotRef.current === null) {
      editorManualSnapshotRef.current = stripExternalReferencesSection(editorContent);
      rememberEditorSnapshot(editorContent);
    }
    const cleanContent = stripExternalReferencesSection(nextContent);
    setEditorContent(cleanContent);
    if (cleanContent === lastAutosavedContentRef.current || !activeWorkspace || !selectedChapter || streamingChapterId) {
      setSaveState("saved");
      return;
    }
    setSaveState("pending");
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    const workspaceId = activeWorkspace.id;
    const chapter = selectedChapter;
    const expectedVersionId = selectedVersion?.version_id;
    autosaveTimerRef.current = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await updateChapter(workspaceId, chapter.chapter_id, cleanContent, "guardado automático", {
          expectedVersionId,
          autosave: true,
          comment: "Guardado automático seguro desde el editor"
        });
        const savedVersion: ChapterVersion = {
          ...response.version,
          chapter_id: chapter.chapter_id,
          document_id: response.version.document_id ?? `${workspaceId}:${chapter.chapter_id}`,
          title: chapter.title,
          status: "borrador"
        };
        setChapters((items) => [
          ...items.filter((item) => item.chapter_id !== chapter.chapter_id),
          savedVersion
        ]);
        setChapterVersions((items) => [savedVersion, ...items.filter((item) => item.version_id !== savedVersion.version_id)]);
        lastAutosavedContentRef.current = cleanContent;
        editorManualSnapshotRef.current = null;
        setSaveState("saved");
      } catch (error) {
        const detail = error instanceof Error ? error.message : tx.labels.apiError;
        setApiError(detail);
        setSaveState(detail.includes("409") ? "conflict" : "error");
      }
    }, 1200);
  }

  function handleEditorUndo() {
    const previous = editorUndoStack[editorUndoStack.length - 1];
    if (previous === undefined || streamingChapterId) return;
    const current = stripExternalReferencesSection(editorContent);
    setEditorUndoStack((items) => items.slice(0, -1));
    setEditorRedoStack((items) => [current, ...items].slice(0, 20));
    setEditorContent(previous);
    setChapterSelection({ text: "", characters: 0 });
    editorManualSnapshotRef.current = null;
  }

  function handleEditorRedo() {
    const next = editorRedoStack[0];
    if (next === undefined || streamingChapterId) return;
    const current = stripExternalReferencesSection(editorContent);
    setEditorRedoStack((items) => items.slice(1));
    setEditorUndoStack((items) => [...items.slice(-19), current]);
    setEditorContent(next);
    setChapterSelection({ text: "", characters: 0 });
    editorManualSnapshotRef.current = null;
  }

  async function handleDraftChapter(chapter?: DraftChapter) {
    const target = chapter ?? selectedChapter;
    if (!activeWorkspace || !target) return;
    if (target.chapter_id === selectedChapter?.chapter_id && saveState !== "saved") {
      setApiError("Espera a que termine el guardado del apartado antes de iniciar una redacción con IA.");
      return;
    }
    const persistedTargetContent = stripExternalReferencesSection(
      chapters.find((item) => item.chapter_id === target.chapter_id)?.content ?? ""
    );
    let streamedContent = "";
    let receivedContent = false;
    let saved = false;
    let streamProblem = "";
    try {
      setBusy("draft-chapter");
      setStreamingChapterId(target.chapter_id);
      setApiError("");
      setSelectedChapterId(target.chapter_id);
      if (stripExternalReferencesSection(editorContent).trim()) {
        rememberEditorSnapshot(editorContent);
      }
      editorManualSnapshotRef.current = null;
      setActiveModule("redaccion");
      await draftChapterStream(activeWorkspace.id, target.chapter_id, locale, (event) => {
        if (event.type === "token") {
          if (!receivedContent) {
            receivedContent = true;
            streamedContent = "";
          }
          streamedContent += event.delta;
          setEditorContent(stripExternalReferencesSection(streamedContent));
        }
        if (event.type === "replace") {
          receivedContent = true;
          streamedContent = event.content;
          setEditorContent(stripExternalReferencesSection(streamedContent));
        }
        if (event.type === "blocked") {
          streamProblem = event.reason ?? "La redacción ha sido bloqueada.";
          setApiError(streamProblem);
        }
        if (event.type === "error") {
          streamProblem = event.detail;
          setApiError(streamProblem);
        }
        if (event.type === "saved") {
          saved = true;
        }
      }, activeDocumentType);
      if (streamProblem || !saved) {
        setEditorContent(persistedTargetContent);
        if (!streamProblem) {
          setApiError("La generación terminó sin guardar una versión. Se ha recuperado el último contenido persistido.");
        }
        return;
      }
      await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
    } catch (error) {
      setEditorContent(persistedTargetContent);
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
    } finally {
      skipNextEditorHydrationRef.current = true;
      setBusy("");
      setStreamingChapterId("");
    }
  }

  async function handleSaveChapter() {
    if (!activeWorkspace || !selectedChapter || !editorContent.trim()) return;
    setSaveState("saving");
    setBusy("save-chapter");
    setApiError("");
    try {
      await updateChapter(
        activeWorkspace.id,
        selectedChapter.chapter_id,
        stripExternalReferencesSection(editorContent),
        "edición humana",
        { expectedVersionId: selectedVersion?.version_id, comment: "Guardado manual desde el editor" }
      );
      editorManualSnapshotRef.current = null;
      lastAutosavedContentRef.current = stripExternalReferencesSection(editorContent);
      setSaveState("saved");
      await loadWorkspaceDetail(activeWorkspace.id, activeDocumentType);
    } catch (error) {
      const detail = error instanceof Error ? error.message : tx.labels.apiError;
      setApiError(detail);
      setSaveState(detail.includes("409") ? "conflict" : "error");
    } finally {
      setBusy("");
    }
  }

  async function handleImproveChapter(instructionOverride?: string) {
    if (!activeWorkspace || !selectedChapter || !editorContent.trim() || streamingChapterId) return;
    const content = stripExternalReferencesSection(editorContent);
    const selectedText = richEditorRef.current?.getSelectedText() || chapterSelection.text || "";
    const improvementSessionId = `chapter-improve-${Date.now()}`;
    let streamedText = "";
    let failed = false;

    function applyImprovedText(value: string) {
      const improved = stripExternalReferencesSection(value).trimStart();
      if (selectedText && richEditorRef.current) {
        richEditorRef.current.updateSelectionReplacement(improved, improvementSessionId);
      } else {
        setEditorContent(improved);
        setChapterSelection({ text: "", characters: 0 });
      }
    }

    rememberEditorSnapshot(content);
    editorManualSnapshotRef.current = null;
    setBusy("improve-chapter");
    setStreamingChapterId(selectedChapter.chapter_id);
    setApiError("");
    if (selectedText) richEditorRef.current?.beginSelectionReplacement(improvementSessionId);
    try {
      await improveChapterTextStream(activeWorkspace.id, selectedChapter.chapter_id, content, {
        selectedText,
        instruction: instructionOverride?.trim() || (selectedText ? tx.labels.improveSelectionInstruction : tx.labels.improveChapterInstruction),
        language: locale
      }, (event) => {
        if (event.type === "token") {
          streamedText += event.delta;
          applyImprovedText(streamedText);
        } else if (event.type === "replace") {
          streamedText = event.content;
          applyImprovedText(streamedText);
        } else if (event.type === "final") {
          streamedText = event.improved_text;
          applyImprovedText(streamedText);
        } else if (event.type === "blocked") {
          failed = true;
          setApiError(event.reason ?? tx.labels.improveBlocked);
          setEditorContent(content);
          richEditorRef.current?.resetSelectionReplacement();
        } else if (event.type === "error") {
          failed = true;
          setApiError(event.detail || tx.labels.apiError);
          setEditorContent(content);
          richEditorRef.current?.resetSelectionReplacement();
        }
      });
    } catch (error) {
      failed = true;
      setApiError(error instanceof Error ? error.message : tx.labels.apiError);
      setEditorContent(content);
      richEditorRef.current?.resetSelectionReplacement();
    } finally {
      skipNextEditorHydrationRef.current = true;
      setBusy("");
      setStreamingChapterId("");
      richEditorRef.current?.resetSelectionReplacement();
    }
    if (failed) setChapterSelection({ text: selectedText, characters: selectedText.length });
  }

  async function handleImpactProposals() {
    if (!activeWorkspace || !selectedChapter) return;
    const result = await runAction("impacts", () => fetchImpactProposals(activeWorkspace.id, selectedChapter.chapter_id, stripExternalReferencesSection(editorContent)));
    if (result) setImpacts(result.proposals);
  }

  async function handleExport() {
    if (!activeWorkspace) return;
    const result = await runAction("export", () => exportDocx(activeWorkspace.id, activeDocumentType));
    if (!result) return;
    const download = await runAction("download-export", () => downloadDocx(activeWorkspace.id, result.filename, activeDocumentType));
    if (download) {
      triggerDownload(download.blob, download.filename);
    }
    setExportResult(`${result.object_key} · ${Math.round(result.bytes / 1024)} KB`);
  }

  async function handleExportDossier() {
    if (!activeWorkspace) return;
    const existingDocuments = documentOverview.filter((document) => document.exists).map((document) => document.document_type);
    const dossierDocuments = existingDocuments.length ? existingDocuments : documentKinds;
    const result = await runAction("export-dossier", () => exportDossier(activeWorkspace.id, dossierDocuments));
    if (!result) return;
    const download = await runAction("download-dossier", () => downloadDossier(activeWorkspace.id, result.filename, dossierDocuments));
    if (download) triggerDownload(download.blob, download.filename);
    setExportResult(`${result.documents.length} documentos · ${Math.round(result.bytes / 1024)} KB`);
  }

  const llm2Online = llm2Health.status === "ok" && llm2Health.reachable;
  const llm2Busy = llm2Online && Boolean(streamingGuidedField || streamingChapterId || ["sugerir-respuesta", "aumentar-detalle", "draft-chapter", "improve-chapter"].includes(busy));
  const llm2Tooltip = llm2Online
    ? `${tx.labels.llmReachable} · ${llm2Health.model ?? tx.labels.modelConfigured} · ${llm2Health.latency_ms ?? "?"} ms`
    : `${tx.labels.llmNotReachable} · ${llm2Health.detail ?? tx.labels.noResponse}`;
  const llm2StatusLabel = llm2Busy ? `${tx.labels.llmReachable} · ${formatCaption(tx.labels.working, { task: busy || "llm2" })}` : (llm2Online ? tx.labels.llmReachable : tx.labels.llmNotReachable);

  return (
    <main className="app-shell elicit-app">
      <aside className="sidebar" aria-label={tx.labels.navAria}>
        <div className="brand">
          <Image className="brand-logo" src="/brand/xtender-wordmark.svg" alt="xTender" width={150} height={35} priority />
        </div>
        <button className="primary-action tooltip-wrap" data-tooltip={tx.tips.create} type="button" onClick={handleOpenCreateWorkspace}>
          <Plus size={18} aria-hidden="true" />
          {ui.new as string}
        </button>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={clsx("nav-item tooltip-wrap", activeModule === item.id && "active")} data-tooltip={String((ui.nav as Record<ModuleId, string>)[item.id])} type="button" onClick={() => requestGuidedNavigation({ type: "module", module: item.id })}>
                <Icon size={18} aria-hidden="true" />
                <span>{(ui.nav as Record<ModuleId, string>)[item.id]}</span>
              </button>
            );
          })}
        </nav>
        <div className={clsx("model-chip tooltip-wrap", llm2Online ? "online" : "offline", llm2Busy && "busy")} data-tooltip={llm2Tooltip}>
          <span className="model-status-dot" aria-label={llm2StatusLabel} />
          <Bot size={16} aria-hidden="true" />
          <span>llm2</span>
          <strong>128K</strong>
        </div>
        <a className="powered-by" href="https://www.techfriendly.es" target="_blank" rel="noreferrer">
          {ui.powered as string} <strong>TECH friendly</strong>
        </a>
      </aside>

      <section className="workspace-shell">
        <header className="topbar">
          <label className="active-workspace-select tooltip-wrap" data-tooltip={tx.tips.activeWorkspace}>
            <span>{ui.active as string}</span>
            <select value={activeWorkspace?.id ?? ""} onChange={(event) => handleActivate(event.target.value)}>
              {workspaces.filter((workspace) => workspace.status !== "archivado").map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.id} · {workspace.title}</option>
              ))}
            </select>
          </label>
          <div className="topbar-actions">
            <div className="segmented segmented-five tooltip-wrap" data-tooltip={tx.labels.languageTooltip}>
              {localeOptions.map((option) => (
                <button key={option.code} type="button" className={locale === option.code ? "selected" : ""} onClick={() => requestGuidedNavigation({ type: "locale", locale: option.code })}>
                  {option.short}
                </button>
              ))}
            </div>
            <IconButton icon={<History size={18} />} title={tx.labels.audit} tooltip={tx.tips.audit} onClick={() => requestGuidedNavigation({ type: "module", module: "fuentes" })} />
            <IconButton icon={<Settings size={18} />} title={tx.labels.admin} tooltip={tx.tips.admin} onClick={() => requestGuidedNavigation({ type: "module", module: "ajustes" })} />
            <button type="button" className="export-button tooltip-wrap" data-tooltip={tx.tips.export} onClick={handleExport}>
              <Download size={17} aria-hidden="true" />
              {ui.export as string} {documentLabels[activeDocumentType].short}
            </button>
          </div>
        </header>

        <DocumentSwitcher
          active={activeDocumentType}
          documents={documentOverview}
          onSelect={handleSelectDocument}
          onStatus={handleDocumentStatus}
          busy={busy}
        />

        <div className="content">
          <section className="screen-heading elicit-heading">
            <div>
              <p className="eyebrow">{heading.label}</p>
              <h1>{heading.title}</h1>
              <p>{!["expedientes", "categoria1", "ajustes"].includes(activeModule) && activeDocumentSpec ? activeDocumentSpec.purpose : heading.subtitle}</p>
            </div>
            <div className="ai-disclosure">
              <Sparkles size={16} aria-hidden="true" />
              <span>{ui.ai as string}</span>
            </div>
          </section>

          {apiError && (
            <div className="global-error-banner" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{apiError}</span>
              <button type="button" onClick={() => setApiError("")} aria-label="Cerrar aviso">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {activeModule === "expedientes" && (
            <ExpedientesScreen
              activeWorkspace={activeWorkspace}
              workspaces={workspaceResults}
              total={workspaceTotal}
              page={workspacePage}
              pages={workspacePages}
              searchMode={workspaceSearchMode}
              query={workspaceQuery}
              includeArchived={includeArchived}
              onQuery={setWorkspaceQuery}
              onPage={setWorkspacePage}
              onIncludeArchived={setIncludeArchived}
              onCreate={handleOpenCreateWorkspace}
              onActivate={handleActivate}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onSave={handleSaveMetadata}
              metadataDraft={metadataDraft}
              metadataDirty={metadataDirty}
              onMetadataDraftChange={setMetadataDraft}
              ui={ui}
              tx={tx}
              locale={locale}
            />
          )}

          {activeModule === "categoria1" && (
            <Category1Center
              workspace={activeWorkspace}
              locale={locale}
              onWorkspaceChanged={() => activeWorkspace && loadWorkspaceDetail(activeWorkspace.id, activeDocumentType)}
            />
          )}

          {activeModule === "elicit" && (
            <PreparationScreen
              workspace={activeWorkspace}
              currentField={currentField}
              currentQuestion={questionFor(currentField, tx) || currentQuestion}
              answerText={answerText}
              onAnswerText={handleAnswerChange}
              onSelectField={(field) => requestGuidedNavigation({ type: "field", field })}
              onSaveAnswer={handleSendAnswer}
              onSuggestAnswer={handleSuggestAnswer}
              streamingGuidedField={streamingGuidedField}
              busy={busy}
              onUndo={handleAnswerUndo}
              onRedo={handleAnswerRedo}
              canUndo={answerUndoStack.length > 0}
              canRedo={answerRedoStack.length > 0}
              templates={templates}
              workspaceTemplateLinks={workspaceTemplateLinks}
              locale={locale}
              onLinkTemplate={handleLinkWorkspaceTemplate}
              onRemoveTemplate={handleRemoveWorkspaceTemplate}
              onUploadTemplateForWorkspace={handleUploadWorkspaceTemplate}
              onOpenSettings={() => requestGuidedNavigation({ type: "module", module: "ajustes" })}
              ui={ui}
              tx={tx}
            />
          )}

          {activeModule === "referencias" && (
            <ReferencesScreen
              workspace={activeWorkspace}
              references={references}
              acceptedReferences={acceptedReferences}
              documentType={activeDocumentType}
              sources={sources}
              kbSummary={kbSummary}
              onSearch={handleReferences}
              onToggleReference={handleToggleReference}
              locale={locale}
              busy={busy}
              ui={ui}
              tx={tx}
            />
          )}

          {activeModule === "indice" && (
            <IndexScreen
              workspace={activeWorkspace}
              index={draftIndex ?? activeWorkspaceIndex ?? null}
              documentType={activeDocumentType}
              selectedChapterId={selectedChapterId}
              onSelect={setSelectedChapterId}
              onPropose={handleProposeIndex}
              onValidate={handleValidateIndex}
              onUpdate={handleUpdateIndex}
              onDraft={handleDraftChapter}
              locale={locale}
              ui={ui}
              tx={tx}
            />
          )}

          {activeModule === "redaccion" && (
            <EditorScreen
              workspace={activeWorkspace}
              index={draftIndex ?? activeWorkspaceIndex ?? null}
              chapters={chapters}
              documentType={activeDocumentType}
              selectedVersion={selectedVersion}
              versions={chapterVersions}
              versionComparison={versionComparison}
              regenerationProposals={regenerationProposals}
              aiReviews={aiOutputReviews}
              comments={documentComments}
              saveState={saveState}
              selectedChapterId={selectedChapterId}
              editorContent={editorContent}
              customInstruction={chapterInstruction}
              impacts={impacts}
              streamingChapterId={streamingChapterId}
              busy={busy}
              locale={locale}
              selection={chapterSelection}
              editorRef={richEditorRef}
              onSelect={setSelectedChapterId}
              onEditorChange={handleEditorChange}
              onSelectionChange={setChapterSelection}
              onCustomInstruction={setChapterInstruction}
              onDraft={handleDraftChapter}
              onSave={handleSaveChapter}
              onImprove={handleImproveChapter}
              onImpacts={handleImpactProposals}
              onCreateRegeneration={handleCreateRegeneration}
              onResolveRegeneration={handleResolveRegeneration}
              onReviewAiChapter={handleReviewAiChapter}
              onAddComment={handleAddDocumentComment}
              onResolveComment={handleResolveDocumentComment}
              onRestoreVersion={handleRestoreVersion}
              onCompareVersion={handleCompareVersion}
              onCloseComparison={() => setVersionComparison(null)}
              onUndo={handleEditorUndo}
              onRedo={handleEditorRedo}
              canUndo={editorUndoStack.length > 0}
              canRedo={editorRedoStack.length > 0}
              ui={ui}
              tx={tx}
            />
          )}

          {activeModule === "validacion" && (
            <ValidationScreen
              workspace={activeWorkspace}
              documents={documentOverview}
              issues={validationIssues}
              changes={changeProposals}
              busy={busy}
              onRun={handleRunValidation}
              onResolveIssue={handleResolveIssue}
              onResolveChange={handleResolveChange}
              tx={tx}
            />
          )}
          {activeModule === "fuentes" && (
            <SourcesExportScreen
              sources={sources}
              workspaceSources={workspaceSources}
              auditEvents={auditEvents}
              references={references}
              exportResult={exportResult}
              documentType={activeDocumentType}
              busy={busy}
              onUpload={handleUploadSource}
              onToggleSource={handleToggleWorkspaceSource}
              onExport={handleExport}
              onExportDossier={handleExportDossier}
              ui={ui}
              tx={tx}
            />
          )}
          {activeModule === "ajustes" && (
            <SettingsScreen
              templates={templates}
              total={templateTotal}
              page={templatePage}
              pages={templatePages}
              query={templateQuery}
              status={templateStatus}
              documentType={templateDocumentType}
              selectedTemplateId={selectedTemplateId}
              sections={templateSections}
              busy={busy}
              locale={locale}
              onQuery={setTemplateQuery}
              onStatus={setTemplateStatus}
              onDocumentType={setTemplateDocumentType}
              onPage={setTemplatePage}
              onSelect={setSelectedTemplateId}
              onUpload={handleUploadTemplateRepository}
              onCreateMarkdown={handleCreateMarkdownTemplate}
              onArchive={handleArchiveTemplate}
              onRestore={handleRestoreTemplate}
              onProcess={handleProcessTemplate}
              ui={ui}
              tx={tx}
            />
          )}
        </div>
      </section>
      {newWorkspaceOpen && (
        <NewWorkspaceModal
          draft={newWorkspaceDraft}
          onDraftChange={setNewWorkspaceDraft}
          onClose={() => setNewWorkspaceOpen(false)}
          onCreate={handleCreateWorkspace}
          tx={tx}
          locale={locale}
        />
      )}
      {switchPromptOpen && (
        <UnsavedChangesDialog
          onSave={() => handleSwitchAfterPrompt("save")}
          onDiscard={() => handleSwitchAfterPrompt("discard")}
          onCancel={() => handleSwitchAfterPrompt("cancel")}
          tx={tx}
        />
      )}
      {pendingGuidedNavigation && (
        <UnsavedChangesDialog
          onSave={() => handleGuidedNavigationPrompt("save")}
          onDiscard={() => handleGuidedNavigationPrompt("discard")}
          onCancel={() => handleGuidedNavigationPrompt("cancel")}
          title={tx.labels.guidedUnsavedTitle}
          text={tx.labels.guidedUnsavedText}
          tx={tx}
        />
      )}
    </main>
  );
}

function Category1Center({
  workspace,
  locale,
  onWorkspaceChanged
}: {
  workspace?: Workspace;
  locale: Locale;
  onWorkspaceChanged: () => void;
}) {
  type CenterTab = "resumen" | "planificacion" | "exploradores" | "economia" | "cumplimiento";
  const catalan = locale === "ca" || locale === "va";
  const [tab, setTab] = useState<CenterTab>("resumen");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [capabilities, setCapabilities] = useState<Category1Capability[]>([]);
  const [annualPlan, setAnnualPlan] = useState<AnnualPlanItem[]>([]);
  const [marketStudies, setMarketStudies] = useState<MarketStudy[]>([]);
  const [risks, setRisks] = useState<ProcurementRisk[]>([]);
  const [schedules, setSchedules] = useState<ProcurementSchedule[]>([]);
  const [calculations, setCalculations] = useState<EconomicCalculation[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [connectors, setConnectors] = useState<OfficialConnector[]>([]);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>(["boe", "dogc"]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [literacy, setLiteracy] = useState<LiteracyModule[]>([]);
  const [complianceControls, setComplianceControls] = useState<Array<{ id: string; requirement: string; status: string; evidence: string }>>([]);
  const [clauses, setClauses] = useState<ClauseCatalogEntry[]>([]);
  const [explorerKind, setExplorerKind] = useState<"licitaciones" | "normativa" | "doctrina" | "jurisprudencia">("licitaciones");
  const [explorerQuery, setExplorerQuery] = useState(workspace?.object || "contratación pública inteligencia artificial");
  const [explorerResults, setExplorerResults] = useState<Array<SearchHit | LegalKnowledgeSource>>([]);
  const [explorerElapsedMs, setExplorerElapsedMs] = useState<number | null>(null);
  const [explorerHasSearched, setExplorerHasSearched] = useState(false);
  const [explorerRelaxedFilters, setExplorerRelaxedFilters] = useState<string[]>([]);
  const [riskDraft, setRiskDraft] = useState({ category: "Planificación", description: "", probability: 3, impact: 3, mitigation: "" });
  const [taskDraft, setTaskDraft] = useState({ title: "", due_date: "", priority: "media" as "baja" | "media" | "alta" | "critica" });
  const [marketScope, setMarketScope] = useState(workspace?.object || "");
  const [economicDraft, setEconomicDraft] = useState({ description: "", quantity: 1, unit_price: 0, periods: 1, tax_rate: workspace?.tax_rate ?? 21, extensions: 0, options: 0, modification: 0, validated: false });
  const [clauseDraft, setClauseDraft] = useState({ title: "", content: "", documentType: "pcap" as DocumentKind });
  const [renderedClause, setRenderedClause] = useState("");
  const [literacyDraft, setLiteracyDraft] = useState<Record<string, { score: number; attested: boolean }>>({});

  async function loadCenter() {
    setError("");
    try {
      const globalRequests = await Promise.all([
        fetchCategory1Capabilities(),
        fetchAnnualPlan(year),
        fetchOfficialConnectors(),
        fetchSavedSearches(),
        fetchLiteracyStatus(),
        fetchComplianceProfile(),
        fetchClauseCatalog()
      ]);
      setCapabilities(globalRequests[0].items);
      setAnnualPlan(globalRequests[1].items);
      setConnectors(globalRequests[2].items);
      setSavedSearches(globalRequests[3].items);
      setLiteracy(globalRequests[4].items);
      setComplianceControls(globalRequests[5].controls);
      setClauses(globalRequests[6].items);
      if (workspace) {
        const scoped = await Promise.all([
          fetchMarketStudies(workspace.id),
          fetchProcurementRisks(workspace.id),
          fetchProcurementSchedules(workspace.id),
          fetchEconomicCalculations(workspace.id),
          fetchWorkspaceTasks(workspace.id)
        ]);
        setMarketStudies(scoped[0].items);
        setRisks(scoped[1].items);
        setSchedules(scoped[2].items);
        setCalculations(scoped[3].items);
        setTasks(scoped[4].items);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el centro de preparación avanzada.");
    }
  }

  useEffect(() => {
    setExplorerQuery(workspace?.object || "contratación pública inteligencia artificial");
    setExplorerResults([]);
    setExplorerElapsedMs(null);
    setExplorerHasSearched(false);
    setExplorerRelaxedFilters([]);
    setMarketScope(workspace?.object || "");
    void loadCenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, year]);

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await loadCenter();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "La operación no pudo completarse.");
    } finally {
      setBusy("");
    }
  }

  async function searchExplorer() {
    if (explorerQuery.trim().length < 2) return;
    const startedAt = performance.now();
    setBusy("explorer");
    setError("");
    try {
      if (explorerKind === "licitaciones") {
        const response = await exploreTenders(explorerQuery, { cpv: workspace?.cpv_codes?.[0] || workspace?.cpv || undefined, language: locale, limit: 30 });
        setExplorerResults(response.items);
        setExplorerRelaxedFilters(response.relaxed_filters ?? []);
      } else {
        const response = await exploreLegalSources(explorerQuery, explorerKind);
        setExplorerResults(response.items);
        setExplorerRelaxedFilters([]);
      }
      setExplorerHasSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "La búsqueda no pudo completarse.");
    } finally {
      setExplorerElapsedMs(Math.max(1, Math.round(performance.now() - startedAt)));
      setBusy("");
    }
  }

  const activePlanItem = workspace ? annualPlan.find((item) => item.workspace_id === workspace.id) : undefined;
  const openRisks = risks.filter((risk) => !["cerrado", "aceptado"].includes(risk.status));
  const highRisks = openRisks.filter((risk) => ["alto", "critico"].includes(risk.level));
  const tabs: Array<{ id: CenterTab; label: string; icon: ReactNode }> = [
    { id: "resumen", label: catalan ? "Cobertura" : "Cobertura", icon: <BadgeCheck size={16} /> },
    { id: "planificacion", label: catalan ? "Planificació" : "Planificación", icon: <CalendarDays size={16} /> },
    { id: "exploradores", label: catalan ? "Exploradors" : "Exploradores", icon: <Search size={16} /> },
    { id: "economia", label: catalan ? "Economia" : "Economía", icon: <Landmark size={16} /> },
    { id: "cumplimiento", label: catalan ? "Compliment" : "Cumplimiento", icon: <ShieldCheck size={16} /> }
  ];

  return (
    <div className="category1-center">
      <nav className="category1-tabs" aria-label="Capacidades de preparación avanzada">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </nav>
      {error && <div className="category1-message error" role="alert"><AlertTriangle size={16} />{error}</div>}
      {notice && <div className="category1-message success" role="status"><Check size={16} />{notice}</div>}

      {tab === "resumen" && (
        <div className="category1-section-grid">
          <section className="main-panel category1-hero">
            <div>
              <p className="eyebrow">Cobertura funcional de preparación contractual</p>
              <h2>Servicios de preparación con supervisión humana</h2>
              <p>La matriz muestra capacidad real, corpus disponible y límites. “Operativo” no equivale a certificación ENS ni a dictamen jurídico.</p>
            </div>
            <div className="category1-kpis">
              <span><strong>{capabilities.filter((item) => item.status === "operativo").length}</strong> operativos</span>
              <span><strong>{capabilities.filter((item) => item.status.includes("sin_corpus")).length}</strong> sin corpus</span>
              <span><strong>{capabilities.length}</strong> servicios auditados</span>
            </div>
          </section>
          {(["planificacion", "redaccion", "validacion"] as const).map((group) => (
            <section className="main-panel capability-group" key={group}>
              <PanelTitle
                icon={group === "planificacion" ? <CalendarDays size={18} /> : group === "redaccion" ? <FileText size={18} /> : <ClipboardCheck size={18} />}
                title={group === "planificacion" ? "Planificación" : group === "redaccion" ? "Redacción y exploración" : "Validación"}
                action={`${capabilities.filter((item) => item.group === group).length}`}
              />
              <div className="capability-list">
                {capabilities.filter((item) => item.group === group).map((item) => (
                  <article key={item.id}>
                    <span className={clsx("capability-state", item.status === "operativo" ? "ok" : "warning")} aria-hidden="true" />
                    <div><strong>{item.label}</strong>{item.limitation && <small>{item.limitation}</small>}</div>
                    <StatusPill label={item.status} tx={captions.es} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "planificacion" && (
        <div className="category1-section-grid planning-grid">
          <section className="main-panel">
            <PanelTitle icon={<CalendarDays size={18} />} title={`Plan anual ${year}`} action={`${annualPlan.length}`} />
            <div className="category1-inline-form">
              <label><span>Año</span><input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.currentTarget.value))} /></label>
              <button
                type="button"
                disabled={!workspace || Boolean(activePlanItem) || busy === "plan"}
                onClick={() => workspace && act("plan", () => saveAnnualPlanItem({
                  workspace_id: workspace.id,
                  plan_year: year,
                  title: workspace.title,
                  need: workspace.need,
                  contracting_body: workspace.contracting_body,
                  promoting_unit: workspace.promoting_unit,
                  cpv_codes: workspace.cpv_codes || (workspace.cpv ? [workspace.cpv] : []),
                  contract_type: workspace.contract_type,
                  procedure: workspace.procedure,
                  estimated_value: workspace.estimated_value,
                  planned_quarter: Math.ceil((new Date().getMonth() + 1) / 3),
                  planned_publication_date: workspace.publication_date,
                  owner: workspace.owner,
                  status: "en_preparacion",
                  notes: "Vinculado al expediente en xTender"
                }), "Expediente incorporado al plan anual.")}
              ><Plus size={15} />{activePlanItem ? "Ya incluido" : "Incluir expediente"}</button>
            </div>
            <div className="category1-table" role="table">
              {annualPlan.map((item) => (
                <article key={item.id} className={item.workspace_id === workspace?.id ? "selected" : ""}>
                  <div><strong>{item.title}</strong><small>{item.contracting_body || "Órgano pendiente"} · {item.cpv_codes?.join(", ") || "CPV pendiente"}</small></div>
                  <span>{item.estimated_value != null ? formatEuro(item.estimated_value) : "Sin VEC"}</span>
                  <StatusPill label={item.status} tx={captions.es} />
                </article>
              ))}
              {!annualPlan.length && <EmptyState text="El plan anual todavía no contiene actuaciones." />}
            </div>
          </section>

          <section className="main-panel">
            <PanelTitle icon={<Search size={18} />} title="Estudio de mercado trazable" action={`${marketStudies.length} versiones`} />
            <label className="category1-wide-field"><span>Alcance del estudio</span><textarea rows={3} value={marketScope} onChange={(event) => setMarketScope(event.currentTarget.value)} placeholder="Prestación, mercado y alternativas que deben analizarse" /></label>
            <button
              type="button"
              disabled={!workspace || marketScope.trim().length < 3 || busy === "market"}
              onClick={() => workspace && act("market", () => createMarketStudy({ workspace_id: workspace.id, scope: marketScope, search_query: workspace.object || marketScope, cpv_codes: workspace.cpv_codes || [] }), "Estudio creado a partir de precedentes indexados.")}
            ><Sparkles size={15} />Generar estudio borrador</button>
            {marketStudies[0] && (
              <article className="market-study-summary">
                <header><strong>Versión {marketStudies[0].version}</strong><StatusPill label={marketStudies[0].status} tx={captions.es} /></header>
                <p>{String(marketStudies[0].statistics?.references ?? 0)} referencias · {marketStudies[0].scenarios.length} escenarios · {marketStudies[0].economic_operators.length} operadores identificados</p>
                {marketStudies[0].limitations.map((item) => <small key={item}>{item}</small>)}
              </article>
            )}
          </section>

          <section className="main-panel">
            <PanelTitle icon={<AlertTriangle size={18} />} title="Registro de riesgos" action={`${highRisks.length} altos`} />
            <div className="category1-form-grid">
              <label><span>Categoría</span><input value={riskDraft.category} onChange={(event) => setRiskDraft((draft) => ({ ...draft, category: event.currentTarget.value }))} /></label>
              <label className="wide"><span>Riesgo</span><input value={riskDraft.description} onChange={(event) => setRiskDraft((draft) => ({ ...draft, description: event.currentTarget.value }))} placeholder="Describe evento, causa y consecuencia" /></label>
              <label><span>Probabilidad (1-5)</span><input type="number" min={1} max={5} value={riskDraft.probability} onChange={(event) => setRiskDraft((draft) => ({ ...draft, probability: Number(event.currentTarget.value) }))} /></label>
              <label><span>Impacto (1-5)</span><input type="number" min={1} max={5} value={riskDraft.impact} onChange={(event) => setRiskDraft((draft) => ({ ...draft, impact: Number(event.currentTarget.value) }))} /></label>
              <label className="wide"><span>Mitigación</span><input value={riskDraft.mitigation} onChange={(event) => setRiskDraft((draft) => ({ ...draft, mitigation: event.currentTarget.value }))} /></label>
            </div>
            <button type="button" disabled={!workspace || riskDraft.description.trim().length < 3 || busy === "risk"} onClick={() => workspace && act("risk", () => createProcurementRisk({ workspace_id: workspace.id, ...riskDraft }), "Riesgo añadido y puntuado.")}><Plus size={15} />Añadir riesgo</button>
            <div className="risk-list">
              {risks.map((risk) => <article key={risk.id}><span className={`risk-${risk.level}`}>{risk.score}</span><div><strong>{risk.description}</strong><small>{risk.category} · {risk.mitigation || "Mitigación pendiente"}</small></div><StatusPill label={risk.level} tx={captions.es} /></article>)}
              {!risks.length && <EmptyState text="No hay riesgos evaluados para este expediente." />}
            </div>
          </section>

          <section className="main-panel">
            <PanelTitle icon={<ListChecks size={18} />} title="Plazos y tareas" action={`${tasks.filter((item) => item.overdue).length} vencidas`} />
            <div className="category1-inline-form">
              <button type="button" disabled={!workspace || busy === "schedule"} onClick={() => workspace && act("schedule", () => createProcurementSchedule({ workspace_id: workspace.id, procedure: workspace.procedure || undefined, start_date: new Date().toISOString().slice(0, 10) }), "Cronograma calculado; revisa sus supuestos antes de validarlo.")}><CalendarDays size={15} />Calcular cronograma</button>
              {schedules[0] && <span className="schedule-target">Objetivo: <strong>{schedules[0].target_date || "por revisar"}</strong></span>}
            </div>
            {schedules[0] && <ul className="schedule-phases">{schedules[0].phases.map((phase, index) => <li key={phase.id || index}><strong>{phase.label || phase.name || phase.id}</strong><span>{phase.end_date || `${phase.days || phase.duration_days || "?"} días`}</span></li>)}</ul>}
            <div className="category1-form-grid task-form">
              <label className="wide"><span>Nueva tarea</span><input value={taskDraft.title} onChange={(event) => setTaskDraft((draft) => ({ ...draft, title: event.currentTarget.value }))} placeholder="Ej. Validar memoria económica" /></label>
              <label><span>Vencimiento</span><input type="date" value={taskDraft.due_date} onChange={(event) => setTaskDraft((draft) => ({ ...draft, due_date: event.currentTarget.value }))} /></label>
              <label><span>Prioridad</span><select value={taskDraft.priority} onChange={(event) => setTaskDraft((draft) => ({ ...draft, priority: event.currentTarget.value as typeof draft.priority }))}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
            </div>
            <button type="button" disabled={!workspace || taskDraft.title.trim().length < 3 || busy === "task"} onClick={() => workspace && act("task", () => createWorkspaceTask(workspace.id, taskDraft), "Tarea incorporada al expediente.")}><Plus size={15} />Crear tarea</button>
            <div className="task-list">{tasks.map((task) => <article key={task.id} className={clsx(task.overdue && "overdue")}><div><strong>{task.title}</strong><small>{task.due_date || "Sin fecha"} · {task.priority}</small></div><StatusPill label={task.status} tx={captions.es} /></article>)}</div>
          </section>
        </div>
      )}

      {tab === "exploradores" && (
        <div className="category1-section-grid explorer-grid">
          <section className="main-panel explorer-main">
            <PanelTitle
              icon={<Search size={18} />}
              title="Explorador de conocimiento público"
              action={busy === "explorer"
                ? (catalan ? "Cercant…" : "Buscando…")
                : `${explorerResults.length} resultados${explorerElapsedMs === null ? "" : ` · ${explorerElapsedMs < 1000 ? `${explorerElapsedMs} ms` : `${(explorerElapsedMs / 1000).toFixed(1)} s`}`}`}
            />
            <div className="explorer-kind-tabs">
              {(["licitaciones", "normativa", "doctrina", "jurisprudencia"] as const).map((kind) => <button key={kind} type="button" className={explorerKind === kind ? "active" : ""} onClick={() => { setExplorerKind(kind); setExplorerResults([]); setExplorerElapsedMs(null); setExplorerHasSearched(false); setExplorerRelaxedFilters([]); }}>{kind}</button>)}
            </div>
            <div className="explorer-search-bar" aria-busy={busy === "explorer"}>
              <Search size={17} />
              <input value={explorerQuery} onChange={(event) => setExplorerQuery(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchExplorer(); }} placeholder="Objeto, CPV, órgano, cláusula o concepto jurídico" />
              <button
                type="button"
                className={clsx("explorer-search-button", busy === "explorer" && "is-searching")}
                disabled={busy === "explorer" || explorerQuery.trim().length < 2}
                onClick={() => void searchExplorer()}
              >
                {busy === "explorer" ? <RefreshCw size={17} /> : <Search size={17} />}
                <span>{busy === "explorer" ? (catalan ? "Cercant…" : "Buscando…") : (catalan ? "Cerca" : "Buscar")}</span>
              </button>
              <button type="button" className="secondary-button" disabled={explorerQuery.trim().length < 2} onClick={() => act("save-search", () => createSavedSearch({ name: explorerQuery.slice(0, 80), search_kind: explorerKind, query: explorerQuery, filters: { cpv: workspace?.cpv_codes?.[0] || workspace?.cpv, language: locale }, alert_frequency: "semanal", active: true }), "Búsqueda guardada con alerta semanal.")}><BadgeCheck size={15} />Guardar alerta</button>
            </div>
            {busy === "explorer" && (
              <div className="explorer-search-progress" role="status" aria-live="polite">
                <span aria-hidden="true" />
                <small>{catalan ? "Consultant el corpus indexat i aplicant els filtres…" : "Consultando el corpus indexado y aplicando los filtros…"}</small>
              </div>
            )}
            {explorerRelaxedFilters.includes("cpv") && busy !== "explorer" && (
              <p className="explorer-relaxed-filter"><AlertTriangle size={15} />No había coincidencias exactas para el CPV del expediente; se muestran resultados por contenido y significado textual sin ocultar la ampliación.</p>
            )}
            <div className="explorer-results">
              {explorerResults.map((item) => {
                if ("chunk_id" in item) {
                  return <article key={item.chunk_id}><header><span>PLACSP · {item.metadata.document_type || "documento"}</span><strong>{Math.round(item.score * 100)} %</strong></header><h3>{item.title}</h3><p>{item.text.slice(0, 420)}{item.text.length > 420 ? "…" : ""}</p><div>{item.why_similar.map((reason) => <small key={reason}>{reason}</small>)}</div><a href={item.source.url} target="_blank" rel="noreferrer">Abrir fuente oficial <Link2 size={13} /></a></article>;
                }
                return <article key={item.id}><header><span>{item.source_kind} · {item.publisher || item.jurisdiction}</span><StatusPill label={item.status} tx={captions.es} /></header><h3>{item.title}</h3><p>{item.reference_number || "Referencia sin numeración"} · {item.publication_date || "fecha no informada"}</p><a href={item.source_url} target="_blank" rel="noreferrer">Abrir texto oficial <Link2 size={13} /></a></article>;
              })}
              {!explorerResults.length && !busy && <EmptyState text={explorerHasSearched ? "No hay resultados con estos filtros. Prueba a retirar el CPV o a usar conceptos más amplios." : "Busca licitaciones similares, normativa o doctrina. Los resultados conservan enlace y procedencia."} />}
            </div>
          </section>

          <aside className="category1-side-stack">
            <section className="main-panel">
              <PanelTitle icon={<RefreshCw size={18} />} title="Fuentes oficiales" action={`${connectors.filter((item) => item.enabled).length} automatizables`} />
              <div className="connector-list">
                {connectors.map((connector) => <label key={connector.id} className={clsx(!connector.enabled && "disabled")}><input type="checkbox" disabled={!connector.enabled} checked={selectedConnectors.includes(connector.id)} onChange={(event) => setSelectedConnectors((current) => event.currentTarget.checked ? [...new Set([...current, connector.id])] : current.filter((item) => item !== connector.id))} /><div><strong>{connector.name}</strong><small>{connector.conditions}</small></div></label>)}
              </div>
              <button type="button" disabled={!selectedConnectors.length || busy === "sync"} onClick={() => act("sync", () => syncOfficialSources(selectedConnectors, ["contratación", "contratos del sector público", "inteligencia artificial", "protección de datos", "seguridad"]), "Sincronización oficial terminada; revisa los resultados antes de citarlos.")}><RefreshCw size={15} />Sincronizar seleccionadas</button>
            </section>
            <section className="main-panel">
              <PanelTitle icon={<BadgeCheck size={18} />} title="Búsquedas y alertas" action={`${savedSearches.length}`} />
              <div className="saved-search-list">{savedSearches.map((search) => <article key={search.id}><div><strong>{search.name}</strong><small>{search.search_kind} · {search.alert_frequency} · {search.new_result_count || 0} novedades</small></div><button type="button" onClick={() => act(`saved-${search.id}`, () => runSavedSearch(search.id), "Búsqueda actualizada.")}><RefreshCw size={14} />Ejecutar</button></article>)}</div>
            </section>
            <section className="main-panel">
              <PanelTitle icon={<BookOpen size={18} />} title="Catálogo de cláusulas" action={`${clauses.length}`} />
              <div className="clause-create-form">
                <input value={clauseDraft.title} onChange={(event) => setClauseDraft((draft) => ({ ...draft, title: event.currentTarget.value }))} placeholder="Nombre de la cláusula" />
                <select value={clauseDraft.documentType} onChange={(event) => setClauseDraft((draft) => ({ ...draft, documentType: event.currentTarget.value as DocumentKind }))}>{documentKinds.map((kind) => <option key={kind} value={kind}>{documentLabels[kind].short}</option>)}</select>
                <textarea rows={3} value={clauseDraft.content} onChange={(event) => setClauseDraft((draft) => ({ ...draft, content: event.currentTarget.value }))} placeholder="Texto con variables, por ejemplo {{ budget }}" />
                <button type="button" disabled={clauseDraft.title.trim().length < 3 || clauseDraft.content.trim().length < 3} onClick={() => act("clause", () => createClauseCatalogEntry({ title: clauseDraft.title, content_text: clauseDraft.content, document_types: [clauseDraft.documentType], status: "borrador", visibility: "organizacion" }), "Cláusula guardada como borrador versionado.")}><Plus size={14} />Guardar borrador</button>
              </div>
              <div className="clause-list">{clauses.slice(0, 8).map((clause) => <article key={clause.id}><div><strong>{clause.title}</strong><small>{clause.document_types.map((kind) => documentLabels[kind]?.short || kind).join(", ")} · v{clause.version_number || 1}</small></div><button type="button" disabled={!workspace} onClick={() => workspace && act("render-clause", async () => { const response = await renderClauseForWorkspace(workspace.id, clause.id); setRenderedClause(response.proposal); }, "Propuesta preparada; no se ha insertado en ningún documento.")}><Eye size={14} />Proponer</button></article>)}</div>
              {renderedClause && <div className="rendered-clause"><strong>Propuesta pendiente de aceptación humana</strong><textarea rows={8} value={renderedClause} onChange={(event) => setRenderedClause(event.currentTarget.value)} /><small>Copia el texto al apartado elegido solo después de revisarlo.</small></div>}
            </section>
          </aside>
        </div>
      )}

      {tab === "economia" && (
        <div className="category1-section-grid economy-grid">
          <section className="main-panel">
            <PanelTitle icon={<Landmark size={18} />} title="Presupuesto base y valor estimado" action="Cálculo trazable" />
            <p className="plain-copy">El cálculo separa base sin impuestos, IVA, prórrogas, opciones y modificaciones. Solo una versión marcada y confirmada como validada puede propagarse al expediente.</p>
            <div className="category1-form-grid economy-form">
              <label className="wide"><span>Concepto</span><input value={economicDraft.description} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, description: event.currentTarget.value }))} placeholder="Ej. Licencia y soporte anual" /></label>
              <label><span>Cantidad</span><input type="number" min={0} step="0.01" value={economicDraft.quantity} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, quantity: Number(event.currentTarget.value) }))} /></label>
              <label><span>Precio unitario</span><input type="number" min={0} step="0.01" value={economicDraft.unit_price} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, unit_price: Number(event.currentTarget.value) }))} /></label>
              <label><span>Periodos</span><input type="number" min={0} step="0.01" value={economicDraft.periods} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, periods: Number(event.currentTarget.value) }))} /></label>
              <label><span>IVA %</span><input type="number" min={0} max={100} value={economicDraft.tax_rate} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, tax_rate: Number(event.currentTarget.value) }))} /></label>
              <label><span>Prórrogas</span><input type="number" min={0} step="0.01" value={economicDraft.extensions} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, extensions: Number(event.currentTarget.value) }))} /></label>
              <label><span>Opciones</span><input type="number" min={0} step="0.01" value={economicDraft.options} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, options: Number(event.currentTarget.value) }))} /></label>
              <label><span>Modificación prevista %</span><input type="number" min={0} max={100} value={economicDraft.modification} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, modification: Number(event.currentTarget.value) }))} /></label>
            </div>
            <label className="human-confirmation"><input type="checkbox" checked={economicDraft.validated} onChange={(event) => setEconomicDraft((draft) => ({ ...draft, validated: event.currentTarget.checked }))} /><span>He comprobado cantidades, fuentes de precio e hipótesis y deseo registrar esta versión como validada.</span></label>
            <button type="button" disabled={!workspace || economicDraft.description.trim().length < 3 || economicDraft.unit_price < 0 || busy === "economics"} onClick={() => workspace && act("economics", () => createEconomicCalculation({ workspace_id: workspace.id, line_items: [{ description: economicDraft.description, quantity: economicDraft.quantity, unit_price: economicDraft.unit_price, periods: economicDraft.periods }], tax_rate: economicDraft.tax_rate, extensions_amount: economicDraft.extensions, options_amount: economicDraft.options, modification_percent: economicDraft.modification, status: economicDraft.validated ? "validado" : "borrador", assumptions: ["Importes introducidos y revisados por la persona usuaria"] }), "Versión económica calculada y conservada.")}><Landmark size={15} />Calcular y guardar versión</button>
          </section>
          <section className="main-panel">
            <PanelTitle icon={<History size={18} />} title="Versiones económicas" action={`${calculations.length}`} />
            <div className="economic-history">
              {calculations.map((calculation) => <article key={calculation.id}><header><strong>v{calculation.version}</strong><StatusPill label={calculation.status} tx={captions.es} /></header><dl><div><dt>Base sin IVA</dt><dd>{formatEuro(calculation.base_without_tax)}</dd></div><div><dt>PBL con IVA</dt><dd>{formatEuro(calculation.base_with_tax)}</dd></div><div><dt>Valor estimado</dt><dd>{formatEuro(calculation.estimated_value)}</dd></div></dl><button type="button" disabled={calculation.status !== "validado" || busy === "apply-economics"} onClick={() => workspace && act("apply-economics", () => applyEconomicCalculation(workspace.id, calculation.id), "Datos económicos propuestos al expediente; revisa los impactos documentales.").then(onWorkspaceChanged)}><Check size={14} />Aplicar al expediente</button></article>)}
              {!calculations.length && <EmptyState text="No se han registrado cálculos económicos." />}
            </div>
          </section>
        </div>
      )}

      {tab === "cumplimiento" && (
        <div className="category1-section-grid compliance-grid">
          <section className="main-panel">
            <PanelTitle icon={<ShieldCheck size={18} />} title="Matriz técnica y de seguridad" action={`${complianceControls.filter((item) => item.status === "satisfecho").length}/${complianceControls.length}`} />
            <p className="plain-copy">La aplicación distingue controles implementados de acreditaciones documentales. No declara ENS, alojamiento UE ni condiciones del proveedor sin evidencia.</p>
            <div className="compliance-list">{complianceControls.map((control) => <article key={control.id}><span className={clsx("compliance-icon", control.status === "satisfecho" && "ok")}>{control.status === "satisfecho" ? <Check size={15} /> : <AlertTriangle size={15} />}</span><div><strong>{control.requirement}</strong><small>{control.evidence}</small></div><StatusPill label={control.status} tx={captions.es} /></article>)}</div>
          </section>
          <section className="main-panel">
            <PanelTitle icon={<BookOpen size={18} />} title="Alfabetización en IA" action={`${literacy.filter((item) => item.completed).length}/${literacy.length}`} />
            <p className="plain-copy">Cada persona deja constancia de lectura y resultado de autoevaluación. El mínimo registrado por el sistema es 80/100.</p>
            <div className="literacy-list">{literacy.map((module) => {
              const draft = literacyDraft[module.id] || { score: 0, attested: false };
              return <article key={module.id} className={module.completed ? "completed" : ""}><div><strong>{module.title}</strong><p>{module.objective}</p><small>{module.duration_minutes || 10} min · versión {module.version}</small></div>{module.completed ? <BadgeCheck size={22} /> : <div className="literacy-attestation"><label><span>Resultado</span><input type="number" min={0} max={100} value={draft.score} onChange={(event) => setLiteracyDraft((current) => ({ ...current, [module.id]: { ...draft, score: Number(event.currentTarget.value) } }))} /></label><label><input type="checkbox" checked={draft.attested} onChange={(event) => setLiteracyDraft((current) => ({ ...current, [module.id]: { ...draft, attested: event.currentTarget.checked } }))} />He completado y comprendido el módulo</label><button type="button" disabled={!draft.attested || draft.score < 80 || busy === `learn-${module.id}`} onClick={() => act(`learn-${module.id}`, () => completeLiteracyModule(module.id, module.version, draft.score, draft.attested), "Formación registrada.")}><Check size={14} />Registrar</button></div>}</article>;
            })}</div>
          </section>
        </div>
      )}
    </div>
  );
}

function DocumentSwitcher({
  active,
  documents,
  onSelect,
  onStatus,
  busy
}: {
  active: DocumentKind;
  documents: DocumentOverview[];
  onSelect: (documentType: DocumentKind) => void;
  onStatus: (status: "borrador" | "en_revision" | "final") => void;
  busy: string;
}) {
  const activeDocument = documents.find((document) => document.document_type === active);
  return (
    <section className="document-switcher" aria-label="Documentos del expediente">
      <div className="document-switcher-list">
        {documentKinds.map((documentType) => {
          const document = documents.find((item) => item.document_type === documentType);
          const completed = document?.chapters_total
            ? Math.round((document.chapters_completed / document.chapters_total) * 100)
            : 0;
          return (
            <button
              key={documentType}
              type="button"
              className={clsx("document-switcher-item", `document-${documentType}`, active === documentType && "active")}
              onClick={() => onSelect(documentType)}
              aria-current={active === documentType ? "page" : undefined}
            >
              <span className="document-switcher-icon"><FileText size={17} aria-hidden="true" /></span>
              <span>
                <strong>{documentLabels[documentType].short}</strong>
                <small>{document?.exists ? `${document.chapters_completed}/${document.chapters_total} apartados` : "No iniciado"}</small>
              </span>
              <span className="document-progress" aria-label={`${completed} % completado`}><i style={{ width: `${completed}%` }} /></span>
              <StatusPill label={document?.status ?? "no_iniciado"} tx={captions.es} />
            </button>
          );
        })}
      </div>
      <label className="document-status-control">
        <span>Estado del {documentLabels[active].short}</span>
        <select
          value={activeDocument?.status === "no_iniciado" ? "borrador" : activeDocument?.status ?? "borrador"}
          disabled={!activeDocument?.exists || busy === "document-status"}
          onChange={(event) => {
            const next = event.currentTarget.value as "borrador" | "en_revision" | "final";
            if (next === "final" && !window.confirm("La versión final exige índice validado, apartados obligatorios completos y ausencia de errores abiertos. ¿Intentar finalizar?")) return;
            onStatus(next);
          }}
        >
          <option value="borrador">Borrador</option>
          <option value="en_revision">En revisión</option>
          <option value="final">Versión final</option>
        </select>
      </label>
    </section>
  );
}

function ExpedientesScreen({
  activeWorkspace,
  workspaces,
  total,
  page,
  pages,
  searchMode,
  query,
  includeArchived,
  onQuery,
  onPage,
  onIncludeArchived,
  onCreate,
  onActivate,
  onArchive,
  onRestore,
  onSave,
  metadataDraft,
  metadataDirty,
  onMetadataDraftChange,
  ui,
  tx,
  locale
}: {
  activeWorkspace?: Workspace;
  workspaces: Workspace[];
  total: number;
  page: number;
  pages: number;
  searchMode: string;
  query: string;
  includeArchived: boolean;
  onQuery: (value: string) => void;
  onPage: (value: number) => void;
  onIncludeArchived: (value: boolean) => void;
  onCreate: () => void;
  onActivate: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onSave: () => void;
  metadataDraft: MetadataDraft;
  metadataDirty: boolean;
  onMetadataDraftChange: (draft: MetadataDraft) => void;
  ui: typeof copy.es;
  tx: CaptionSet;
  locale: Locale;
}) {
  const semantic = searchMode.includes("bge");
  return (
    <div className="screen-grid">
      <section className="main-panel elicit-toolbar">
        <div className="search-bar tooltip-wrap" data-tooltip={tx.labels.searchTooltip}>
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={ui.searchPlaceholder} />
        </div>
        <span className={clsx("search-mode-pill", semantic && "semantic")}>
          {semantic ? <Sparkles size={15} /> : <Search size={15} />}
          {semantic ? ui.semanticSearch : ui.textSearch}
        </span>
        <label className="toggle-line tooltip-wrap" data-tooltip={tx.labels.includeArchivedTooltip}>
          <input type="checkbox" checked={includeArchived} onChange={(event) => onIncludeArchived(event.target.checked)} />
          {tx.labels.includeArchived}
        </label>
        <button type="button" className="primary-action" onClick={onCreate}>
          <Plus size={17} aria-hidden="true" />
          {ui.new as string}
        </button>
      </section>

      <section className="split-panels workspace-management-grid">
        <div className="main-panel workspace-list-panel">
          <PanelTitle icon={<FolderKanban size={18} />} title={tx.labels.workspacesPanel} action={`${total}`} />
          <div className="workspace-table">
            {workspaces.map((workspace) => {
              const fileNumber = workspace.file_number || workspace.id;
              const workspaceMeta = `${workspace.unit || tx.labels.unitPending} · ${(workspace.cpv_codes?.length ? workspace.cpv_codes.join(", ") : workspace.cpv) || tx.labels.cpvPending}`;
              return (
                <article key={workspace.id} className={clsx("workspace-row", activeWorkspace?.id === workspace.id && "selected", workspace.status === "archivado" && "archived")}>
                  <button type="button" onClick={() => onActivate(workspace.id)} aria-label={`${fileNumber}. ${workspace.title}`}>
                    <span className="mono workspace-code" title={fileNumber}>{fileNumber}</span>
                    <strong className="workspace-title tooltip-wrap" data-tooltip={workspace.title} title={workspace.title}>{workspace.title}</strong>
                    <small className="workspace-subtitle" title={workspaceMeta}>{workspaceMeta}</small>
                  </button>
                  <StatusPill label={workspace.status} tx={tx} />
                  <span className="completion-pill tooltip-wrap" data-tooltip={tx.labels.requiredCompletionTooltip}>
                    <small>{tx.labels.requiredCompletion}</small>
                    <strong>{workspace.completeness ?? 0}%</strong>
                  </span>
                  {workspace.status === "archivado" ? (
                    <IconButton title={ui.restore} tooltip={tx.labels.restoreTooltip} icon={<RotateCcw size={16} />} onClick={() => onRestore(workspace.id)} />
                  ) : (
                    <IconButton title={ui.archive} tooltip={tx.tips.archive} icon={<Archive size={16} />} onClick={() => onArchive(workspace.id)} />
                  )}
                </article>
              );
            })}
            {!workspaces.length && <EmptyState text={tx.labels.noWorkspaces} />}
          </div>
          <div className="pagination-bar" aria-label={tx.labels.referencesPanel}>
            <span>{ui.pageOf} {page} / {pages} · {ui.perPage}</span>
            <div>
              <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
                <ChevronLeft size={16} />{ui.previous}
              </button>
              <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>
                {ui.nextPage}<ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <form className="main-panel metadata-form metadata-panel" onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}>
          <PanelTitle icon={<FileText size={18} />} title={tx.labels.metadataPanel} action={metadataDirty ? tx.labels.metadataUnsaved : undefined} />
          <MetadataFields draft={metadataDraft} onDraftChange={onMetadataDraftChange} tx={tx} locale={locale} createdAt={activeWorkspace?.created_at} compact />
          <button type="submit" className="export-button">
            <Check size={16} aria-hidden="true" />
            {ui.save as string}
          </button>
        </form>
      </section>
    </div>
  );
}

function MetadataFields({
  draft,
  onDraftChange,
  tx,
  locale,
  createdAt,
  compact = false
}: {
  draft: MetadataDraft;
  onDraftChange: (draft: MetadataDraft) => void;
  tx: CaptionSet;
  locale: Locale;
  createdAt?: string | null;
  compact?: boolean;
}) {
  const metadataCopy = metadataFieldCopy[locale] ?? metadataFieldCopy.es;
  const [cpvQuery, setCpvQuery] = useState("");
  const [cpvQueryManual, setCpvQueryManual] = useState(false);
  const [cpvCandidates, setCpvCandidates] = useState<CpvItem[]>([]);
  const [cpvMode, setCpvMode] = useState("");
  const [cpvBusy, setCpvBusy] = useState(false);
  const latestDraftRef = useRef(draft);
  const textRows = compact ? 2 : 3;
  const cpvAutoQuery = [draft.title, draft.object, draft.need]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
  const selectedCpvKey = draft.cpv_codes.join("|");
  const contractTypeValues = useMemo(() => new Set(contractTypeOptions.es.map((option) => option.value)), []);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  function update(field: keyof MetadataDraft, value: string) {
    onDraftChange({ ...draft, [field]: value });
  }

  function updateCpvCodes(codes: string[]) {
    const unique = Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
    onDraftChange({ ...draft, cpv_codes: unique, cpv: unique[0] ?? "" });
  }

  function addCpv(code: string) {
    updateCpvCodes([...draft.cpv_codes, code]);
  }

  function removeCpv(code: string) {
    updateCpvCodes(draft.cpv_codes.filter((item) => item !== code));
  }

  async function handleSearchCpv() {
    setCpvBusy(true);
    try {
      const result = await searchCpvs(cpvQuery || cpvAutoQuery, locale, 10);
      setCpvCandidates(result.items.slice(0, 10));
      setCpvMode(result.mode);
    } catch {
      setCpvCandidates([]);
      setCpvMode("error");
    } finally {
      setCpvBusy(false);
    }
  }

  useEffect(() => {
    setCpvQueryManual(false);
  }, [cpvAutoQuery]);

  useEffect(() => {
    const query = cpvAutoQuery.trim();
    if (query.length < 8) {
      setCpvCandidates([]);
      setCpvMode("");
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setCpvBusy(true);
      try {
        const context = await extractCpvContext({
          title: draft.title,
          object: draft.object,
          need: draft.need,
          language: locale
        });
        if (cancelled) return;
        const contextQuery = context.query?.trim() || query;
        if (contextQuery && (!cpvQueryManual || !cpvQuery.trim())) {
          setCpvQuery(contextQuery);
        }
        const contractType = context.contract_type && contractTypeValues.has(context.contract_type) ? context.contract_type : "";
        const latestDraft = latestDraftRef.current;
        if (contractType && !latestDraft.contract_type) {
          onDraftChange({ ...latestDraft, contract_type: contractType });
        }
        const result = await searchCpvs(contextQuery, locale, 10);
        if (!cancelled) {
          setCpvCandidates(result.items.slice(0, 10));
          setCpvMode(`${context.mode} · ${result.mode}`);
        }
      } catch {
        if (!cancelled) {
          setCpvCandidates([]);
          setCpvMode("error");
        }
      } finally {
        if (!cancelled) setCpvBusy(false);
      }
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // The debounced query is keyed by its derived search identity; draft callbacks are read through the latest-value ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpvAutoQuery, cpvQueryManual, locale, selectedCpvKey, contractTypeValues]);

  function fillTypicalDates() {
    const base = localDateFromIso(createdAt) ?? todayLocalDate();
    const publication = addDays(base, 60);
    const submission = addDays(publication, 30);
    const award = addDays(submission, 60);
    const formalization = addDays(award, 30);
    const start = addDays(formalization, 10);
    const end = addDurationToDate(start, draft.duration);
    onDraftChange({
      ...draft,
      publication_date: isoDate(publication),
      submission_deadline: isoDate(submission),
      award_date: isoDate(award),
      formalization_date: isoDate(formalization),
      start_date: isoDate(start),
      end_date: isoDate(end)
    });
  }

  return (
    <>
      <div className="metadata-primary-grid">
        <label>{tx.labels.fileNumber}<input name="file_number" value={draft.file_number} onChange={(event) => update("file_number", event.target.value)} /></label>
        <label>{tx.labels.title}<input name="title" value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label>{tx.labels.unit}<input name="unit" value={draft.unit} onChange={(event) => update("unit", event.target.value)} /></label>
      </div>
      <section className="metadata-subpanel" aria-label={metadataCopy.organization}>
        <div className="metadata-subpanel-title"><span><Building2 size={16} aria-hidden="true" /> {metadataCopy.organization}</span></div>
        <div className="form-three">
          <label>{metadataCopy.contractingBody}<input name="contracting_body" value={draft.contracting_body} onChange={(event) => update("contracting_body", event.target.value)} /></label>
          <label>{metadataCopy.promotingUnit}<input name="promoting_unit" value={draft.promoting_unit} onChange={(event) => update("promoting_unit", event.target.value)} /></label>
          <label>{metadataCopy.contractManager}<input name="contract_manager" value={draft.contract_manager} onChange={(event) => update("contract_manager", event.target.value)} /></label>
        </div>
      </section>
      <label>{tx.labels.object}<textarea name="object" value={draft.object} onChange={(event) => update("object", event.target.value)} rows={textRows} /></label>
      <label>{metadataCopy.need}<textarea name="need" value={draft.need} onChange={(event) => update("need", event.target.value)} rows={textRows} /></label>
      <section className="metadata-subpanel" aria-label={metadataCopy.economics}>
        <div className="metadata-subpanel-title"><span><Landmark size={16} aria-hidden="true" /> {metadataCopy.economics}</span></div>
        <div className="form-four">
          <label>{tx.labels.budget}<input name="budget" inputMode="decimal" value={draft.budget} onChange={(event) => update("budget", event.target.value)} onBlur={(event) => update("budget", formatDecimalText(event.target.value))} /></label>
          <label>{tx.labels.estimatedValue}<input name="estimated_value" inputMode="decimal" value={draft.estimated_value} onChange={(event) => update("estimated_value", event.target.value)} onBlur={(event) => update("estimated_value", formatDecimalText(event.target.value))} /></label>
          <label>{metadataCopy.taxRate}<input name="tax_rate" inputMode="decimal" value={draft.tax_rate} onChange={(event) => update("tax_rate", event.target.value)} onBlur={(event) => update("tax_rate", formatDecimalText(event.target.value))} /></label>
          <label>{metadataCopy.funding}<input name="funding" value={draft.funding} onChange={(event) => update("funding", event.target.value)} /></label>
        </div>
      </section>
      <div className="form-four">
        <label>{tx.labels.contractType}
          <select name="contract_type" value={draft.contract_type} onChange={(event) => update("contract_type", event.target.value)}>
            <option value=""></option>
            {(contractTypeOptions[locale] ?? contractTypeOptions.es).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>{tx.labels.procedure}
          <select name="procedure" value={draft.procedure} onChange={(event) => update("procedure", event.target.value)}>
            <option value=""></option>
            {(procedureOptions[locale] ?? procedureOptions.es).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <section className="metadata-subpanel" aria-label={tx.labels.cpv}>
        <div className="metadata-subpanel-title">
          <span><Tags size={16} aria-hidden="true" /> {tx.labels.selectedCpvs}</span>
          <small>{tx.labels.cpvSource}{cpvMode ? ` · ${cpvMode}` : ""}</small>
        </div>
        <div className="cpv-chip-list">
          {draft.cpv_codes.length ? draft.cpv_codes.map((code) => (
            <button key={code} type="button" className="cpv-chip" onClick={() => removeCpv(code)} title={tx.labels.removeCpv}>
              {code}<X size={14} aria-hidden="true" />
            </button>
          )) : <span className="empty-chip">{tx.labels.cpvPending}</span>}
        </div>
        <div className="cpv-actions">
          <input
            name="cpv_query"
            value={cpvQuery}
            placeholder={tx.labels.cpvSearchPlaceholder}
            onChange={(event) => {
              setCpvQueryManual(true);
              setCpvQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearchCpv();
              }
            }}
          />
          <button type="button" className="secondary-button" onClick={handleSearchCpv} disabled={cpvBusy}>
            <Search size={15} aria-hidden="true" /> {tx.labels.cpvSearch}
          </button>
        </div>
        <div className="cpv-candidates">
          {cpvCandidates.length ? cpvCandidates.map((item) => {
            const label = truncateText(item.label, 58);
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => addCpv(item.code)}
                className={clsx("cpv-candidate", draft.cpv_codes.includes(item.code) && "selected")}
                title={`${item.code} - ${item.label}`}
              >
                <strong>{item.code}</strong>
                <span>{label}</span>
              </button>
            );
          }) : <small>{tx.labels.noCpvSuggestions}</small>}
        </div>
      </section>
      <div className="form-three">
        <label>{tx.labels.duration}<input name="duration" value={draft.duration} onChange={(event) => update("duration", event.target.value)} /></label>
        <label>{metadataCopy.extensions}<input name="extensions" value={draft.extensions} onChange={(event) => update("extensions", event.target.value)} /></label>
        <label>{tx.labels.lots}<input name="lots" value={draft.lots} onChange={(event) => update("lots", event.target.value)} /></label>
      </div>
      <section className="metadata-subpanel" aria-label={metadataCopy.safeguards}>
        <div className="metadata-subpanel-title"><span><ShieldCheck size={16} aria-hidden="true" /> {metadataCopy.safeguards}</span></div>
        <div className="form-three">
          <label>{metadataCopy.dataProtection}<textarea name="data_protection" value={draft.data_protection} onChange={(event) => update("data_protection", event.target.value)} rows={textRows} /></label>
          <label>{metadataCopy.confidentiality}<textarea name="confidentiality" value={draft.confidentiality} onChange={(event) => update("confidentiality", event.target.value)} rows={textRows} /></label>
          <label>{metadataCopy.intellectualProperty}<textarea name="intellectual_property" value={draft.intellectual_property} onChange={(event) => update("intellectual_property", event.target.value)} rows={textRows} /></label>
        </div>
      </section>
      <section className="metadata-subpanel" aria-label={tx.labels.dates}>
        <div className="metadata-subpanel-title">
          <span><CalendarDays size={16} aria-hidden="true" /> {tx.labels.dates}</span>
          <button type="button" className="secondary-button compact" onClick={fillTypicalDates}>{tx.labels.fillTypicalDates}</button>
        </div>
        <div className="form-three">
          <label>{tx.labels.publicationDate}<input type="date" name="publication_date" value={draft.publication_date} onChange={(event) => update("publication_date", event.target.value)} /></label>
          <label>{tx.labels.submissionDeadline}<input type="date" name="submission_deadline" value={draft.submission_deadline} onChange={(event) => update("submission_deadline", event.target.value)} /></label>
          <label>{tx.labels.awardDate}<input type="date" name="award_date" value={draft.award_date} onChange={(event) => update("award_date", event.target.value)} /></label>
          <label>{tx.labels.formalizationDate}<input type="date" name="formalization_date" value={draft.formalization_date} onChange={(event) => update("formalization_date", event.target.value)} /></label>
          <label>{tx.labels.startDate}<input type="date" name="start_date" value={draft.start_date} onChange={(event) => update("start_date", event.target.value)} /></label>
          <label>{tx.labels.endDate}<input type="date" name="end_date" value={draft.end_date} onChange={(event) => update("end_date", event.target.value)} /></label>
        </div>
      </section>
    </>
  );
}

function NewWorkspaceModal({
  draft,
  onDraftChange,
  onClose,
  onCreate,
  tx,
  locale
}: {
  draft: MetadataDraft;
  onDraftChange: (draft: MetadataDraft) => void;
  onClose: () => void;
  onCreate: () => void;
  tx: CaptionSet;
  locale: Locale;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={tx.labels.metadataNewPanel}>
      <form className="modal-card metadata-form" onSubmit={(event) => {
        event.preventDefault();
        onCreate();
      }}>
        <PanelTitle icon={<FileText size={18} />} title={tx.labels.metadataNewPanel} />
        <MetadataFields draft={draft} onDraftChange={onDraftChange} tx={tx} locale={locale} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>{tx.labels.cancel}</button>
          <button type="submit" className="export-button">
            <Plus size={16} aria-hidden="true" />
            {tx.labels.createWorkspaceButton}
          </button>
        </div>
      </form>
    </div>
  );
}

function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
  tx,
  title,
  text
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  tx: CaptionSet;
  title?: string;
  text?: string;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title ?? tx.labels.unsavedTitle}>
      <article className="modal-card confirm-card">
        <PanelTitle icon={<FileText size={18} />} title={title ?? tx.labels.unsavedTitle} action={tx.labels.metadataUnsaved} />
        <p className="plain-copy">{text ?? tx.labels.unsavedText}</p>
        <div className="modal-actions">
          <button type="button" className="export-button" onClick={onSave}><Check size={16} />{tx.labels.saveAndContinue}</button>
          <button type="button" onClick={onDiscard}>{tx.labels.discardAndContinue}</button>
          <button type="button" onClick={onCancel}>{tx.labels.keepEditing}</button>
        </div>
      </article>
    </div>
  );
}

function PreparationScreen({
  workspace,
  currentField,
  currentQuestion,
  answerText,
  onAnswerText,
  onSelectField,
  onSaveAnswer,
  onSuggestAnswer,
  streamingGuidedField,
  busy,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  templates,
  workspaceTemplateLinks,
  locale,
  onLinkTemplate,
  onRemoveTemplate,
  onUploadTemplateForWorkspace,
  onOpenSettings,
  ui,
  tx
}: {
  workspace?: Workspace;
  currentField: string;
  currentQuestion: string;
  answerText: string;
  onAnswerText: (value: string) => void;
  onSelectField: (field: string) => void;
  onSaveAnswer: (advance?: boolean) => void;
  onSuggestAnswer: (field: string, mode?: "suggest" | "expand") => void;
  streamingGuidedField: string;
  busy: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  templates: DocumentTemplate[];
  workspaceTemplateLinks: WorkspaceTemplateLink[];
  locale: Locale;
  onLinkTemplate: (templateId: string, notes?: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onUploadTemplateForWorkspace: (file: File, draft: TemplateUploadDraft) => void;
  onOpenSettings: () => void;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const guidedFieldOrder = guidedFieldOrderFor(workspace);
  const preparationDocument = (workspace?.target_document === "memoria" ? "informe_necesidad" : workspace?.target_document) as DocumentKind | undefined;
  const documentType = preparationDocument && documentKinds.includes(preparationDocument) ? preparationDocument : "ppt";
  const completed = guidedFieldOrder.filter((field) => Boolean(guidedFieldValue(workspace, field))).length;
  const completion = Math.round((completed / guidedFieldOrder.length) * 100);
  const activeField = normalizeGuidedField(workspace, currentField);
  const currentIndex = Math.max(0, guidedFieldOrder.indexOf(activeField));
  const previousField = adjacentGuidedField(activeField, -1, workspace);
  const nextField = adjacentGuidedField(activeField, 1, workspace);
  const objectBase = activeField === "object"
    ? answerText
    : guidedFieldValue(workspace, "object") || guidedFieldValue(workspace, "need") || answerText;
  const canSuggest = Boolean(objectBase.trim());
  const anyStreaming = Boolean(streamingGuidedField);
  const isStreaming = streamingGuidedField === activeField;
  const isSuggesting = isStreaming && busy === "sugerir-respuesta";
  const isExpanding = isStreaming && busy === "aumentar-detalle";
  const canExpand = countWords(answerText) >= guidedExpandMinWords;
  const activeQuestion = questionFor(activeField, tx) || currentQuestion;
  const isTemplateStep = activeField === "template";
  const suggestTooltip = canSuggest
    ? tx.labels.suggestEnabled
    : tx.labels.suggestBlocked;
  const expandTooltip = canExpand
    ? tx.labels.expandEnabled
    : formatCaption(tx.labels.expandBlockedTooltip, { count: guidedExpandMinWords });
  const ignoreSelection = useMemo(() => () => undefined, []);
  return (
    <div className="prep-grid">
      <section className="main-panel prep-fields">
        <PanelTitle icon={<ListChecks size={18} />} title={tx.labels.prepPanel} action={`${completion}%`} />
        <div className="context-notice"><FileText size={16} /><span>Entrevista específica para <strong>{documentLabels[documentType].title}</strong>; sus preguntas y decisiones no se clonan de los otros documentos.</span></div>
        <p className="plain-copy">{tx.labels.prepIntro}</p>
        <div className="field-pill-list">
          {guidedFieldOrder.map((field, index) => {
            const done = Boolean(guidedFieldValue(workspace, field));
            return (
              <button key={field} type="button" className={clsx(activeField === field && "selected", done && "done")} onClick={() => onSelectField(field)} disabled={anyStreaming}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{tx.fields[field] ?? guidedFieldLabels[field] ?? field}</strong>
                <small>{done ? tx.labels.saved : tx.labels.pending}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="main-panel prep-current">
        <PanelTitle icon={<PencilLine size={18} />} title={formatCaption(tx.labels.stepOf, { current: currentIndex + 1, total: guidedFieldOrder.length })} action={tx.fields[activeField] ?? guidedFieldLabels[activeField] ?? activeField} />
        <div className="guide-card">
          <strong>{tx.labels.guideTitle}</strong>
          <ol>
            <li>{tx.labels.guideOne}</li>
            <li>{tx.labels.guideTwo}</li>
            <li>{tx.labels.guideThree}</li>
          </ol>
        </div>
        <h2>{activeQuestion || tx.labels.completeQuestion}</h2>
        {isTemplateStep ? (
          <TemplatePreparationStep
            templates={templates}
            links={workspaceTemplateLinks}
            answerText={answerText}
            onAnswerText={onAnswerText}
            onLinkTemplate={onLinkTemplate}
            onRemoveTemplate={onRemoveTemplate}
            onUploadTemplate={onUploadTemplateForWorkspace}
            onOpenSettings={onOpenSettings}
            locale={locale}
          />
        ) : (
          <div className="guided-answer guided-rich-answer">
            <ChapterRichEditor
              markdown={answerText}
              disabled={isStreaming}
              placeholder={tx.labels.answerPlaceholder}
              labels={tx.labels}
              onMarkdownChange={onAnswerText}
              onSelectionChange={ignoreSelection}
            />
          </div>
        )}
        <div className="prep-navigation">
          <button type="button" onClick={() => previousField && onSelectField(previousField)} disabled={!previousField || isStreaming}>
            <ChevronLeft size={16} />{ui.previous}
          </button>
          {!isTemplateStep && (
            <>
              <button
                type="button"
                className={clsx("ai-suggest-button tooltip-wrap", isSuggesting && "ai-thinking")}
                data-tooltip={suggestTooltip}
                title={suggestTooltip}
                onClick={() => onSuggestAnswer(activeField)}
                disabled={!canSuggest || isStreaming}
                aria-busy={isSuggesting}
              >
                <Sparkles size={16} />{tx.labels.generateAi}
                {isSuggesting && <span className="sr-only" role="status" aria-live="polite">{tx.labels.guidedStreaming}</span>}
              </button>
              <button
                type="button"
                className={clsx("ai-detail-button tooltip-wrap ai-action-button", isExpanding && "ai-thinking")}
                data-tooltip={expandTooltip}
                title={expandTooltip}
                onClick={() => onSuggestAnswer(activeField, "expand")}
                disabled={!canExpand || isStreaming}
                aria-busy={isExpanding}
              >
                <WandSparkles size={16} />{tx.labels.expandDetail}
                {isExpanding && <span className="sr-only" role="status" aria-live="polite">{tx.labels.guidedStreaming}</span>}
              </button>
              <button type="button" className="history-action tooltip-wrap" data-tooltip={tx.labels.undoText} onClick={onUndo} disabled={!canUndo || isStreaming}>
                <RotateCcw size={16} />{tx.labels.undoText}
              </button>
              <button type="button" className="history-action tooltip-wrap" data-tooltip={tx.labels.redoText} onClick={onRedo} disabled={!canRedo || isStreaming}>
                <RotateCw size={16} />{tx.labels.redoText}
              </button>
              <button type="button" className="export-button tooltip-wrap" data-tooltip={tx.tips.prep} onClick={() => onSaveAnswer(false)} disabled={!answerText.trim() || isStreaming}>
                <Check size={16} />{tx.labels.saveAnswerShort}
              </button>
            </>
          )}
          {isTemplateStep && (
            <button type="button" className="export-button tooltip-wrap" data-tooltip={tx.tips.prep} onClick={() => onSaveAnswer(false)} disabled={!answerText.trim() || isStreaming}>
              <Check size={16} />{tx.labels.saveAnswerShort}
            </button>
          )}
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              if (!isTemplateStep && answerText.trim()) onSaveAnswer(true);
              else if (nextField) onSelectField(nextField);
            }}
            disabled={isStreaming || (!nextField && !answerText.trim() && !isTemplateStep)}
          >
            {ui.nextPage}<ChevronRight size={16} />
          </button>
        </div>
      </section>

    </div>
  );
}

function TemplatePreparationStep({
  templates,
  links,
  answerText,
  onAnswerText,
  onLinkTemplate,
  onRemoveTemplate,
  onUploadTemplate,
  onOpenSettings,
  locale
}: {
  templates: DocumentTemplate[];
  links: WorkspaceTemplateLink[];
  answerText: string;
  onAnswerText: (value: string) => void;
  onLinkTemplate: (templateId: string, notes?: string) => void;
  onRemoveTemplate: (templateId: string) => void;
  onUploadTemplate: (file: File, draft: TemplateUploadDraft) => void;
  onOpenSettings: () => void;
  locale: Locale;
}) {
  const labels = templateUi[locale] ?? templateUi.es;
  const activeTemplates = templates.filter((template) => template.status !== "archivada");
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplates[0]?.id ?? "");

  useEffect(() => {
    if (!selectedTemplateId && activeTemplates[0]) setSelectedTemplateId(activeTemplates[0].id);
  }, [activeTemplates, selectedTemplateId]);

  return (
    <div className="template-prep-panel">
      <div className="template-explain-row">
        <span className="tooltip-wrap" data-tooltip={labels.templateInternalTip}>
          <BadgeCheck size={16} aria-hidden="true" />{labels.templateInternalTip}
        </span>
        <span className="tooltip-wrap" data-tooltip={labels.referenceDifferenceTip}>
          <BookOpen size={16} aria-hidden="true" />{labels.referenceDifferenceTip}
        </span>
      </div>

      <section className="template-linked-box" aria-label={labels.linkedTemplates}>
        <div className="metadata-subpanel-title">
          <span><FileText size={16} aria-hidden="true" /> {labels.linkedTemplates}</span>
          <button type="button" className="secondary-button compact" onClick={onOpenSettings}>{labels.openSettings}</button>
        </div>
        <div className="template-chip-list">
          {links.length ? links.map((link) => (
            <button key={`${link.template_id}-${link.usage}`} type="button" className="template-chip tooltip-wrap" data-tooltip={labels.removeTemplate} onClick={() => onRemoveTemplate(link.template_id)}>
              <Check size={14} aria-hidden="true" />
              <span>{link.name ?? link.template?.name ?? link.template_id}</span>
              <small>{templateDocumentTypeLabel(link.document_type ?? link.template?.document_type)} · {link.section_count ?? link.template?.section_count ?? 0} {labels.sections.toLowerCase()}</small>
              <X size={14} aria-hidden="true" />
            </button>
          )) : <span className="empty-chip">{labels.noLinkedTemplates}</span>}
        </div>
      </section>

      <section className="template-link-box">
        <h3>{labels.chooseFromRepository}</h3>
        <div className="template-link-row">
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} aria-label={labels.selectTemplate}>
            <option value="">{labels.selectTemplate}</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {templateDocumentTypeLabel(template.document_type)} · {template.section_count ?? 0} {labels.sections.toLowerCase()}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button" onClick={() => onLinkTemplate(selectedTemplateId, answerText)} disabled={!selectedTemplateId}>
            <Link2 size={16} aria-hidden="true" />{labels.linkTemplate}
          </button>
        </div>
      </section>

      <section className="template-upload-box">
        <h3>{labels.uploadForWorkspace}</h3>
        <TemplateUploadForm
          locale={locale}
          labels={labels}
          submitLabel={labels.uploadForWorkspace}
          onUpload={onUploadTemplate}
        />
      </section>

      <label className="template-notes-label">
        {labels.notesLabel}
        <textarea value={answerText} onChange={(event) => onAnswerText(event.target.value)} placeholder={labels.notesPlaceholder} rows={3} />
      </label>
    </div>
  );
}

function SettingsScreen({
  templates,
  total,
  page,
  pages,
  query,
  status,
  documentType,
  selectedTemplateId,
  sections,
  busy,
  locale,
  onQuery,
  onStatus,
  onDocumentType,
  onPage,
  onSelect,
  onUpload,
  onCreateMarkdown,
  onArchive,
  onRestore,
  onProcess,
  ui,
  tx
}: {
  templates: DocumentTemplate[];
  total: number;
  page: number;
  pages: number;
  query: string;
  status: string;
  documentType: string;
  selectedTemplateId: string;
  sections: DocumentTemplateSection[];
  busy: string;
  locale: Locale;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onDocumentType: (value: string) => void;
  onPage: (value: number) => void;
  onSelect: (value: string) => void;
  onUpload: (file: File, draft: TemplateUploadDraft) => void;
  onCreateMarkdown: (draft: TemplateUploadDraft, markdown: string) => void;
  onArchive: (templateId: string) => void;
  onRestore: (templateId: string) => void;
  onProcess: (templateId: string) => void;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const labels = templateUi[locale] ?? templateUi.es;
  const [tab, setTab] = useState<"templates" | "system">("templates");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  return (
    <div className="settings-screen screen-grid">
      <section className="settings-tabs" aria-label={ui.nav.ajustes}>
        <button type="button" className={tab === "templates" ? "selected" : ""} onClick={() => setTab("templates")}>
          <FileText size={16} aria-hidden="true" />{labels.templatesTab}
        </button>
        <button type="button" className={tab === "system" ? "selected" : ""} onClick={() => setTab("system")}>
          <Settings size={16} aria-hidden="true" />{labels.systemTab}
        </button>
      </section>

      {tab === "system" ? (
        <section className="main-panel">
          <PanelTitle icon={<Settings size={18} />} title={labels.systemTitle} />
          <p className="plain-copy">{labels.systemCopy}</p>
        </section>
      ) : (
        <>
          <section className="main-panel template-repository-toolbar">
            <PanelTitle icon={<FileText size={18} />} title={labels.repositoryTitle} action={`${total}`} />
            <p className="plain-copy">{labels.repositoryCopy}</p>
            <div className="template-filter-row">
              <div className="search-bar">
                <Search size={18} aria-hidden="true" />
                <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={labels.searchPlaceholder} />
              </div>
              <select value={status} onChange={(event) => onStatus(event.target.value)} aria-label={labels.statusAll}>
                <option value="">{labels.statusAll}</option>
                <option value="activa">{labels.active}</option>
                <option value="procesando">{labels.processing}</option>
                <option value="error">{labels.error}</option>
                <option value="archivada">{labels.archived}</option>
              </select>
              <select value={documentType} onChange={(event) => onDocumentType(event.target.value)} aria-label={labels.typeAll}>
                <option value="">{labels.typeAll}</option>
                {templateDocumentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
          </section>

          <section className="split-panels settings-template-grid">
            <div className="main-panel template-list-panel">
              <PanelTitle icon={<ListChecks size={18} />} title={labels.templatesTab} action={`${page}/${pages}`} />
              <div className="template-list">
                {templates.map((template) => (
                  <button key={template.id} type="button" className={clsx("template-row", selectedTemplateId === template.id && "selected")} onClick={() => onSelect(template.id)}>
                    <span className="mono">{templateDocumentTypeLabel(template.document_type)}</span>
                    <strong title={template.name}>{template.name}</strong>
                    <small>{template.language.toUpperCase()} · {template.section_count ?? 0} {labels.sections.toLowerCase()} · {template.status}</small>
                    <StatusPill label={template.status} tx={tx} />
                  </button>
                ))}
                {!templates.length && <EmptyState text={labels.noTemplates} />}
              </div>
              <div className="pagination-bar" aria-label={tx.labels.paginationAria}>
                <span>{ui.pageOf} {page} / {pages} · {ui.perPage}</span>
                <div>
                  <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
                    <ChevronLeft size={16} />{ui.previous}
                  </button>
                  <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>
                    {ui.nextPage}<ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="main-panel template-detail-panel">
              <PanelTitle icon={<FileText size={18} />} title={labels.detailsTitle} action={selectedTemplate?.status} />
              {selectedTemplate ? (
                <>
                  <dl className="details-list">
                    <div><dt>{labels.name}</dt><dd>{selectedTemplate.name}</dd></div>
                    <div><dt>{labels.documentType}</dt><dd>{templateDocumentTypeLabel(selectedTemplate.document_type)}</dd></div>
                    <div><dt>{labels.version}</dt><dd>{selectedTemplate.version_label ?? selectedTemplate.active_version_id ?? "-"}</dd></div>
                    <div><dt>{labels.sourceFile}</dt><dd>{selectedTemplate.source_filename ?? "-"}</dd></div>
                    <div><dt>{labels.tags}</dt><dd>{selectedTemplate.tags?.join(", ") || "-"}</dd></div>
                  </dl>
                  {selectedTemplate.error && <AlertItem severity="alta" title={labels.error} text={selectedTemplate.error} target={selectedTemplate.name} />}
                  <div className="action-row">
                    {selectedTemplate.status === "archivada" ? (
                      <button type="button" onClick={() => onRestore(selectedTemplate.id)} disabled={Boolean(busy)}><RotateCcw size={16} />{labels.restore}</button>
                    ) : (
                      <button type="button" onClick={() => onArchive(selectedTemplate.id)} disabled={Boolean(busy)}><Archive size={16} />{labels.archive}</button>
                    )}
                    <button type="button" onClick={() => onProcess(selectedTemplate.id)} disabled={Boolean(busy)}>
                      <RefreshCw size={16} />{labels.process}
                    </button>
                  </div>
                  <section className="template-sections-box">
                    <PanelTitle icon={<ListChecks size={16} />} title={labels.sections} action={`${sections.length}`} />
                    <div className="template-section-list">
                      {sections.map((section) => (
                        <article key={section.id}>
                          <span className="mono">{String(section.section_order).padStart(2, "0")}</span>
                          <strong>{section.heading_path?.join(" / ") || section.title}</strong>
                          <small>{section.token_count_estimate ?? 0} tokens</small>
                          <p>{section.content_text.slice(0, 280)}</p>
                        </article>
                      ))}
                      {!sections.length && <EmptyState text={labels.noSections} />}
                    </div>
                  </section>
                </>
              ) : (
                <EmptyState text={labels.noTemplateSelected} />
              )}
            </div>
          </section>

          <section className="main-panel template-upload-panel">
            <PanelTitle icon={<Upload size={18} />} title={labels.uploadTemplate} />
            <TemplateUploadForm
              locale={locale}
              labels={labels}
              submitLabel={labels.upload}
              allowMarkdown
              onUpload={onUpload}
              onCreateMarkdown={onCreateMarkdown}
            />
          </section>
        </>
      )}
    </div>
  );
}

function TemplateUploadForm({
  locale,
  labels,
  submitLabel,
  allowMarkdown = false,
  onUpload,
  onCreateMarkdown
}: {
  locale: Locale;
  labels: Record<string, string>;
  submitLabel: string;
  allowMarkdown?: boolean;
  onUpload: (file: File, draft: TemplateUploadDraft) => void;
  onCreateMarkdown?: (draft: TemplateUploadDraft, markdown: string) => void;
}) {
  const [draft, setDraft] = useState<TemplateUploadDraft>({ name: "", document_type: "ppt", language: locale, tags: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [markdown, setMarkdown] = useState(`# ${labels.name}\n\n## Objeto\n\n`);

  useEffect(() => {
    setDraft((current) => ({ ...current, language: current.language || locale }));
  }, [locale]);

  return (
    <div className="template-upload-form">
      <div className="template-upload-grid">
        <label>{labels.name}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>{labels.documentType}
          <select value={draft.document_type} onChange={(event) => setDraft({ ...draft, document_type: event.target.value })}>
            {templateDocumentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label>{labels.language}
          <select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>
            {localeOptions.map((option) => <option key={option.code} value={option.code}>{option.short}</option>)}
          </select>
        </label>
        <label>{labels.tags}<input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="ppt, entidad, estructura" /></label>
      </div>
      <div className="template-file-row">
        <label>{labels.chooseFile}<input type="file" accept=".pdf,.doc,.docx,.odt,.md,.markdown,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <button type="button" className="secondary-button" disabled={!file} onClick={() => file && onUpload(file, draft)}>
          <Upload size={16} aria-hidden="true" />{submitLabel}
        </button>
      </div>
      {allowMarkdown && onCreateMarkdown && (
        <details className="template-markdown-create">
          <summary>{labels.createTemplate}</summary>
          <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={7} />
          <button type="button" className="secondary-button" disabled={!markdown.trim()} onClick={() => onCreateMarkdown(draft, markdown)}>
            <FileText size={16} aria-hidden="true" />{labels.createTemplate}
          </button>
        </details>
      )}
    </div>
  );
}

function ReferencesScreen({
  workspace,
  references,
  acceptedReferences,
  documentType,
  sources,
  kbSummary,
  onSearch,
  onToggleReference,
  locale,
  busy,
  ui,
  tx
}: {
  workspace?: Workspace;
  references: ReferenceCandidate[];
  acceptedReferences: string[];
  documentType: DocumentKind;
  sources: SourceRow[];
  kbSummary: KbSummary | null;
  onSearch: () => void;
  onToggleReference: (referenceId: string, enabled: boolean) => void;
  locale: Locale;
  busy: string;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const accepted = new Set(acceptedReferences);
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(references.length / pageSize));
  const safePage = Math.min(page, pages);
  const visibleReferences = references.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchableDocuments = sources.filter((source) => source.type?.toLowerCase() === documentType).length;

  useEffect(() => {
    setPage(1);
  }, [workspace?.id, references.length]);

  const isSearching = busy === "references";

  return (
    <div className="screen-grid">
      <section className="main-panel">
        <PanelTitle icon={<Search size={18} />} title={tx.labels.referencesPanel} action={formatCaption(tx.labels.queryIn, { lang: locale.toUpperCase() })} />
        <div className="context-notice">
          <Files size={17} aria-hidden="true" />
          <span>Se buscan documentos similares para el <strong>{documentLabels[documentType].short}</strong>. Los seleccionados alimentarán su propuesta de índice y la redacción de sus apartados.</span>
        </div>
        <p className="plain-copy">{tx.labels.referencesCopy}</p>
        <p className="reference-corpus-count tooltip-wrap" data-tooltip={tx.labels.searchableCorpusTooltip}>
          {formatCaption(tx.labels.searchableCorpus, {
            ppt: formatInteger(searchableDocuments),
            documents: formatInteger(kbSummary?.documents ?? sources.length),
            chunks: formatInteger(kbSummary?.chunks ?? 0)
          }).replaceAll("PPT", documentLabels[documentType].short)}
        </p>
        <div className="action-row">
          <button
            type="button"
            className={clsx("tooltip-wrap ai-action-button reference-search-button", isSearching && "ai-thinking")}
            data-tooltip={formatCaption(tx.labels.referencesTooltip, { lang: locale.toUpperCase() }).replaceAll("PPT", documentLabels[documentType].short)}
            onClick={onSearch}
            disabled={isSearching}
            aria-busy={isSearching}
          >
            <RefreshCw size={16} />{ui.references as string}
          </button>
        </div>
        <div className="reference-list">
          {visibleReferences.map((reference) => {
            const isAccepted = accepted.has(reference.reference_id);
            return (
              <article key={reference.reference_id} className={clsx("reference-result", isAccepted && "selected")}>
                <label className="reference-select tooltip-wrap" data-tooltip={isAccepted ? tx.labels.selectedReference : tx.labels.unselectedReference}>
                  <input
                    type="checkbox"
                    checked={isAccepted}
                    disabled={busy === "references-save"}
                    onChange={(event) => onToggleReference(reference.reference_id, event.currentTarget.checked)}
                  />
                  <span>{tx.labels.useReference}</span>
                </label>
                <div>
                  <span className="mono">{reference.reference_id}</span>
                  <strong>{reference.title}</strong>
                  <p>{reference.why.join(" · ")}</p>
                  <div className="tag-row">
                    <span>{reference.metadata.document_type?.toUpperCase()}</span>
                    <span>{reference.metadata.language?.toUpperCase()}</span>
                    <span>{reference.metadata.cpv_codes?.join(", ") || workspace?.cpv || "CPV"}</span>
                    <span>{reference.metadata.matched_chunk_count ? `${reference.metadata.matched_chunk_count} chunks` : "pliego completo"}</span>
                    <span>{isAccepted ? tx.labels.selectedReference : tx.labels.unselectedReference}</span>
                  </div>
                </div>
                <div className="reference-actions">
                  <Score value={reference.score} label={tx.labels.referenceScore} tooltip={tx.labels.referenceScoreTooltip} />
                  <a href={reference.source.url} target="_blank" rel="noreferrer" className="tooltip-wrap" data-tooltip={tx.labels.sourceTooltip}>
                    <Link2 size={15} />{ui.source as string}
                  </a>
                </div>
              </article>
            );
          })}
          {!references.length && <EmptyState text={tx.labels.noReferences} />}
        </div>
        {references.length > pageSize && (
          <div className="pagination-bar" aria-label={tx.labels.paginationAria}>
            <span>{ui.pageOf} {safePage} / {pages} · {ui.perPage.replace("10", String(pageSize))}</span>
            <div>
              <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>
                <ChevronLeft size={16} />{ui.previous}
              </button>
              <button type="button" onClick={() => setPage(Math.min(pages, safePage + 1))} disabled={safePage >= pages}>
                {ui.nextPage}<ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function IndexScreen({
  workspace,
  index,
  documentType,
  selectedChapterId,
  onSelect,
  onPropose,
  onValidate,
  onUpdate,
  onDraft,
  locale,
  ui,
  tx
}: {
  workspace?: Workspace;
  index: DraftIndex | null;
  documentType: DocumentKind;
  selectedChapterId: string;
  onSelect: (id: string) => void;
  onPropose: () => void;
  onValidate: (chapters: DraftChapter[]) => void;
  onUpdate: (chapters: DraftChapter[]) => void;
  onDraft: (chapter: DraftChapter) => void;
  locale: Locale;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const [editableChapters, setEditableChapters] = useState<DraftChapter[]>(index?.chapters ?? []);
  const proposeIndexLabel = String(ui.proposeIndex).replaceAll("PPT", documentLabels[documentType].short);
  const indexText = indexExperienceCopy[locale];
  const proposalActionLabel = index
    ? indexText.replan.replace("{document}", documentLabels[documentType].short)
    : proposeIndexLabel;

  useEffect(() => {
    setEditableChapters(index?.chapters ?? []);
    // Only persisted index revisions replace the user's in-progress structural edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index?.index_id, index?.updated_at, index?.chapters.length]);

  const structureDirty = JSON.stringify(editableChapters) !== JSON.stringify(index?.chapters ?? []);

  function patchChapter(chapterId: string, patch: Partial<DraftChapter>) {
    setEditableChapters((items) => items.map((chapter) => chapter.chapter_id === chapterId ? { ...chapter, ...patch } : chapter));
  }

  function moveChapter(chapterId: string, direction: -1 | 1) {
    setEditableChapters((items) => {
      const index = items.findIndex((chapter) => chapter.chapter_id === chapterId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((chapter, order) => ({ ...chapter, order: order + 1 }));
    });
  }

  function addChapter() {
    const sequence = editableChapters.length + 1;
    const chapter: DraftChapter = {
      chapter_id: `${documentType}-manual-${Date.now()}`,
      order: sequence,
      title: indexText.newChapter,
      required: false,
      depends_on: [],
      document_type: documentType
    };
    setEditableChapters((items) => [...items, chapter]);
    onSelect(chapter.chapter_id);
  }

  function removeChapter(chapter: DraftChapter) {
    if (editableChapters.length <= 1) return;
    if (!window.confirm(indexText.removeConfirmation.replace("{chapter}", chapter.title))) return;
    setEditableChapters((items) => items.filter((item) => item.chapter_id !== chapter.chapter_id).map((item, order) => ({ ...item, order: order + 1 })));
  }

  return (
    <div className="screen-grid">
      <section className="main-panel">
        <PanelTitle icon={<ListChecks size={18} />} title={`Índice del ${documentLabels[documentType].short}`} action={index?.validated ? tx.labels.validated : tx.labels.pending} />
        {index && (
          <div className="index-origin-notice">
            <Files size={17} aria-hidden="true" />
            <div>
              <strong>{index.origin === "template" ? indexText.proposedFromTemplate : index.origin === "similar_documents" ? indexText.proposedFromSimilar : indexText.proposedFromSpec}</strong>
              <span>{indexText.editableHint}</span>
            </div>
          </div>
        )}
        {index && (
          <aside className={clsx("index-editing-disclaimer", structureDirty && "has-unsaved-impact")} role="note" aria-live="polite">
            <AlertTriangle size={24} aria-hidden="true" />
            <div>
              <strong>{index.validated ? indexText.confirmedTitle : indexText.provisionalTitle}</strong>
              <p>{indexText.impactWarning}</p>
              <p>{indexText.historyGuarantee}</p>
            </div>
          </aside>
        )}
        <div className="action-row">
          <button type="button" onClick={onPropose}><WandSparkles size={16} />{proposalActionLabel}</button>
          <button type="button" className="secondary-button" onClick={addChapter} disabled={!index}><Plus size={16} />{indexText.addChapter}</button>
          <button type="button" onClick={() => onUpdate(editableChapters)} disabled={!structureDirty || !editableChapters.every((chapter) => chapter.title.trim())}><Check size={16} />{indexText.saveStructure}</button>
          <button type="button" onClick={() => onValidate(editableChapters)} disabled={!index || index.validated || structureDirty || !editableChapters.length}><BadgeCheck size={16} />{ui.validateIndex as string}</button>
        </div>
        {structureDirty && <p className="unsaved-structure"><AlertTriangle size={15} />{indexText.dirtyWarning}</p>}
        <div className="chapter-list editable-index-list">
          {editableChapters.map((chapter, position) => (
            <article key={chapter.chapter_id} className={clsx(selectedChapterId === chapter.chapter_id && "selected")}>
              <button type="button" className="chapter-order" onClick={() => onSelect(chapter.chapter_id)} aria-label={`Seleccionar ${chapter.title}`}>
                <span className="mono">{String(position + 1).padStart(2, "0")}</span>
              </button>
              <div className="chapter-structure-fields">
                <input
                  value={chapter.title}
                  aria-label={`Título del capítulo ${position + 1}`}
                  onFocus={() => onSelect(chapter.chapter_id)}
                  onChange={(event) => patchChapter(chapter.chapter_id, { title: event.currentTarget.value })}
                />
                <label>
                  <input type="checkbox" checked={chapter.required} onChange={(event) => patchChapter(chapter.chapter_id, { required: event.currentTarget.checked })} />
                  Obligatorio
                </label>
                <small>
                  {chapter.derived_from_similar ? "Sugerido por documentos similares" : chapter.recommended ? "Apartado recomendado" : "Estructura del expediente"}
                  {chapter.structural_sources?.length ? ` · ${chapter.structural_sources.length} fuentes estructurales` : ""}
                </small>
              </div>
              <div className="chapter-structure-actions">
                <button type="button" className="icon-only" onClick={() => moveChapter(chapter.chapter_id, -1)} disabled={position === 0} aria-label="Subir capítulo"><ArrowUp size={15} /></button>
                <button type="button" className="icon-only" onClick={() => moveChapter(chapter.chapter_id, 1)} disabled={position === editableChapters.length - 1} aria-label="Bajar capítulo"><ArrowDown size={15} /></button>
                <button type="button" className="icon-only danger" onClick={() => removeChapter(chapter)} disabled={editableChapters.length <= 1} aria-label="Quitar capítulo"><Trash2 size={15} /></button>
                <button type="button" disabled={!index?.validated || structureDirty} onClick={() => onDraft(chapter)}>{ui.draftChapter as string}</button>
              </div>
            </article>
          ))}
          {!index && <EmptyState text={formatCaption(tx.labels.indexEmpty, { action: proposeIndexLabel })} />}
        </div>
      </section>
      <section className="main-panel">
        <PanelTitle icon={<ShieldCheck size={18} />} title={tx.labels.whyValidateTitle} />
        <p className="plain-copy">{tx.labels.whyValidateCopy.replaceAll("PPT", documentLabels[documentType].short)}</p>
        <dl className="details-list">
          <div><dt>{tx.labels.expediente}</dt><dd>{workspace?.id}</dd></div>
          <div><dt>{tx.labels.document}</dt><dd>{documentLabels[documentType].title}</dd></div>
          <div><dt>{tx.labels.validation}</dt><dd>{index?.validated ? tx.labels.humanRegistered : tx.labels.pending}</dd></div>
          <div><dt>Origen del índice</dt><dd>{index?.origin ?? "pendiente"}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function EditorScreen({
  workspace,
  index,
  chapters,
  documentType,
  selectedVersion,
  versions,
  versionComparison,
  regenerationProposals,
  aiReviews,
  comments,
  saveState,
  selectedChapterId,
  editorContent,
  customInstruction,
  impacts,
  streamingChapterId,
  busy,
  locale,
  selection,
  editorRef,
  onSelect,
  onEditorChange,
  onSelectionChange,
  onCustomInstruction,
  onDraft,
  onSave,
  onImprove,
  onImpacts,
  onCreateRegeneration,
  onResolveRegeneration,
  onReviewAiChapter,
  onAddComment,
  onResolveComment,
  onRestoreVersion,
  onCompareVersion,
  onCloseComparison,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  ui,
  tx
}: {
  workspace?: Workspace;
  index: DraftIndex | null;
  chapters: ChapterVersion[];
  documentType: DocumentKind;
  selectedVersion?: ChapterVersion;
  versions: ChapterVersion[];
  versionComparison: Awaited<ReturnType<typeof compareChapterVersions>> | null;
  regenerationProposals: RegenerationProposal[];
  aiReviews: AiOutputReview[];
  comments: DocumentComment[];
  saveState: "saved" | "pending" | "saving" | "conflict" | "error";
  selectedChapterId: string;
  editorContent: string;
  customInstruction: string;
  impacts: ImpactProposal[];
  streamingChapterId: string;
  busy: string;
  locale: Locale;
  selection: RichEditorSelection;
  editorRef: RefObject<ChapterRichEditorHandle | null>;
  onSelect: (id: string) => void;
  onEditorChange: (value: string) => void;
  onSelectionChange: (selection: RichEditorSelection) => void;
  onCustomInstruction: (value: string) => void;
  onDraft: (chapter?: DraftChapter) => void;
  onSave: () => void;
  onImprove: (instruction?: string) => void;
  onImpacts: () => void;
  onCreateRegeneration: () => void;
  onResolveRegeneration: (proposalId: string, decision: "aceptar" | "rechazar", comment: string) => void;
  onReviewAiChapter: (decision: "aceptado" | "rechazado", comment: string) => void;
  onAddComment: (comment: string, anchorText?: string) => void;
  onResolveComment: (commentId: string, status: "abierto" | "resuelto") => void;
  onRestoreVersion: (versionId: string) => void;
  onCompareVersion: (versionId: string) => void;
  onCloseComparison: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const [proposalComments, setProposalComments] = useState<Record<string, string>>({});
  const [aiReviewComment, setAiReviewComment] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [chapterQuery, setChapterQuery] = useState("");
  const chapterPlan = index?.chapters ?? [];
  const normalizedChapterQuery = chapterQuery.trim().toLowerCase();
  const filteredChapterPlan = normalizedChapterQuery
    ? chapterPlan.filter((chapter) => {
        const version = chapters.find((item) => item.chapter_id === chapter.chapter_id);
        return `${chapter.title}\n${version?.content ?? ""}`.toLowerCase().includes(normalizedChapterQuery);
      })
    : chapterPlan;
  const selectedPlan = chapterPlan.find((chapter) => chapter.chapter_id === selectedChapterId);
  const isStreaming = Boolean(streamingChapterId && streamingChapterId === selectedPlan?.chapter_id);
  const isDrafting = isStreaming && busy === "draft-chapter";
  const isImproving = isStreaming && busy === "improve-chapter";
  const hasSelection = selection.characters > 0;
  const cleanEditorContent = stripExternalReferencesSection(editorContent);
  const selectedChars = Math.max(0, selection.characters);
  const customInstructionText = customInstruction.trim();
  const hasPersistedVersion = Boolean(selectedVersion?.version_id);
  const hasUnpersistedContent = Boolean(cleanEditorContent.trim()) && !hasPersistedVersion;
  const manualProtected = selectedVersion?.manual_protected || selectedVersion?.origin === "human" || selectedVersion?.generated_by === "human";
  const currentAiReview = aiReviews.find((review) => review.target_id === selectedChapterId && review.target_version_id === selectedVersion?.version_id);
  useEffect(() => setAiReviewComment(""), [selectedChapterId, selectedVersion?.version_id]);
  useEffect(() => setCommentDraft(""), [selectedChapterId]);
  const saveStateCopy = {
    saved: "Cambios guardados",
    pending: "Cambios pendientes",
    saving: "Guardando…",
    conflict: "Conflicto de versión",
    error: "Error al guardar"
  }[saveState];

  return (
    <div className="editor-workbench">
      <section className="main-panel editor-index">
        <PanelTitle icon={<ListChecks size={18} />} title={tx.labels.chaptersPanel} />
        <label className="document-search">
          <span className="sr-only">Buscar dentro del documento</span>
          <Search size={15} aria-hidden="true" />
          <input value={chapterQuery} onChange={(event) => setChapterQuery(event.currentTarget.value)} placeholder="Buscar capítulos o contenido" type="search" />
        </label>
        {filteredChapterPlan.map((chapter) => {
          const version = chapters.find((item) => item.chapter_id === chapter.chapter_id);
          const saved = Boolean(version?.version_id || version?.content?.trim());
          return (
            <button key={chapter.chapter_id} type="button" className={clsx("chapter-tab", selectedChapterId === chapter.chapter_id && "selected", saved && "saved")} onClick={() => onSelect(chapter.chapter_id)}>
              <span className="mono">{String(chapter.order).padStart(2, "0")}</span>
              <strong>{chapter.title}</strong>
              <small>{saved ? <><Check size={14} aria-hidden="true" />{tx.labels.saved}</> : tx.labels.noDraft}</small>
            </button>
          );
        })}
        {!filteredChapterPlan.length && <EmptyState text="No hay capítulos que coincidan con la búsqueda." />}
      </section>
      <section className="main-panel chapter-editor">
        <PanelTitle icon={<PencilLine size={18} />} title={selectedPlan?.title ?? tx.labels.editorDefault} action={`${saveStateCopy} · ${locale.toUpperCase()}`} />
        <div className={clsx("editor-provenance", manualProtected ? "manual" : "generated", saveState)}>
          {manualProtected ? <PencilLine size={15} /> : <Sparkles size={15} />}
          <span>{manualProtected ? "Última versión editada por una persona: la IA no puede sobrescribirla sin comparación." : "Última versión generada: cualquier edición se guardará como aportación humana protegida."}</span>
        </div>
        {!manualProtected && selectedVersion?.version_id && (
          <section className={clsx("ai-human-review", currentAiReview?.decision)} aria-label="Validación humana del contenido generado">
            <div>
              <strong>{currentAiReview?.decision === "aceptado" ? "Versión revisada y aceptada" : currentAiReview?.decision === "rechazado" ? "Versión rechazada" : "Revisión humana pendiente"}</strong>
              <span>{currentAiReview ? `${currentAiReview.reviewer_user_id} · ${currentAiReview.created_at?.slice(0, 16).replace("T", " ") || "registrada"}` : "Esta versión no podrá formar parte de un documento final hasta que una persona la acepte explícitamente."}</span>
            </div>
            {currentAiReview?.decision !== "aceptado" && (
              <div className="ai-human-review-actions">
                <input value={aiReviewComment} onChange={(event) => setAiReviewComment(event.currentTarget.value)} placeholder="Comentario de revisión (obligatorio al rechazar)" />
                <button type="button" disabled={busy === "ai-review" || saveState !== "saved"} onClick={() => onReviewAiChapter("aceptado", aiReviewComment)}><BadgeCheck size={15} />Aceptar versión</button>
                <button type="button" className="secondary-button" disabled={busy === "ai-review" || aiReviewComment.trim().length < 3} onClick={() => onReviewAiChapter("rechazado", aiReviewComment)}><X size={15} />Rechazar</button>
              </div>
            )}
          </section>
        )}
        {documentType === "pcap" && (
          <section className="pcap-structured-review" aria-label="Datos estructurados del PCAP">
            <header><strong>Datos estructurados del expediente</strong><span>Fuente común; edítalos en Expedientes antes de revisar el texto jurídico.</span></header>
            <dl>
              <div><dt>Objeto</dt><dd>{workspace?.object || "Pendiente"}</dd></div>
              <div><dt>CPV</dt><dd>{workspace?.cpv_codes?.join(", ") || workspace?.cpv || "Pendiente"}</dd></div>
              <div><dt>Presupuesto</dt><dd>{workspace?.budget ? formatEuro(workspace.budget) : "Pendiente"}</dd></div>
              <div><dt>Valor estimado</dt><dd>{workspace?.estimated_value ? formatEuro(workspace.estimated_value) : "Pendiente"}</dd></div>
              <div><dt>IVA</dt><dd>{workspace?.tax_rate !== null && workspace?.tax_rate !== undefined ? `${workspace.tax_rate} %` : "Pendiente"}</dd></div>
              <div><dt>Procedimiento</dt><dd>{workspace?.procedure || "Pendiente"}</dd></div>
              <div><dt>Duración</dt><dd>{workspace?.duration || "Pendiente"}</dd></div>
              <div><dt>Lotes</dt><dd>{workspace?.lots || "Pendiente"}</dd></div>
            </dl>
          </section>
        )}
        <p className="plain-copy">
          {tx.labels.editorCopy}
        </p>
        <ChapterRichEditor
          ref={editorRef}
          markdown={cleanEditorContent}
          disabled={Boolean(streamingChapterId)}
          placeholder={tx.labels.chapterPlaceholder}
          labels={tx.labels}
          onMarkdownChange={(value) => onEditorChange(stripExternalReferencesSection(value))}
          onSelectionChange={onSelectionChange}
        />
        {hasSelection && <p className="selection-hint">{formatCaption(tx.labels.selectedChars, { count: selectedChars })}</p>}
        <div className="action-row">
          <button
            type="button"
            className={clsx("tooltip-wrap ai-action-button", isDrafting && "ai-thinking")}
            data-tooltip={tx.labels.draftTooltip}
            onClick={() => hasPersistedVersion ? onCreateRegeneration() : onDraft(selectedPlan)}
            disabled={!selectedPlan || Boolean(streamingChapterId) || hasUnpersistedContent || saveState === "pending" || saveState === "saving"}
            aria-busy={isDrafting}
          >
            <Sparkles size={16} />{hasPersistedVersion ? "Proponer regeneración" : ui.draftChapter as string}
            {isDrafting && <span className="sr-only" role="status" aria-live="polite">{tx.labels.streaming}</span>}
          </button>
          <button type="button" onClick={onSave} disabled={Boolean(streamingChapterId)}><Check size={16} />{ui.saveChapter as string}</button>
          <button type="button" className="history-action tooltip-wrap" data-tooltip={tx.labels.undoText} onClick={onUndo} disabled={!canUndo || Boolean(streamingChapterId)}>
            <RotateCcw size={16} />{tx.labels.undoText}
          </button>
          <button type="button" className="history-action tooltip-wrap" data-tooltip={tx.labels.redoText} onClick={onRedo} disabled={!canRedo || Boolean(streamingChapterId)}>
            <RotateCw size={16} />{tx.labels.redoText}
          </button>
          <button type="button" onClick={onImpacts}><RefreshCw size={16} />{ui.impacts as string}</button>
        </div>
        <div className="editor-instruction-panel tooltip-wrap" data-tooltip={tx.labels.customInstructionTooltip}>
          <span>{tx.labels.customInstructionLabel}</span>
          <div className="editor-instruction-row">
            <textarea
              value={customInstruction}
              onChange={(event) => onCustomInstruction(event.target.value)}
              placeholder={tx.labels.customInstructionPlaceholder}
              disabled={Boolean(streamingChapterId)}
              rows={2}
            />
            <button
              type="button"
              className={clsx("tooltip-wrap secondary-button ai-action-button instruction-generate-button", isImproving && "ai-thinking")}
              data-tooltip={formatCaption(hasSelection ? tx.labels.improveSelectionTooltip : tx.labels.improveChapterTooltip, { lang: locale.toUpperCase() })}
              onClick={() => onImprove(customInstructionText)}
              disabled={!cleanEditorContent.trim() || Boolean(streamingChapterId)}
              aria-busy={isImproving}
            >
              <WandSparkles size={16} />{tx.labels.generatePrompt}
              {isImproving && <span className="sr-only" role="status" aria-live="polite">{tx.labels.streaming}</span>}
            </button>
          </div>
        </div>
      </section>
      <aside className="main-panel impact-panel">
        <PanelTitle icon={<History size={18} />} title="Versiones y cambios IA" action={documentLabels[documentType].short} />
        <div className="version-list">
          {versions.slice(0, 8).map((version, position) => (
            <article key={version.version_id} className={clsx(position === 0 && "current")}>
              <div>
                <strong>{version.version_label ?? `v${versions.length - position}`}</strong>
                <span>{version.origin === "human" || version.generated_by === "human" ? "Edición humana" : "Generada con IA"}</span>
              </div>
              <small>{version.created_at?.slice(0, 16).replace("T", " ")} · {version.summary || "sin resumen"}</small>
              {position > 0 && version.version_id && (
                <div className="version-actions">
                  <button type="button" className="secondary-button" onClick={() => onCompareVersion(version.version_id!)}><Eye size={14} />Comparar con actual</button>
                  <button type="button" className="secondary-button" onClick={() => onRestoreVersion(version.version_id!)}><RotateCcw size={14} />Restaurar como nueva versión</button>
                </div>
              )}
            </article>
          ))}
          {!versions.length && <EmptyState text="Este apartado todavía no tiene versiones." />}
        </div>
        {versionComparison && (
          <details className="version-comparison" open>
            <summary><History size={15} /> Comparación de versiones</summary>
            <button type="button" className="icon-button comparison-close" onClick={onCloseComparison} aria-label="Cerrar comparación"><X size={15} /></button>
            <div className="regeneration-compare">
              <section><strong>{versionComparison.left.version_label || "Versión anterior"}</strong><MarkdownPreview content={versionComparison.left.content || ""} emptyText="Sin contenido" /></section>
              <section><strong>{versionComparison.right.version_label || "Versión actual"}</strong><MarkdownPreview content={versionComparison.right.content || ""} emptyText="Sin contenido" /></section>
            </div>
            <details className="technical-diff">
              <summary>Diferencias línea a línea</summary>
              <pre>{versionComparison.diff || "No hay diferencias textuales."}</pre>
            </details>
          </details>
        )}
        <div className="regeneration-list">
          {regenerationProposals.filter((proposal) => proposal.status === "pendiente").map((proposal) => (
            <details key={proposal.id} open>
              <summary><Sparkles size={15} /> Propuesta pendiente de comparación</summary>
              <div className="regeneration-compare">
                <section><strong>Versión actual</strong><MarkdownPreview content={proposal.base_content} emptyText="Sin contenido" /></section>
                <section><strong>Propuesta IA</strong><MarkdownPreview content={proposal.proposed_content} emptyText="Sin contenido" /></section>
              </div>
              <label className="resolution-comment">
                <span>Motivo de la decisión</span>
                <textarea
                  rows={2}
                  value={proposalComments[proposal.id] ?? ""}
                  onChange={(event) => setProposalComments((items) => ({ ...items, [proposal.id]: event.currentTarget.value }))}
                  placeholder="Explica por qué aceptas o rechazas el cambio"
                />
              </label>
              <div className="action-row">
                <button type="button" disabled={(proposalComments[proposal.id]?.trim().length ?? 0) < 3} onClick={() => onResolveRegeneration(proposal.id, "aceptar", proposalComments[proposal.id])}><Check size={14} />Aceptar propuesta</button>
                <button type="button" className="secondary-button" disabled={(proposalComments[proposal.id]?.trim().length ?? 0) < 3} onClick={() => onResolveRegeneration(proposal.id, "rechazar", proposalComments[proposal.id])}><X size={14} />Rechazar</button>
              </div>
            </details>
          ))}
        </div>
        <PanelTitle icon={<FileText size={18} />} title="Comentarios de revisión" action={`${comments.filter((comment) => comment.status === "abierto").length} abiertos`} />
        <div className="comment-composer">
          {selection.text && <blockquote>Sobre: “{selection.text.slice(0, 180)}{selection.text.length > 180 ? "…" : ""}”</blockquote>}
          <textarea rows={2} value={commentDraft} onChange={(event) => setCommentDraft(event.currentTarget.value)} placeholder="Añade una observación, decisión o tarea de revisión" />
          <button type="button" disabled={commentDraft.trim().length < 2 || busy === "comment-add"} onClick={() => { onAddComment(commentDraft, selection.text || undefined); setCommentDraft(""); }}><Plus size={14} />Añadir comentario</button>
        </div>
        <div className="document-comment-list">
          {comments.map((comment) => (
            <article key={comment.id} className={comment.status === "resuelto" ? "resolved" : ""}>
              <header><strong>{comment.created_by}</strong><small>{comment.created_at?.slice(0, 16).replace("T", " ")}</small></header>
              {comment.anchor_text && <blockquote>{comment.anchor_text}</blockquote>}
              <p>{comment.comment_text}</p>
              <button type="button" className="secondary-button" onClick={() => onResolveComment(comment.id, comment.status === "abierto" ? "resuelto" : "abierto")}><Check size={13} />{comment.status === "abierto" ? "Resolver" : "Reabrir"}</button>
            </article>
          ))}
          {!comments.length && <EmptyState text="No hay comentarios en este apartado." />}
        </div>
        <PanelTitle icon={<RefreshCw size={18} />} title={tx.labels.impactsPanel} />
        <p className="plain-copy">{tx.labels.impactsCopy}</p>
        <div className="impact-list">
          {impacts.map((impact) => (
            <article key={impact.target_chapter_id}>
              <strong>{impact.target_title}</strong>
              <span>{impact.reason}</span>
              <p>{impact.proposal}</p>
            </article>
          ))}
          {!impacts.length && <EmptyState text={tx.labels.impactsEmpty} />}
        </div>
      </aside>
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "blockquote"; text: string }
  | { type: "hr" }
  | { type: "code"; text: string };

function MarkdownPreview({ content, emptyText }: { content: string; emptyText: string }) {
  const blocks = parseMarkdownBlocks(content);
  if (!blocks.length) return <EmptyState text={emptyText} />;
  return (
    <article className="markdown-preview">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </article>
  );
}

function stripExternalReferencesSection(content: string) {
  const text = normalizeMarkdownTables(content || "").trimEnd();
  if (!text) return "";
  const lines = text.split("\n");
  const start = lines.findIndex((line) => {
    const normalized = stripAccents(line).toLowerCase().trim();
    const referenceHeading = [
      "referencias externas consultadas",
      "referencias externas",
      "referencies externes consultades",
      "referencies externes",
      "kanpoko erreferentziak",
      "external references"
    ].some((marker) => normalized.includes(marker));
    return normalized.startsWith("#") && referenceHeading;
  });
  if (start < 0) return text;
  let cut = start;
  while (cut > 0 && !lines[cut - 1].trim()) cut -= 1;
  if (cut > 0 && ["---", "***", "___"].includes(lines[cut - 1].trim())) cut -= 1;
  while (cut > 0 && !lines[cut - 1].trim()) cut -= 1;
  return lines.slice(0, cut).join("\n").trimEnd();
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = normalizeMarkdownTables(content).split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let index = 0;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
    paragraph = [];
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }
    if (trimmed.startsWith("```")) {
      flushParagraph();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }
    const table = collectMarkdownTable(lines, index);
    if (table) {
      flushParagraph();
      blocks.push({ type: "table", rows: table.rows });
      index = table.nextIndex;
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    paragraph.push(trimmed);
    index += 1;
  }
  flushParagraph();
  return blocks;
}

function normalizeMarkdownTables(content: string) {
  return (content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const collapsedRows = line.match(/\|\|/g)?.length ?? 0;
      const hasSeparatorRow = /(^|\|)\s*:?-{3,}:?\s*(\||$)/.test(line);
      if (!collapsedRows || (!hasSeparatorRow && collapsedRows < 2)) return line;
      return line.replace(/[ \t]*\|\|[ \t]*/g, " |\n| ");
    })
    .join("\n");
}

function collectMarkdownTable(lines: string[], start: number): { rows: string[][]; nextIndex: number } | null {
  if (start + 1 >= lines.length || !lines[start].includes("|") || !lines[start + 1].includes("|")) return null;
  const separatorCells = splitMarkdownTableRow(lines[start + 1]);
  if (!separatorCells.length || !separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))) return null;
  const rows = [splitMarkdownTableRow(lines[start])];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().includes("|")) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }
  const width = Math.max(...rows.map((row) => row.length));
  return {
    rows: rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]),
    nextIndex: index
  };
}

function splitMarkdownTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderMarkdownBlock(block: MarkdownBlock, index: number) {
  if (block.type === "heading") {
    const children = renderInlineMarkdown(block.text, `h-${index}`);
    if (block.level === 1) return <h1 key={index}>{children}</h1>;
    if (block.level === 2) return <h2 key={index}>{children}</h2>;
    if (block.level === 3) return <h3 key={index}>{children}</h3>;
    return <h4 key={index}>{children}</h4>;
  }
  if (block.type === "paragraph") return <p key={index}>{renderInlineMarkdown(block.text, `p-${index}`)}</p>;
  if (block.type === "blockquote") return <blockquote key={index}>{renderInlineMarkdown(block.text, `q-${index}`)}</blockquote>;
  if (block.type === "hr") return <hr key={index} />;
  if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
  if (block.type === "table") {
    const header = block.rows[0] ?? [];
    const body = block.rows.slice(1);
    return (
      <div key={index} className="markdown-table-wrap">
        <table>
          <thead>
            <tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(cell, `th-${index}-${cellIndex}`)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell, `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "ul") {
    return (
      <ul key={index}>
        {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}</li>)}
      </ul>
    );
  }
  return (
    <ol key={index}>
      {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}</li>)}
    </ol>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[PENDIENTE:[^\]]+\])/g).filter((part) => part.length > 0);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("[PENDIENTE:") && part.endsWith("]")) return <span key={key} className="pending-inline">{part}</span>;
    return <span key={key}>{part}</span>;
  });
}

function ValidationScreen({
  workspace,
  documents,
  issues,
  changes,
  busy,
  onRun,
  onResolveIssue,
  onResolveChange,
  tx
}: {
  workspace?: Workspace;
  documents: DocumentOverview[];
  issues: ValidationIssue[];
  changes: ChangeProposal[];
  busy: string;
  onRun: () => void;
  onResolveIssue: (issueId: string, status: ValidationIssue["status"], comment: string) => void;
  onResolveChange: (proposalId: string, decision: "aceptar" | "rechazar", comment: string) => void;
  tx: CaptionSet;
}) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const openIssues = issues.filter((issue) => ["abierta", "en_revision"].includes(issue.status));
  const pendingChanges = changes.filter((change) => change.status === "pendiente");
  const totals = {
    error: openIssues.filter((issue) => issue.severity === "error").length,
    advertencia: openIssues.filter((issue) => issue.severity === "advertencia").length,
    recomendacion: openIssues.filter((issue) => issue.severity === "recomendacion").length
  };
  return (
    <div className="validation-workbench">
      <section className="main-panel validation-summary">
        <PanelTitle icon={<ClipboardCheck size={18} />} title="Coherencia del expediente" action={workspace?.id} />
        <p className="plain-copy">La revisión contrasta los datos maestros y las obligaciones entre Informe, PPT y PCAP respetando la función distinta de cada documento. No sustituye la revisión técnica, económica o jurídica.</p>
        <div className="validation-metrics">
          <span className="metric-error"><strong>{totals.error}</strong> errores</span>
          <span className="metric-warning"><strong>{totals.advertencia}</strong> advertencias</span>
          <span className="metric-info"><strong>{totals.recomendacion}</strong> recomendaciones</span>
          <span><strong>{pendingChanges.length}</strong> cambios comunes pendientes</span>
        </div>
        <button type="button" className={clsx("ai-action-button", busy === "coherence" && "ai-thinking")} onClick={onRun} disabled={busy === "coherence"}>
          <RefreshCw size={16} />Comprobar los tres documentos
        </button>
        <div className="document-review-status">
          {documentKinds.map((documentType) => {
            const document = documents.find((item) => item.document_type === documentType);
            return (
              <article key={documentType}>
                <strong>{documentLabels[documentType].short}</strong>
                <span>{document?.exists ? `${document.required_completed}/${document.required_total} obligatorios completos` : "No iniciado"}</span>
                <StatusPill label={document?.status ?? "no_iniciado"} tx={tx} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="main-panel">
        <PanelTitle icon={<AlertTriangle size={18} />} title="Alertas documentales" action={`${openIssues.length} abiertas`} />
        <div className="coherence-issue-list">
          {issues.map((issue) => {
            const comment = comments[issue.id] ?? issue.resolution_comment ?? "";
            const resolved = !["abierta", "en_revision"].includes(issue.status);
            return (
              <article key={issue.id} className={clsx(`severity-${issue.severity}`, resolved && "resolved")}>
                <header>
                  <span className="issue-severity">{issue.severity}</span>
                  <StatusPill label={issue.status} tx={tx} />
                </header>
                <h3>{issue.title}</h3>
                <p>{issue.explanation}</p>
                <div className="issue-locations">
                  {issue.locations.map((location, index) => (
                    <span key={`${issue.id}-${index}`}>{location.document_type ? documentLabels[location.document_type].short : "Expediente"}{location.title ? ` · ${location.title}` : location.field ? ` · ${location.field}` : ""}</span>
                  ))}
                </div>
                <div className="issue-proposal"><strong>Corrección propuesta</strong><span>{issue.proposal}</span></div>
                {!resolved && (
                  <div className="issue-resolution">
                    <textarea rows={2} value={comment} onChange={(event) => setComments((items) => ({ ...items, [issue.id]: event.currentTarget.value }))} placeholder="Justificación obligatoria de la resolución" />
                    <button type="button" disabled={comment.trim().length < 3} onClick={() => onResolveIssue(issue.id, "corregida", comment)}><Check size={14} />Marcar corregida</button>
                    <button type="button" className="secondary-button" disabled={comment.trim().length < 3} onClick={() => onResolveIssue(issue.id, "descartada", comment)}><X size={14} />Descartar justificadamente</button>
                  </div>
                )}
              </article>
            );
          })}
          {!issues.length && <EmptyState text="Ejecuta la comprobación para localizar contradicciones, ausencias y riesgos de coordinación." />}
        </div>
      </section>

      <section className="main-panel">
        <PanelTitle icon={<RefreshCw size={18} />} title="Impacto de datos comunes" action={`${pendingChanges.length} pendientes`} />
        <p className="plain-copy">Aceptar una propuesta no sobrescribe capítulos: los marca para revisión individual y mantiene intacto el contenido humano.</p>
        <div className="change-proposal-list">
          {changes.map((change) => {
            const comment = comments[change.id] ?? change.resolution_comment ?? "";
            return (
              <article key={change.id} className={clsx(change.status !== "pendiente" && "resolved")}>
                <header><strong>{change.field_name}</strong><StatusPill label={change.status} tx={tx} /></header>
                <div className="change-values">
                  <div><span>Valor anterior</span><code>{formatStructuredValue(change.previous_value)}</code></div>
                  <div><span>Nuevo valor</span><code>{formatStructuredValue(change.proposed_value)}</code></div>
                </div>
                <ul>
                  {change.impacted_sections.map((section) => (
                    <li key={`${change.id}-${section.chapter_id}`} className={clsx(section.manually_edited && "manual-protected")}>
                      <strong>{documentLabels[section.document_type].short}</strong> · {section.title}{section.manually_edited ? " · edición humana protegida" : ""}
                    </li>
                  ))}
                </ul>
                {change.status === "pendiente" && (
                  <div className="issue-resolution">
                    <textarea rows={2} value={comment} onChange={(event) => setComments((items) => ({ ...items, [change.id]: event.currentTarget.value }))} placeholder="Motivo de aceptar o rechazar la propagación propuesta" />
                    <button type="button" disabled={comment.trim().length < 3} onClick={() => onResolveChange(change.id, "aceptar", comment)}><Check size={14} />Aceptar para revisión</button>
                    <button type="button" className="secondary-button" disabled={comment.trim().length < 3} onClick={() => onResolveChange(change.id, "rechazar", comment)}><X size={14} />Rechazar</button>
                  </div>
                )}
              </article>
            );
          })}
          {!changes.length && <EmptyState text="No hay cambios de datos maestros pendientes de propagación." />}
        </div>
      </section>
    </div>
  );
}

function formatStructuredValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function SourcesExportScreen({
  sources,
  workspaceSources,
  auditEvents,
  references,
  exportResult,
  documentType,
  busy,
  onUpload,
  onToggleSource,
  onExport,
  onExportDossier,
  ui,
  tx
}: {
  sources: SourceRow[];
  workspaceSources: WorkspaceSource[];
  auditEvents: AuditEvent[];
  references: ReferenceCandidate[];
  exportResult: string;
  documentType: DocumentKind;
  busy: string;
  onUpload: (file: File, title?: string) => void;
  onToggleSource: (sourceId: string, included: boolean) => void;
  onExport: () => void;
  onExportDossier: () => void;
  ui: typeof copy.es;
  tx: CaptionSet;
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  return (
    <div className="screen-grid">
      <section className="main-panel">
        <PanelTitle icon={<Upload size={18} />} title="Documentación aportada al expediente" action={`${workspaceSources.length} fuentes`} />
        <p className="plain-copy">Sube PDF, DOCX, ODT, Markdown o texto. Su contenido se trata como evidencia no confiable: se ignoran instrucciones incrustadas y se conserva hash, origen e inclusión.</p>
        <div className="source-upload-form">
          <label>
            <span>Documento de referencia</span>
            <input type="file" accept=".pdf,.docx,.odt,.md,.txt" onChange={(event) => setSourceFile(event.currentTarget.files?.[0] ?? null)} />
          </label>
          <label>
            <span>Título identificable</span>
            <input value={sourceTitle} onChange={(event) => setSourceTitle(event.currentTarget.value)} placeholder={sourceFile?.name ?? "Ej. Memoria técnica aprobada"} />
          </label>
          <button
            type="button"
            disabled={!sourceFile || busy === "source-upload"}
            onClick={() => {
              if (!sourceFile) return;
              onUpload(sourceFile, sourceTitle);
              setSourceFile(null);
              setSourceTitle("");
            }}
          ><Upload size={16} />Procesar e incorporar</button>
        </div>
        <div className="workspace-source-list">
          {workspaceSources.map((source) => (
            <article key={source.id}>
              <div><strong>{source.title}</strong><span>{source.original_filename} · {Math.max(1, Math.round(source.size_bytes / 1024))} KB</span><code>{source.content_hash.slice(0, 16)}…</code></div>
              <label className="source-inclusion-toggle">
                <input type="checkbox" checked={source.included_in_generation} onChange={(event) => onToggleSource(source.id, event.currentTarget.checked)} />
                Usar en redacción
              </label>
              <StatusPill label={source.status} tx={tx} />
            </article>
          ))}
          {!workspaceSources.length && <EmptyState text="Todavía no se ha aportado documentación específica a este expediente." />}
        </div>
      </section>
      <section className="main-panel">
        <PanelTitle icon={<Download size={18} />} title={`Exportar ${documentLabels[documentType].short}`} action={exportResult || "DOCX"} />
        <p className="plain-copy">{tx.labels.exportCopy}</p>
        <div className="context-notice"><ShieldCheck size={16} /><span>El documento conserva títulos, listas, tablas, numeración, avisos de revisión e identificación del expediente.</span></div>
        <div className="action-row">
          <button type="button" className="export-button" onClick={onExport}><Download size={16} />{ui.export as string} {documentLabels[documentType].short}</button>
          <button type="button" className="secondary-button" onClick={onExportDossier} disabled={busy === "export-dossier" || busy === "download-dossier"}><Files size={16} />Exportar expediente completo (.zip)</button>
        </div>
      </section>
      <section className="split-panels">
        <div className="main-panel">
          <PanelTitle icon={<BookOpen size={18} />} title={tx.labels.acceptedSources} />
          <div className="source-table compact">
            {(references.length ? references : sources.slice(0, 6).map((source) => ({
              reference_id: source.source_id,
              title: source.title,
              score: 0.7,
              source: { source_id: source.source_id, title: source.title, url: source.url, trust: source.trust },
              why: [source.type],
              metadata: { document_type: source.type },
              status: source.status
            } as ReferenceCandidate))).map((source) => (
              <article key={source.reference_id}>
                <div><span className="mono">{source.reference_id}</span><strong>{source.title}</strong></div>
                <StatusPill label={source.status} tx={tx} />
                <a href={source.source.url} target="_blank" rel="noreferrer"><Link2 size={16} /></a>
              </article>
            ))}
          </div>
        </div>
        <div className="main-panel">
          <PanelTitle icon={<History size={18} />} title={tx.labels.recentAudit} />
          <div className="audit-list">
            {auditEvents.slice(0, 8).map((event) => (
              <article key={event.id}>
                <time>{event.created_at?.slice(0, 16).replace("T", " ")}</time>
                <strong>{event.action}</strong>
                <small>{event.user_id}</small>
                <span className="mono">{event.trace_id}</span>
              </article>
            ))}
            {!auditEvents.length && <EmptyState text={tx.labels.noAudit} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: string }) {
  return (
    <div className="panel-title">
      <div>{icon}<h2>{title}</h2></div>
      {action && <span>{action}</span>}
    </div>
  );
}

function IconButton({ title, tooltip, icon, onClick }: { title: string; tooltip?: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" className="icon-button tooltip-wrap" title={title} data-tooltip={tooltip ?? title} aria-label={title} onClick={onClick}>{icon}</button>;
}

function StatusPill({ label, tx }: { label: string; tx: CaptionSet }) {
  return <span className="status-pill">{tx.statuses[label] ?? statusLabel(label)}</span>;
}

function Score({ value, label, tooltip }: { value: number; label?: string; tooltip?: string }) {
  const percent = Math.round(value * 100);
  return (
    <div className="score compact tooltip-wrap" data-tooltip={tooltip}>
      {label && <small>{label}</small>}
      <strong>{percent}%</strong>
      <span><i style={{ width: `${percent}%` }} /></span>
    </div>
  );
}

function AlertItem({ severity, title, text, target }: { severity: Severity; title: string; text: string; target: string }) {
  return (
    <article className="alert-item">
      <span className={clsx("severity", severityClass(severity))}>{severity}</span>
      <div><strong>{title}</strong><p>{text}</p><small>{target}</small></div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <article className="empty-state"><Eye size={20} aria-hidden="true" /><strong>{text}</strong></article>;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function guidedFieldValue(workspace: Workspace | undefined, field: string) {
  if (!workspace) return "";
  const direct = (workspace as unknown as Record<string, unknown>)[field];
  if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct);
  const answers = workspace.elicit?.answers ?? [];
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const answer = answers[index];
    if (answer.field === field && String(answer.answer ?? "").trim()) return String(answer.answer);
  }
  return "";
}

function firstIncompleteGuidedField(workspace: Workspace | undefined) {
  return guidedFieldOrderFor(workspace).find((field) => !guidedFieldValue(workspace, field)) ?? null;
}

function normalizeGuidedField(workspace: Workspace | undefined, field: string | null | undefined) {
  const order = guidedFieldOrderFor(workspace);
  if (field && order.includes(field)) return field;
  return firstIncompleteGuidedField(workspace) ?? order[0] ?? "object";
}

function adjacentGuidedField(field: string, direction: -1 | 1, workspace?: Workspace) {
  const order = guidedFieldOrderFor(workspace);
  const index = order.indexOf(field);
  if (index < 0) return null;
  return order[index + direction] ?? null;
}

function questionFor(field: string | null | undefined, tx: CaptionSet) {
  return tx.questions[field ?? "object"] ?? guidedQuestionFallbacks[field ?? ""] ?? tx.questions.fallback;
}

function guidedFieldOrderFor(workspace?: Workspace, documentType?: DocumentKind) {
  const raw = documentType ?? (workspace?.target_document === "memoria" ? "informe_necesidad" : workspace?.target_document);
  const kind = documentKinds.includes(raw as DocumentKind) ? raw as DocumentKind : "ppt";
  return guidedFieldOrders[kind];
}

function formatCaption(template: string, values: Record<string, string | number | boolean>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function truncateText(value: string, maxLength: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function parseTemplateTags(value: string) {
  return value
    .split(/[,\n;]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function emptyMetadataDraft(): MetadataDraft {
  return {
    file_number: "",
    title: "",
    unit: "",
    contracting_body: "",
    promoting_unit: "",
    object: "",
    need: "",
    budget: "",
    estimated_value: "",
    tax_rate: "21",
    funding: "",
    cpv: "",
    cpv_codes: [],
    contract_type: "",
    procedure: "",
    duration: "",
    extensions: "",
    contract_manager: "",
    data_protection: "",
    confidentiality: "",
    intellectual_property: "",
    publication_date: "",
    submission_deadline: "",
    award_date: "",
    formalization_date: "",
    start_date: "",
    end_date: "",
    lots: ""
  };
}

function metadataDraftFromWorkspace(workspace: Workspace): MetadataDraft {
  const cpvCodes = workspace.cpv_codes?.length ? workspace.cpv_codes : splitCpvCodes(workspace.cpv ?? "");
  return {
    file_number: workspace.file_number ?? "",
    title: workspace.title ?? "",
    unit: workspace.unit ?? "",
    contracting_body: workspace.contracting_body ?? "",
    promoting_unit: workspace.promoting_unit ?? "",
    object: workspace.object ?? "",
    need: workspace.need ?? "",
    budget: workspace.budget == null ? "" : formatDecimalNumber(workspace.budget),
    estimated_value: workspace.estimated_value == null ? "" : formatDecimalNumber(workspace.estimated_value),
    tax_rate: workspace.tax_rate == null ? "" : formatDecimalNumber(workspace.tax_rate),
    funding: workspace.funding ?? "",
    cpv: workspace.cpv ?? cpvCodes[0] ?? "",
    cpv_codes: cpvCodes,
    contract_type: workspace.contract_type ?? "",
    procedure: workspace.procedure ?? "",
    duration: workspace.duration ?? "",
    extensions: workspace.extensions ?? "",
    contract_manager: workspace.contract_manager ?? "",
    data_protection: workspace.data_protection ?? "",
    confidentiality: workspace.confidentiality ?? "",
    intellectual_property: workspace.intellectual_property ?? "",
    publication_date: workspace.publication_date ?? "",
    submission_deadline: workspace.submission_deadline ?? "",
    award_date: workspace.award_date ?? "",
    formalization_date: workspace.formalization_date ?? "",
    start_date: workspace.start_date ?? "",
    end_date: workspace.end_date ?? "",
    lots: workspace.lots ?? ""
  };
}

function metadataDraftEquals(left: MetadataDraft, right: MetadataDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function metadataPayloadFromDraft(draft: MetadataDraft, locale: Locale, fallbackTitle: string, fallbackUnit: string): Partial<Workspace> {
  const cpvCodes = draft.cpv_codes.length ? draft.cpv_codes : splitCpvCodes(draft.cpv);
  return {
    file_number: draft.file_number.trim(),
    title: draft.title.trim() || fallbackTitle,
    unit: draft.unit.trim() || fallbackUnit,
    contracting_body: draft.contracting_body.trim(),
    promoting_unit: draft.promoting_unit.trim(),
    object: draft.object.trim(),
    need: draft.need.trim(),
    budget: numberFromText(draft.budget),
    estimated_value: numberFromText(draft.estimated_value),
    tax_rate: numberFromText(draft.tax_rate),
    funding: draft.funding.trim(),
    cpv: cpvCodes[0] ?? "",
    cpv_codes: cpvCodes,
    contract_type: draft.contract_type.trim(),
    duration: draft.duration.trim(),
    extensions: draft.extensions.trim(),
    contract_manager: draft.contract_manager.trim(),
    data_protection: draft.data_protection.trim(),
    confidentiality: draft.confidentiality.trim(),
    intellectual_property: draft.intellectual_property.trim(),
    procedure: draft.procedure.trim(),
    publication_date: draft.publication_date,
    submission_deadline: draft.submission_deadline,
    award_date: draft.award_date,
    formalization_date: draft.formalization_date,
    start_date: draft.start_date,
    end_date: draft.end_date,
    lots: draft.lots.trim(),
    language: locale
  };
}

function splitCpvCodes(value: string) {
  return Array.from(new Set(value.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean)));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function localDateFromIso(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDurationToDate(start: Date, durationText: string) {
  const offset = durationOffsetFromText(durationText);
  return addDays(addMonths(start, offset.months), offset.days);
}

function durationOffsetFromText(value: string) {
  const text = normalizePlainText(value);
  const pattern = /(\d+(?:[.,]\d+)?)\s*(anos?|anys?|anios?|urte(?:ak)?|years?|meses|mesos|months?|m\b|dias?|dies|egun(?:ak)?|days?|semanas?|setmanes?|aste(?:ak)?|weeks?)/g;
  let months = 0;
  let days = 0;
  let matched = false;
  for (const match of text.matchAll(pattern)) {
    matched = true;
    const amount = Number(match[1].replace(",", "."));
    const unit = match[2];
    if (!Number.isFinite(amount)) continue;
    if (/^(ano|anos|any|anys|anio|anios|urte|urteak|year|years)/.test(unit)) months += amount * 12;
    else if (/^(mes|meses|mesos|month|months|m)$/.test(unit)) months += amount;
    else if (/^(semana|semanas|setmana|setmanes|aste|asteak|week|weeks)/.test(unit)) days += amount * 7;
    else days += amount;
  }
  if (!matched) {
    const number = Number((text.match(/\d+(?:[.,]\d+)?/)?.[0] ?? "").replace(",", "."));
    if (Number.isFinite(number) && number > 0) months = number;
  }
  if (!months && !days) months = 12;
  const wholeMonths = Math.trunc(months);
  return { months: wholeMonths, days: Math.round(days + (months - wholeMonths) * 30) };
}

function normalizePlainText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0
  }).format(value);
}

function normalizeAnswerDraft(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function formatDecimalNumber(value: number) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDecimalText(value: string) {
  const parsed = numberFromText(value);
  return parsed == null ? value.trim() : formatDecimalNumber(parsed);
}

function numberFromText(value: string) {
  if (!value.trim()) return null;
  const text = value.trim().replace(/\s/g, "");
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(text)
      ? text.replace(/\./g, "")
      : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
