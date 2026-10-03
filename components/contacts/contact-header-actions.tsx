"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Link2, Trash2, Loader2, Ban } from "lucide-react";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { softDeleteContact, restoreContact, revertContactOptOut } from "@/lib/actions/contacts";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContactFormModal, type ContactFormValues } from "@/components/contacts/contact-form-modal";
import { LinkContactModal } from "@/components/contacts/link-contact-modal";

export function ContactHeaderActions({
  contact,
  role,
  doNotContact,
}: {
  contact: Omit<ContactFormValues, "display_name"> & { id: string; display_name: string | null };
  role: string | null;
  doNotContact: boolean;
}) {
  const router = useRouter();
  const canManage = isOwnerOrAdmin(role);

  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmRevertOptOut, setConfirmRevertOptOut] = useState(false);
  const [revertingOptOut, setRevertingOptOut] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await softDeleteContact(contact.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (result.error) return;
    const contactId = contact.id;
    const contactName = contact.display_name ?? "este contacto";
    router.push("/dashboard/contacts");
    toast(`Contacto "${contactName}" eliminado`, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => restoreContact(contactId),
      },
    });
  }

  async function handleRevertOptOut() {
    setRevertingOptOut(true);
    const result = await revertContactOptOut(contact.id);
    setRevertingOptOut(false);
    setConfirmRevertOptOut(false);
    if (!result.error) router.refresh();
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
          {doNotContact && (
            <button
              onClick={() => setConfirmRevertOptOut(true)}
              disabled={revertingOptOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {revertingOptOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Revertir &quot;no contactar&quot;
            </button>
          )}
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

      <ConfirmDialog
        open={confirmRevertOptOut}
        title="Revertir no contactar"
        message={`Seguro que queres sacarle la marca de "no contactar" a "${contact.display_name ?? "este contacto"}"? Las secuencias que se pausaron automaticamente no se reanudan solas.`}
        confirmLabel="Revertir"
        cancelLabel="Cancelar"
        onConfirm={handleRevertOptOut}
        onCancel={() => setConfirmRevertOptOut(false)}
      />
    </div>
  );
}
