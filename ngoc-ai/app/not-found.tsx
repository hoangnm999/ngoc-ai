// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 72, fontWeight: 200, color: 'var(--text-3)', lineHeight: 1 }}>404</div>
      <h2 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-2)' }}>Trang không tồn tại</h2>
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        Đường dẫn bạn truy cập không hợp lệ hoặc đã bị xoá.
      </p>
      <Link href="/" style={{ marginTop: 8, padding: '10px 24px', borderRadius: 99, background: 'rgba(94,234,212,.1)', border: '1px solid rgba(94,234,212,.2)', color: 'var(--jade)', fontSize: 13, fontFamily: 'var(--font-mono)', display: 'inline-block' }}>
        ← Về trang chủ
      </Link>
    </div>
  )
}
