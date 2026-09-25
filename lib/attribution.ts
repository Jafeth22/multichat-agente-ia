/**
 * Atribucion de marketing por contacto (F10): first_click se graba una
 * sola vez y no se toca mas; last_click se pisa en cada interaccion
 * nueva que traiga datos de tracking.
 *
 * Hoy (Bloque 3) ni el webhook de Zernio (Instagram) ni el de Evolution
 * API (WhatsApp) mandan utm/fbclid/gclid en su payload, asi que en la
 * practica esto queda vacio hasta que exista una fuente real de esos
 * datos (por ejemplo, la importacion CSV del Bloque 4, o un formulario
 * de captura propio mas adelante). La logica queda lista para ese
 * momento.
 */

export interface AttributionClick {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  ad_id?: string;
  campaign_id?: string;
  adset_id?: string;
  referrer_url?: string;
  landing_page?: string;
  captured_at?: string;
}

export interface Attribution {
  first_click?: AttributionClick;
  last_click?: AttributionClick;
}

const CLICK_FIELDS: (keyof AttributionClick)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ad_id",
  "campaign_id",
  "adset_id",
  "referrer_url",
  "landing_page",
];

/**
 * Solo incluye los campos con valor (F10: "Solo se incluyen los campos
 * con valor"). Devuelve null si no vino ningun dato de tracking.
 */
export function buildAttributionClick(
  source: Partial<Record<keyof AttributionClick, string | null | undefined>>,
  capturedAt: string = new Date().toISOString()
): AttributionClick | null {
  const click: AttributionClick = {};
  for (const field of CLICK_FIELDS) {
    const value = source[field];
    if (value) click[field] = value;
  }

  if (Object.keys(click).length === 0) return null;

  click.captured_at = capturedAt;
  return click;
}

/**
 * Combina la atribucion actual del contacto con datos de tracking
 * nuevos. Si no hay datos nuevos, devuelve la atribucion sin cambios.
 */
export function applyAttribution(
  current: Attribution | null | undefined,
  incoming: Partial<Record<keyof AttributionClick, string | null | undefined>>,
  capturedAt?: string
): Attribution {
  const base: Attribution = { ...(current ?? {}) };
  const click = buildAttributionClick(incoming, capturedAt);

  if (!click) return base;

  return {
    first_click: base.first_click ?? click,
    last_click: click,
  };
}
