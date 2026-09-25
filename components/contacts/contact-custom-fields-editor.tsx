"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { setContactCustomFieldValue } from "@/lib/actions/custom-fields";

interface CustomFieldDefinition {
  id: string;
  name: string;
  type: string;
}

function inputTypeFor(fieldType: string): string {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "url":
      return "url";
    case "email":
      return "email";
    default:
      return "text";
  }
}

function FieldInput({
  contactId,
  field,
  initialValue,
}: {
  contactId: string;
  field: CustomFieldDefinition;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function commit() {
    if (value === initialValue) return;
    setSaving(true);
    setSaved(false);
    const result = await setContactCustomFieldValue(contactId, field.id, value);
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => {
            const next = e.target.checked ? "true" : "false";
            setValue(next);
            setContactCustomFieldValue(contactId, field.id, next);
          }}
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-sm">{field.name}</span>
      </label>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{field.name}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={inputTypeFor(field.type)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {saved && <Check className="h-3.5 w-3.5 text-green-600" />}
      </div>
    </div>
  );
}

export function ContactCustomFieldsEditor({
  contactId,
  definitions,
  values,
}: {
  contactId: string;
  definitions: CustomFieldDefinition[];
  /** field_id -> value */
  values: Record<string, string>;
}) {
  if (definitions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/70">
        Este workspace todavia no definio custom fields
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {definitions.map((field) => (
        <FieldInput
          key={field.id}
          contactId={contactId}
          field={field}
          initialValue={values[field.id] ?? ""}
        />
      ))}
    </div>
  );
}
