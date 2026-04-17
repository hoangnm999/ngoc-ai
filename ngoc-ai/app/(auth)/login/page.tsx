// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Btn, Alert, Divider } from '@/components/ui'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError('Vui lòng điền đầy đủ'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (err) { setError(err.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không đúng' : err.message); setLoading(false); return }
    router.push('/appraise')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="fade-up">
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 44, color: 'var(--jade)', marginBottom: 12, animation: 'pulse 3s ease infinite' }}>◈</div>
        <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: '-.01em', marginBottom: 6 }}>
          Đăng nhập
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Ngọc AI · Định giá chuyên nghiệp
        </p>
      </div>

      {/* Form */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>MẬT KHẨU</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <Btn variant="jade" fullWidth onClick={handleLogin} disabled={loading}>
            {loading ? <>Đang đăng nhập…</> : 'Đăng nhập'}
          </Btn>
        </div>

        <Divider label="hoặc" />

        <button onClick={handleGoogle} style={{
          width: '100%', padding: '11px 16px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          color: 'var(--text-2)', fontSize: 13, fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Tiếp tục với Google
        </button>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        Chưa có tài khoản?{' '}
        <Link href="/register" style={{ color: 'var(--jade)' }}>Đăng ký — nhận 2 xu miễn phí</Link>
      </p>
    </div>
  )
}
