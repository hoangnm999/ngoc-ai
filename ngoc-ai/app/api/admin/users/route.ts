// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.rpc('is_admin', { p_user_id: user.id })
  return data ? user : null
}

// GET: danh sách users
export async function GET(req: NextRequest) {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page  = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('q') || ''

  const admin = createAdminClient()
  let query = admin.from('admin_users').select('*', { count: 'exact' })

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const { data, count } = await query
    .range((page - 1) * limit, page * limit - 1)

  return NextResponse.json({ users: data, total: count, page, limit })
}

// POST: thêm xu thủ công
export async function POST(req: NextRequest) {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId, amount, note } = await req.json()
  if (!userId || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: ok } = await admin.rpc('admin_add_xu', {
    p_admin_id: adminUser.id,
    p_user_id:  userId,
    p_amount:   amount,
    p_note:     note || 'Admin manual add',
  })

  if (!ok) return NextResponse.json({ error: 'Lỗi thêm xu' }, { status: 500 })
  return NextResponse.json({ success: true })
}
