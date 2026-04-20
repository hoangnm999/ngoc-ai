// app/error.tsx  — Global error boundary
'use client'
import { useEffect } from 'react'
import { Btn } from '@/components/ui'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 48, opacity: .3 }}>◈</div>
      <h2 style={{ fontSize: 24, fontWeight: 300 }}>Đã xảy ra lỗi</h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', maxWidth: 360 }}>
        {error.message || 'Lỗi không xác định. Vui lòng thử lại.'}
      </p>
      {error.digest && (
        <code style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          ID: {error.digest}
        </code>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="jade" onClick={reset}>Thử lại</Btn>
        <Btn variant="ghost" onClick={() => window.location.href = '/'}>Về trang chủ</Btn>
      </div>
    </div>
  )
}
