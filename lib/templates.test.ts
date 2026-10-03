import { describe, it, expect } from "vitest";
import { interpolateTemplate } from "./templates";

describe("interpolateTemplate", () => {
  const ctx = {
    contact: { display_name: "Juan Perez", email: "juan@ejemplo.com", phone: "+5491122334455" },
    workspace: { name: "Mi Negocio" },
  };

  it("replaces all supported variables", () => {
    const result = interpolateTemplate(
      "Hola {{contact.display_name}}, gracias por escribirnos a {{workspace.name}}. Te contactamos a {{contact.email}} o {{contact.phone}}.",
      ctx
    );
    expect(result).toBe(
      "Hola Juan Perez, gracias por escribirnos a Mi Negocio. Te contactamos a juan@ejemplo.com o +5491122334455."
    );
  });

  it("leaves missing values empty instead of a placeholder (F17)", () => {
    const result = interpolateTemplate("Hola {{contact.display_name}}, tu email es {{contact.email}}", {
      contact: { display_name: null, email: null, phone: null },
      workspace: { name: "Mi Negocio" },
    });
    expect(result).toBe("Hola , tu email es ");
  });

  it("leaves unknown variables empty", () => {
    expect(interpolateTemplate("{{contact.unknown_field}}", ctx)).toBe("");
  });

  it("returns content unchanged when there are no variables", () => {
    expect(interpolateTemplate("Mensaje sin variables", ctx)).toBe("Mensaje sin variables");
  });
});
