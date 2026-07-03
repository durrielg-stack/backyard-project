'use server'
import { getAdminClient } from '@/lib/supabase-admin'

// ── Server-side caller verification ───────────────────────────────────────────
// Server actions are POST endpoints; never trust a client-supplied actor id or
// role. Resolve the caller from their Supabase access token and check the role
// stored in the DB before doing anything privileged.

async function resolveCaller(
  accessToken: string
): Promise<{ id: string; role: string } | { error: string }> {
  if (!accessToken) return { error: 'Not authenticated.' }
  const sb = getAdminClient()
  const { data: { user }, error } = await sb.auth.getUser(accessToken)
  if (error || !user) return { error: 'Not authenticated.' }
  const { data: row } = await sb
    .from('users')
    .select('role, account_status')
    .eq('id', user.id)
    .single()
  if (!row || row.account_status !== 'active') return { error: 'Not authorized.' }
  return { id: user.id, role: row.role as string }
}

async function requireOwner(
  accessToken: string
): Promise<{ id: string } | { error: string }> {
  const caller = await resolveCaller(accessToken)
  if ('error' in caller) return caller
  if (caller.role !== 'owner') return { error: 'Not authorized.' }
  return { id: caller.id }
}

// ── Owner-only: create a user ─────────────────────────────────────────────────
export async function addUser(
  accessToken: string,
  name: string,
  role: string,
  password: string
): Promise<{ error?: string }> {
  const caller = await requireOwner(accessToken)
  if ('error' in caller) return { error: caller.error }

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
    actor_id: caller.id,
    event: 'user_created',
    detail: { name, role },
  })

  return {}
}

// ── Owner-only: activate / disable a user ─────────────────────────────────────
export async function setUserStatus(
  accessToken: string,
  userId: string,
  status: 'active' | 'disabled'
): Promise<{ error?: string }> {
  const caller = await requireOwner(accessToken)
  if ('error' in caller) return { error: caller.error }

  const sb = getAdminClient()
  const { error } = await sb.from('users').update({ account_status: status }).eq('id', userId)
  if (error) return { error: error.message }

  await sb.from('audit_logs').insert({
    user_id: userId,
    actor_id: caller.id,
    event: status === 'disabled' ? 'user_deactivated' : 'user_activated',
  })
  return {}
}

// ── Owner-only: reset another user's password ─────────────────────────────────
export async function resetOtherUserPassword(
  accessToken: string,
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  const caller = await requireOwner(accessToken)
  if ('error' in caller) return { error: caller.error }

  const sb = getAdminClient()
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: error.message }

  await sb.from('audit_logs').insert({
    user_id: userId,
    actor_id: caller.id,
    event: 'password_reset_by_admin',
  })
  return {}
}

// ── Any authenticated caller: log an audit event about themselves ─────────────
export async function logAudit(
  accessToken: string,
  event: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const caller = await resolveCaller(accessToken)
  if ('error' in caller) return

  const sb = getAdminClient()
  await sb.from('audit_logs').insert({
    user_id: caller.id,
    actor_id: caller.id,
    event,
    detail: detail ?? null,
  })
}
