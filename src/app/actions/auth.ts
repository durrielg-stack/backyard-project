'use server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function addUser(
  name: string,
  role: string,
  password: string
): Promise<{ error?: string }> {
  const sb = getAdminClient()
  const email = `thebackyardprojectph+${name.toLowerCase().replace(/\s+/g, '')}@gmail.com`

  const { data, error: authErr } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr) return { error: authErr.message }

  const { error: userErr } = await sb.from('users').insert({
    id: data.user.id,
    name,
    role,
    account_status: 'active',
  })
  if (userErr) {
    await sb.auth.admin.deleteUser(data.user.id)
    return { error: userErr.message }
  }

  await sb.from('audit_logs').insert({
    user_id: data.user.id,
    actor_id: data.user.id,
    event: 'user_created',
    detail: { name, role },
  })

  return {}
}

export async function setUserStatus(
  userId: string,
  status: 'active' | 'disabled',
  actorId: string
): Promise<{ error?: string }> {
  const sb = getAdminClient()
  const { error } = await sb.from('users').update({ account_status: status }).eq('id', userId)
  if (error) return { error: error.message }

  await sb.from('audit_logs').insert({
    user_id: userId,
    actor_id: actorId,
    event: status === 'disabled' ? 'user_deactivated' : 'user_activated',
  })
  return {}
}

export async function resetOtherUserPassword(
  userId: string,
  newPassword: string,
  actorId: string
): Promise<{ error?: string }> {
  const sb = getAdminClient()
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: error.message }

  await sb.from('audit_logs').insert({
    user_id: userId,
    actor_id: actorId,
    event: 'password_reset_by_admin',
  })
  return {}
}

export async function logAudit(
  userId: string,
  event: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const sb = getAdminClient()
  await sb.from('audit_logs').insert({
    user_id: userId,
    actor_id: userId,
    event,
    detail: detail ?? null,
  })
}
