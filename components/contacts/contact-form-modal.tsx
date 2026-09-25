"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { getCountries } from "libphonenumber-js";
import { DateField, TimeField } from "@/components/ui/date-time-field";
import { createContact, updateContact, type ContactFormInput } from "@/lib/actions/contacts";
import type { LeadTemperature } from "@/lib/types/database";

const TEMPERATURE_OPTIONS: { value: LeadTemperature; label: string }[] = [
  { value: "cold", label: "Frio" },
  { value: "warm", label: "Tibio" },
  { value: "hot", label: "Caliente" },
];

/** Codigo ISO2 -> nombre en espanol, calculado una sola vez (no por render). */
const COUNTRY_OPTIONS: { code: string; name: string }[] = (() => {
  const regionNames = new Intl.DisplayNames(["es"], { type: "region" });
  return getCountries()
    .map((code) => ({ code, name: regionNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
})();

export interface ContactFormValues extends ContactFormInput {
  id?: string;
}

/** Separa un ISO en fecha y hora para dos inputs nativos (date + time). */
function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Combina fecha (input date) + hora opcional (input time) en un ISO. */
function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d.toISOString();
}

/**
 * Se monta solo mientras el modal esta abierto (el que llama hace
 * `{show && <ContactFormModal .../>}`): asi el estado arranca limpio en
 * cada apertura sin necesitar un effect que lo resetee.
 */
export function ContactFormModal({
  initialValues,
  onClose,
}: {
  initialValues?: ContactFormValues | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!initialValues?.id;

  const [values, setValues] = useState<ContactFormValues>(initialValues ?? { display_name: "" });
  const initialFollowup = useMemo(() => splitDateTime(initialValues?.next_followup_date), [initialValues]);
  const [followupDate, setFollowupDate] = useState(initialFollowup.date);
  const [followupTime, setFollowupTime] = useState(initialFollowup.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingContactId, setExistingContactId] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setExistingContactId(null);

    const payload: ContactFormInput = {
      display_name: values.display_name,
      email: values.email || null,
      secondary_email: values.secondary_email || null,
      phone: values.phone || null,
      whatsapp_phone: values.whatsapp_phone || null,
      country: values.country || null,
      instagram_username: values.instagram_username || null,
      tiktok_username: values.tiktok_username || null,
      youtube_channel_id: values.youtube_channel_id || null,
      linkedin_profile_url: values.linkedin_profile_url || null,
      twitter_username: values.twitter_username || null,
      facebook_id: values.facebook_id || null,
      lead_temperature: values.lead_temperature || null,
      next_followup_date: combineDateTime(followupDate, followupTime),
    };

    const result = isEdit
      ? await updateContact(initialValues!.id!, payload)
      : await createContact(payload);

    setSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
      const withDuplicate = result as { existingContactId?: string };
      if (withDuplicate.existingContactId) {
        setExistingContactId(withDuplicate.existingContactId);
      }
      return;
    }

    onClose();
    if (!isEdit && "contactId" in result && result.contactId) {
      router.push(`/dashboard/contacts/${result.contactId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">
            {isEdit ? "Editar contacto" : "Nuevo contacto"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Datos basicos
              </h4>
              <div className="space-y-2">
                <input
                  ref={firstFieldRef}
                  type="text"
                  placeholder="Nombre *"
                  required
                  value={values.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={values.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="email"
                    placeholder="Email secundario"
                    value={values.secondary_email ?? ""}
                    onChange={(e) => set("secondary_email", e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Telefono (+54...)"
                    value={values.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp (+54...)"
                    value={values.whatsapp_phone ?? ""}
                    onChange={(e) => set("whatsapp_phone", e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Pais</label>
                  <select
                    value={values.country ?? ""}
                    onChange={(e) => set("country", e.target.value || null)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sin definir</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Redes sociales
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Instagram (sin @)"
                  value={values.instagram_username ?? ""}
                  onChange={(e) => set("instagram_username", e.target.value.replace(/^@/, ""))}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="TikTok (sin @)"
                  value={values.tiktok_username ?? ""}
                  onChange={(e) => set("tiktok_username", e.target.value.replace(/^@/, ""))}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="X / Twitter (sin @)"
                  value={values.twitter_username ?? ""}
                  onChange={(e) => set("twitter_username", e.target.value.replace(/^@/, ""))}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="ID de Facebook"
                  value={values.facebook_id ?? ""}
                  onChange={(e) => set("facebook_id", e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="Canal de YouTube"
                  value={values.youtube_channel_id ?? ""}
                  onChange={(e) => set("youtube_channel_id", e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="Perfil de LinkedIn (URL)"
                  value={values.linkedin_profile_url ?? ""}
                  onChange={(e) => set("linkedin_profile_url", e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Seguimiento
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Temperatura</label>
                  <select
                    value={values.lead_temperature ?? ""}
                    onChange={(e) => set("lead_temperature", (e.target.value || null) as LeadTemperature | null)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sin temperatura</option>
                    {TEMPERATURE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DateField label="Proximo seguimiento" value={followupDate} onChange={setFollowupDate} />
                  <TimeField
                    label="Hora (opcional)"
                    value={followupTime}
                    onChange={setFollowupTime}
                    disabled={!followupDate}
                  />
                </div>
              </div>
            </section>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
              {existingContactId && (
                <>
                  {" "}
                  <a
                    href={`/dashboard/contacts/${existingContactId}`}
                    className="font-medium underline"
                  >
                    Ver contacto existente
                  </a>
                </>
              )}
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !values.display_name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear contacto"}
          </button>
        </div>
      </div>
    </div>
  );
}
