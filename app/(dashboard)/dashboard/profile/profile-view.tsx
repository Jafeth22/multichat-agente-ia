"use client";

import { useState } from "react";
import { User, Mail, Building2, KeyRound, Check, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/components/ui/password-input";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface WorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function ProfileView({
  fullName,
  email,
  currentWorkspaceId,
  workspaces,
}: {
  fullName: string;
  email: string;
  currentWorkspaceId: string;
  workspaces: WorkspaceMembership[];
}) {
  const [name, setName] = useState(fullName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const sortedWorkspaces = [...workspaces].sort((a, b) =>
    a.id === currentWorkspaceId ? -1 : b.id === currentWorkspaceId ? 1 : 0
  );

  async function handleSaveName() {
    if (savingName || !name.trim()) return;
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });

    if (error) {
      setNameError(error.message);
    } else {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    }
    setSavingName(false);
  }

  async function handleChangePassword() {
    if (savingPassword) return;
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword.length < 6) {
      setPasswordError("La contrasena tiene que tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contrasenas no coinciden.");
      return;
    }

    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    }
    setSavingPassword(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu informacion personal. Los datos del workspace se manejan desde Settings.
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
          {/* Nombre */}
          <section>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Nombre</h2>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {nameError && (
                  <p className="mt-1.5 text-xs text-destructive">{nameError}</p>
                )}
                {nameSaved && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" />
                    Guardado
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName || !name.trim() || name.trim() === fullName}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingName ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </section>

          <hr className="border-border" />

          {/* Email */}
          <section>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Correo electronico</h2>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Por ahora el correo no se puede cambiar desde aca.
            </p>
            <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {email}
            </p>
          </section>

          <hr className="border-border" />

          {/* Mis workspaces */}
          <section>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Mis workspaces</h2>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Los workspaces a los que pertenecs y tu rol en cada uno.
            </p>
            <ul className="mt-3 space-y-2">
              {sortedWorkspaces.map((ws) => {
                const isCurrent = ws.id === currentWorkspaceId;
                const isOwner = ws.role === "owner";
                return (
                  <li
                    key={ws.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      isCurrent
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                  >
                    <span className="font-medium">{ws.name}</span>
                    <span className="flex items-center gap-2">
                      {!isOwner && (
                        <span className="text-xs text-muted-foreground">
                          {ROLE_LABELS[ws.role] ?? ws.role}
                        </span>
                      )}
                      {isOwner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Crown className="h-3 w-3" />
                          Dueño
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          <Check className="h-3 w-3" />
                          Actual
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <hr className="border-border" />

          {/* Cambiar contrasena */}
          <section>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Cambiar contrasena</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Nueva contrasena
                </label>
                <div className="mt-1.5">
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    placeholder="Minimo 6 caracteres"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Confirmar contrasena
                </label>
                <div className="mt-1.5">
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    placeholder="Repeti la contrasena"
                  />
                </div>
              </div>

              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}
              {passwordSaved && (
                <p className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  Contrasena actualizada
                </p>
              )}

              <button
                type="button"
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingPassword ? "Guardando..." : "Cambiar contrasena"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
