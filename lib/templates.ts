/**
 * Interpolacion de variables de los templates de respuesta (F17).
 * Variables soportadas: {{contact.display_name}}, {{contact.email}},
 * {{contact.phone}}, {{workspace.name}}. Si el valor no existe, la
 * variable queda vacia (no error, no placeholder tipo "N/A").
 */

export interface TemplateInterpolationContext {
  contact: {
    display_name: string | null;
    email: string | null;
    phone: string | null;
  };
  workspace: {
    name: string;
  };
}

const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolvePath(ctx: TemplateInterpolationContext, path: string): string {
  const parts = path.split(".");
  let value: unknown = ctx;
  for (const part of parts) {
    if (value == null || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[part];
  }
  return value == null ? "" : String(value);
}

export function interpolateTemplate(content: string, ctx: TemplateInterpolationContext): string {
  return content.replace(VARIABLE_PATTERN, (_match, path: string) => resolvePath(ctx, path));
}
