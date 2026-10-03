import { describe, it, expect } from "vitest";
import { suggestColumnMapping, validateRow, type ColumnMapping } from "./csv-import";

describe("suggestColumnMapping", () => {
  it("maps common Spanish and English column names", () => {
    const mapping = suggestColumnMapping(["Nombre", "Email", "Telefono", "Pais"]);
    expect(mapping.display_name).toBe("Nombre");
    expect(mapping.email).toBe("Email");
    expect(mapping.phone).toBe("Telefono");
    expect(mapping.country).toBe("Pais");
  });

  it("leaves unmapped fields undefined when no header matches", () => {
    const mapping = suggestColumnMapping(["columna rara"]);
    expect(mapping.email).toBeUndefined();
    expect(mapping.phone).toBeUndefined();
  });
});

describe("validateRow", () => {
  const mapping: ColumnMapping = { display_name: "nombre", email: "email", phone: "telefono", country: "pais" };

  it("accepts a row with a valid email only", () => {
    const result = validateRow({ nombre: "Juan", email: "juan@ejemplo.com", telefono: "", pais: "" }, mapping, 2);
    expect(result.error).toBeNull();
    expect(result.row?.email).toBe("juan@ejemplo.com");
    expect(result.row?.phone).toBeNull();
  });

  it("accepts a row with a valid phone only, normalized to E.164", () => {
    const result = validateRow(
      { nombre: "Juan", email: "", telefono: "1122334455", pais: "AR" },
      mapping,
      2
    );
    expect(result.error).toBeNull();
    expect(result.row?.phone).toBe("+541122334455");
  });

  it("rejects a row with neither email nor phone", () => {
    const result = validateRow({ nombre: "Juan", email: "", telefono: "", pais: "" }, mapping, 5);
    expect(result.row).toBeNull();
    expect(result.error?.rowNumber).toBe(5);
    expect(result.error?.reason).toMatch(/email y telefono/i);
  });

  it("rejects an invalid email", () => {
    const result = validateRow({ nombre: "Juan", email: "no-es-un-email", telefono: "", pais: "" }, mapping, 3);
    expect(result.row).toBeNull();
    expect(result.error?.reason).toMatch(/email invalido/i);
  });

  it("rejects an invalid phone", () => {
    const result = validateRow({ nombre: "Juan", email: "", telefono: "123", pais: "" }, mapping, 4);
    expect(result.row).toBeNull();
    expect(result.error?.reason).toMatch(/telefono invalido/i);
  });
});
