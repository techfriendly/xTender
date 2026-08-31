export type Locale = "es" | "ca" | "va" | "gl" | "eu";

export const localeOptions: Array<{ code: Locale; short: string; label: string }> = [
  { code: "es", short: "ES", label: "Castellano" },
  { code: "ca", short: "CA", label: "Català" },
  { code: "va", short: "VA", label: "Valencià" },
  { code: "gl", short: "GL", label: "Galego" },
  { code: "eu", short: "EU", label: "Euskara" }
];
