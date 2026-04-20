// app/api/payment/vnpay-create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createVNPayUrl } from '@/lib/vnpay'

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

  // Tạo transaction record (pending)
  const admin = createAdminClient()
  const { data: tx, error } = await admin.from('transactions').insert({
    user_id:        user.id,
    amount_vnd:     pkg.amountVnd,
    xu_added:       pkg.xuAdded,
    package_id:     packageId,
    payment_method: 'vnpay',
    status:         'pending',
  }).select().single()

  if (error || !tx) return NextResponse.json({ error: 'Lỗi tạo giao dịch' }, { status: 500 })

  // Tạo URL redirect sang VNPay
  const ipAddr = req.headers.get('x-forwarded-for') || '127.0.0.1'
  const payUrl = createVNPayUrl({
    amount:    pkg.amountVnd,
    orderInfo: `Nap ${pkg.xuAdded} xu - Ngoc AI`,
    txnRef:    tx.id,
    ipAddr,
  })

  return NextResponse.json({ payUrl, transactionId: tx.id })
}
