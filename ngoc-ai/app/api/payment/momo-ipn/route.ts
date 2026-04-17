// app/api/payment/momo-ipn/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyMoMoIPN } from '@/lib/momo'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // 1. Xác thực chữ ký HMAC-SHA256
  if (!verifyMoMoIPN(body)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  const { orderId, transId, resultCode } = body as Record<string, string | number>
  const admin = createAdminClient()

  if (Number(resultCode) === 0) {
    // Thanh toán thành công
    const { data: ok } = await admin.rpc('complete_payment', {
      p_transaction_id: orderId,
      p_payment_ref:    String(transId),
      p_payment_raw:    body,
    })
    if (!ok) return NextResponse.json({ message: 'Already processed' })
  } else {
    await admin.from('transactions').update({
      status:      'failed',
      payment_ref: String(transId),
      payment_raw: body,
      updated_at:  new Date().toISOString(),
    }).eq('id', orderId)
  }

  return NextResponse.json({ message: 'OK' })
}
