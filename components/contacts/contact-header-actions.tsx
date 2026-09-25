"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Link2, Trash2, Loader2 } from "lucide-react";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { softDeleteContact } from "@/lib/actions/contacts";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContactFormModal, type ContactFormValues } from "@/components/contacts/contact-form-modal";
import { LinkContactModal } from "@/components/contacts/link-contact-modal";

export function ContactHeaderActions({
  contact,
  role,
}: {
  contact: Omit<ContactFormValues, "display_name"> & { id: string; display_name: string | null };
  role: string | null;
}) {
  const router = useRouter();
  const canManage = isOwnerOrAdmin(role);

  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await softDeleteContact(contact.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (!result.error) router.push("/dashboard/contacts");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowEdit(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </button>

      {canManage && (
        <>
          <button
            onClick={() => setShowLink(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Link2 className="h-3.5 w-3.5" />
            Vincular con otro contacto
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Eliminar
          </button>
        </>
      )}

      {showEdit && (
        <ContactFormModal
          initialValues={{ ...contact, display_name: contact.display_name ?? "" }}
          onClose={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {showLink && (
        <LinkContactModal
          contactId={contact.id}
          contactName={contact.display_name ?? "este contacto"}
          onClose={() => setShowLink(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar contacto"
        message={`Seguro que queres eliminar a "${contact.display_name ?? "este contacto"}"? Se puede recuperar desde la base de datos durante 30 dias.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
