// app/api/payment/vnpay-ipn/route.ts
// VNPay gọi endpoint này sau khi thanh toán xong (server-to-server)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyVNPayReturn, isVNPaySuccess } from '@/lib/vnpay'

export async function GET(req: NextRequest) {
  const query: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => { query[k] = v })

  // 1. Xác thực chữ ký — QUAN TRỌNG, không bỏ qua
  if (!verifyVNPayReturn(query)) {
    return NextResponse.json({ RspCode: '97', Message: 'Invalid signature' })
  }

  const txnRef   = query['vnp_TxnRef']
  const vnpRef   = query['vnp_TransactionNo']
  const success  = isVNPaySuccess(query)

  const admin = createAdminClient()

  if (success) {
    // 2. Cộng xu + cập nhật transaction (atomic)
    const { data: ok } = await admin.rpc('complete_payment', {
      p_transaction_id: txnRef,
      p_payment_ref:    vnpRef,
      p_payment_raw:    query,
    })

    if (!ok) {
      // Transaction không tồn tại hoặc đã xử lý rồi
      return NextResponse.json({ RspCode: '02', Message: 'Order already confirmed' })
    }
  } else {
    // Thanh toán thất bại — cập nhật status
    await admin.from('transactions').update({
      status:      'failed',
      payment_ref: vnpRef,
      payment_raw: query,
      updated_at:  new Date().toISOString(),
    }).eq('id', txnRef)
  }

  // VNPay yêu cầu response này
  return NextResponse.json({ RspCode: '00', Message: 'Confirm Success' })
}
