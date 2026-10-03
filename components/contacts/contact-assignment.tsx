"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { assignContact } from "@/lib/actions/contacts";
import type { WorkspaceMemberOption } from "@/lib/members";
import { SelectField } from "@/components/ui/select-field";

export function ContactAssignment({
  contactId,
  members,
  setterId,
  vendedorId,
  canManage,
}: {
  contactId: string;
  members: WorkspaceMemberOption[];
  setterId: string | null;
  vendedorId: string | null;
  canManage: boolean;
}) {
  const [setter, setSetter] = useState(setterId ?? "");
  const [vendedor, setVendedor] = useState(vendedorId ?? "");
  const [saving, setSaving] = useState<"setter" | "vendedor" | null>(null);

  function memberName(userId: string): string {
    return members.find((m) => m.userId === userId)?.name ?? "Sin asignar";
  }

  async function handleChange(field: "setter" | "vendedor", value: string) {
    setSaving(field);
    if (field === "setter") setSetter(value);
    else setVendedor(value);

    // Solo se manda la clave del campo que cambio: incluir la otra con
    // valor undefined igual la deja presente para el "in" del server
    // action (que la interpretaria como "poner en null") y borraria la
    // otra asignacion sin querer.
    await assignContact(
      contactId,
      field === "setter" ? { setterId: value || null } : { vendedorId: value || null }
    );
    setSaving(null);
  }

  if (!canManage) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Setter: </span>
          {setterId ? memberName(setterId) : "Sin asignar"}
        </p>
        <p>
          <span className="text-muted-foreground">Vendedor: </span>
          {vendedorId ? memberName(vendedorId) : "Sin asignar"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          Setter {saving === "setter" && <Loader2 className="h-3 w-3 animate-spin" />}
        </label>
        <SelectField
          value={setter}
          onChange={(v) => handleChange("setter", v)}
          className="w-full"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          Vendedor {saving === "vendedor" && <Loader2 className="h-3 w-3 animate-spin" />}
        </label>
        <SelectField
          value={vendedor}
          onChange={(v) => handleChange("vendedor", v)}
          className="w-full"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
}
