// app/payment/return/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Btn, Spinner } from '@/components/ui'

export default function PaymentReturnPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [pkg, setPkg]       = useState('')

  useEffect(() => {
    // VNPay trả về vnp_ResponseCode, MoMo trả về resultCode
    const vnpCode   = params.get('vnp_ResponseCode')
    const momoCode  = params.get('resultCode')
    const orderInfo = params.get('vnp_OrderInfo') || params.get('orderInfo') || ''

    const isSuccess = vnpCode === '00' || momoCode === '0'
    setStatus(isSuccess ? 'success' : 'fail')
    setPkg(orderInfo)

    if (isSuccess) {
      setTimeout(() => router.push('/appraise'), 4000)
    }
  }, [params, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {status === 'loading' && (
          <div className="fade-in">
            <Spinner size={40} />
            <p style={{ marginTop: 20, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Đang xác nhận thanh toán…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="fade-up">
            <div style={{ fontSize: 64, color: 'var(--jade)', marginBottom: 20, animation: 'pulse 2s ease infinite' }}>✓</div>
            <h2 style={{ fontSize: 30, fontWeight: 300, marginBottom: 10 }}>Thanh toán thành công!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.7 }}>
              Xu đã được cộng vào tài khoản của bạn.
            </p>
            {pkg && <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 24 }}>{pkg}</p>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <Link href="/appraise"><Btn variant="jade">◈ Định giá ngay</Btn></Link>
              <Link href="/dashboard"><Btn variant="ghost">Xem ví xu</Btn></Link>
            </div>
            <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Tự động chuyển hướng sau 4 giây…
            </p>
          </div>
        )}

        {status === 'fail' && (
          <div className="fade-up">
            <div style={{ fontSize: 64, color: '#f87171', marginBottom: 20 }}>✕</div>
            <h2 style={{ fontSize: 30, fontWeight: 300, marginBottom: 10 }}>Thanh toán thất bại</h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.7 }}>
              Giao dịch không thành công. Vui lòng thử lại hoặc chọn phương thức khác.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <Link href="/dashboard"><Btn variant="jade">Thử lại</Btn></Link>
              <Link href="/appraise"><Btn variant="ghost">Về trang chính</Btn></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
