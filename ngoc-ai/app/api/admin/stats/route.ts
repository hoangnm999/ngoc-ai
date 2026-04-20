// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.rpc('is_admin', { p_user_id: user.id })
  return data ? user : null
}

export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: stats }, { data: daily }] = await Promise.all([
    admin.from('admin_stats').select('*').single(),
    admin.from('admin_revenue_daily').select('*'),
  ])

  return NextResponse.json({ stats, daily })
}
