export type Severity = "critica" | "alta" | "media" | "baja";

export function formatEuro(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

export function severityClass(severity: Severity) {
  return {
    critica: "danger",
    alta: "danger",
    media: "warning",
    baja: "info"
  }[severity];
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
