// app/api/payment/momo-create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createMoMoPayment } from '@/lib/momo'

const PACKAGES: Record<string, { amountVnd: number; xuAdded: number }> = {
  basic:    { amountVnd: 50000,  xuAdded: 30  },
  standard: { amountVnd: 99000,  xuAdded: 70  },
  pro:      { amountVnd: 199000, xuAdded: 160 },
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { packageId } = await req.json()
  const pkg = PACKAGES[packageId]
  if (!pkg) return NextResponse.json({ error: 'Gói không hợp lệ' }, { status: 400 })

  const admin = createAdminClient()
  const { data: tx, error } = await admin.from('transactions').insert({
    user_id:        user.id,
    amount_vnd:     pkg.amountVnd,
    xu_added:       pkg.xuAdded,
    package_id:     packageId,
    payment_method: 'momo',
    status:         'pending',
  }).select().single()

  if (error || !tx) return NextResponse.json({ error: 'Lỗi tạo giao dịch' }, { status: 500 })

  const momoRes = await createMoMoPayment({
    amount:    pkg.amountVnd,
    orderInfo: `Nap ${pkg.xuAdded} xu - Ngoc AI`,
    orderId:   tx.id,
  })

  if (momoRes.resultCode !== 0) {
    return NextResponse.json({ error: momoRes.message }, { status: 400 })
  }

  return NextResponse.json({ payUrl: momoRes.payUrl, transactionId: tx.id })
}
