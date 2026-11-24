/**
 * CRM settings Elvyn can change without touching the code logic.
 * The knowledge base does not define pipeline labels, so these are a proposal.
 */
export const PIPELINE = [
  { key: "nuevo", label: "Nuevo" },
  { key: "por_contactar", label: "Por contactar" },
  { key: "calificado", label: "Calificado" },
  { key: "visita_programada", label: "Visita programada" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "ganado", label: "Ganado" },
  { key: "perdido", label: "Perdido" },
] as const;
export type PipelineKey = (typeof PIPELINE)[number]["key"];
export const PIPELINE_KEYS = PIPELINE.map((p) => p.key) as PipelineKey[];
export const pipelineLabel = (k: string) => PIPELINE.find((p) => p.key === k)?.label ?? k;

export const TEMPERATURES = [
  { key: "caliente", label: "Caliente" },
  { key: "tibio", label: "Tibio" },
  { key: "frio", label: "Frío" },
] as const;
export type Temperature = (typeof TEMPERATURES)[number]["key"];
export const temperatureLabel = (k: string) => TEMPERATURES.find((t) => t.key === k)?.label ?? k;

export const INTENT_LABELS: Record<string, string> = { buy: "Compra", rent: "Alquiler", sell: "Venta", other: "Otra" };

/**
 * Qualification rules (explicit, editable). Points add up; thresholds decide the level.
 * The result is an estimate for organising follow-ups, shown with its reasons.
 */
export const QUALIFICATION = {
  hotMin: 6,
  warmMin: 3,
  points: {
    actionRequest: 3, // wants to visit, reserve, make an offer, negotiate or talk to Elvyn
    timelineShort: 2, // within 3 months
    timelineMedium: 1, // 3 to 12 months
    precise: 2, // type + zone + budget known
    partlyPrecise: 1, // two of the three
    paymentDeclared: 1, // cash / bank / instalments declared
    specificProperty: 1, // asked about a concrete listing
    seller: 2, // owner ready to list a property
  },
} as const;

export const APPOINTMENT_STATUS = [
  { key: "solicitada", label: "Pendiente de confirmación" },
  { key: "confirmada", label: "Confirmada" },
  { key: "realizada", label: "Realizada" },
  { key: "no_asistio", label: "No asistió" },
  { key: "cancelada", label: "Cancelada" },
] as const;
export const appointmentLabel = (k: string) => APPOINTMENT_STATUS.find((s) => s.key === k)?.label ?? k;
