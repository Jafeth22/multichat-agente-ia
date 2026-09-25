"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { isOwnerOrAdmin } from "@/lib/permissions";
import { sendEmail } from "@/lib/email/send-email";
import { listWorkspaceMembers } from "@/lib/members";

export async function inviteTeamMember(
  workspaceId: string,
  email: string,
  role: string
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (workspace.id !== workspaceId) {
    return { error: "Workspace mismatch" };
  }

  // Validate caller is owner or admin
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!isOwnerOrAdmin(membership?.role)) {
    return { error: "Solo Owner o Admin pueden invitar miembros" };
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { error: "A valid email address is required" };
  }

  const validRoles = ["member", "admin"];
  if (!validRoles.includes(role)) {
    return { error: "Invalid role. Must be member or admin." };
  }

  // Check if this email already belongs to an existing member (workspace_members
  // solo guarda user_id, asi que resolvemos el email via listWorkspaceMembers).
  const currentMembers = await listWorkspaceMembers(workspaceId);
  const alreadyMember = currentMembers.some(
    (m) => m.email.toLowerCase() === trimmedEmail
  );
  if (alreadyMember) {
    return { error: "Este correo ya es miembro del equipo" };
  }

  // Check if there's already a pending invite for this email
  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", trimmedEmail)
    .eq("status", "pending")
    .single();

  if (existingInvite) {
    return { error: "An invite for this email is already pending" };
  }

  const { data: invite, error: insertError } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: trimmedEmail,
      role,
      invited_by: user.id,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  // Email de invitacion (Resend, F7). Best-effort: si Resend no esta
  // configurado o falla, la invitacion ya quedo creada igual y se puede
  // compartir el link a mano; sendEmail ya registra el error en
  // email_logs y no lanza excepcion.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  const inviteUrl = `${appUrl}/invite/${invite.id}`;
  await sendEmail({
    supabase,
    workspaceId: workspace.id,
    to: trimmedEmail,
    subject: `Te invitaron a sumarte a ${workspace.name}`,
    html: `<p>Te invitaron a sumarte al equipo de <strong>${workspace.name}</strong>.</p><p><a href="${inviteUrl}">Aceptar invitacion</a></p><p>Este link vence en 7 dias.</p>`,
    template: "team_invite",
  });

  return { ok: true, invite };
}

export async function removeTeamMember(
  workspaceId: string,
  userId: string
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (workspace.id !== workspaceId) {
    return { error: "Workspace mismatch" };
  }

  // Validate caller is owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return { error: "Only workspace owners can remove members" };
  }

  // Can't remove yourself
  if (userId === user.id) {
    return { error: "You cannot remove yourself from the workspace" };
  }

  const { error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { ok: true };
}

export async function changeTeamMemberRole(
  workspaceId: string,
  userId: string,
  newRole: string
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (workspace.id !== workspaceId) {
    return { error: "Workspace mismatch" };
  }

  // Validate caller is owner or admin
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!isOwnerOrAdmin(membership?.role)) {
    return { error: "Solo Owner o Admin pueden cambiar roles" };
  }

  if (userId === user.id) {
    return { error: "No podes cambiar tu propio rol" };
  }

  const validRoles = ["member", "admin"];
  if (!validRoles.includes(newRole)) {
    return { error: "Rol invalido" };
  }

  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (target?.role === "owner") {
    return { error: "No se puede cambiar el rol del Owner" };
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { ok: true };
}

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Use service client to bypass RLS (the user is not a workspace member yet)
  const serviceClient = await createServiceClient();

  // Fetch the invite
  const { data: invite, error: fetchError } = await serviceClient
    .from("workspace_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return { error: "Invite not found" };
  }

  if (invite.status !== "pending") {
    return { error: "This invite is no longer valid" };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: "This invite has expired" };
  }

  // Verify the invite email matches the current user's email
  if (invite.email !== user.email) {
    return { error: "This invite was sent to a different email address" };
  }

  // Check if user is already a member
  const { data: existingMembership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (existingMembership) {
    // Ya es miembro (invite reconocida): recien confirmado esto se borra la invitacion.
    await serviceClient.from("workspace_invites").delete().eq("id", inviteId);

    return { ok: true, workspaceId: invite.workspace_id, alreadyMember: true };
  }

  // Insert into workspace_members (service client bypasses owner-only RLS)
  const { error: insertError } = await serviceClient
    .from("workspace_members")
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  // El alta se completo bien: recien ahi se borra la invitacion. Si el
  // insert hubiera fallado, la invitacion queda intacta para reintentar.
  await serviceClient.from("workspace_invites").delete().eq("id", inviteId);

  return { ok: true, workspaceId: invite.workspace_id };
}

export async function revokeInvite(inviteId: string) {
  const { user, supabase } = await getWorkspace();

  // Fetch the invite to get workspace_id
  const { data: invite, error: fetchError } = await supabase
    .from("workspace_invites")
    .select("workspace_id")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return { error: "Invite not found" };
  }

  // Validate caller is owner or admin
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!isOwnerOrAdmin(membership?.role)) {
    return { error: "Solo Owner o Admin pueden revocar invitaciones" };
  }

  const { error: deleteError } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { ok: true };
}
