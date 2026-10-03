"use server";

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { logAuditEvent, diffFields } from "@/lib/audit";

export async function switchWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Validate user has access to this workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!membership) return { error: "No access to this workspace" };

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true };
}

export async function createWorkspace(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: trimmed, slug })
    .select("id")
    .single();

  if (error || !workspace) {
    return { error: error?.message || "Failed to create workspace" };
  }

  // Add user as owner
  await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner",
  });

  // Switch to new workspace
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true, workspaceId: workspace.id };
}

/**
 * Guarda los campos generales del workspace (nombre, keywords globales,
 * frases de "no contactar" y, opcionalmente, la key de AI Gateway).
 * Server Action (antes esto se guardaba con un update directo desde el
 * cliente en settings-view.tsx, lo que impedia loguear el evento en
 * audit_log porque esa tabla solo acepta insert del service role).
 */
export async function updateWorkspaceSettings(input: {
  name: string;
  globalKeywords: string[];
  optoutPhrases: string[];
  aiApiKey?: string;
}) {
  const { workspace, user, role, supabase } = await getWorkspace();

  if (!isOwnerOrAdmin(role)) {
    return { error: "Solo Owner o Admin pueden editar la configuracion del workspace" };
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) return { error: "El nombre es obligatorio" };

  const update: Record<string, unknown> = {
    name: trimmedName,
    global_keywords: input.globalKeywords,
    optout_phrases: input.optoutPhrases,
  };
  if (input.aiApiKey?.trim()) {
    update.ai_api_key = input.aiApiKey.trim();
  }

  const { error } = await supabase.from("workspaces").update(update).eq("id", workspace.id);
  if (error) {
    console.error("[updateWorkspaceSettings] db error:", error);
    return { error: error.message };
  }

  const service = await createServiceClient();
  await logAuditEvent({
    supabase: service,
    workspaceId: workspace.id,
    entityType: "workspace_settings",
    entityId: null,
    action: "settings_updated",
    performedBy: user.id,
    changes: diffFields(
      { name: workspace.name, global_keywords: workspace.global_keywords, optout_phrases: workspace.optout_phrases },
      { name: trimmedName, global_keywords: input.globalKeywords, optout_phrases: input.optoutPhrases },
      ["name", "global_keywords", "optout_phrases"]
    ),
  });

  return { ok: true };
}
