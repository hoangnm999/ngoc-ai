// app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Btn, Alert } from '@/components/ui'

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError('Vui lòng điền đầy đủ'); return }
    if (form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return }
    if (form.password !== form.confirm) { setError('Mật khẩu xác nhận không khớp'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/appraise'), 2500)
  }

  if (done) return (
    <div className="fade-up" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 52, color: 'var(--jade)', marginBottom: 20 }}>✓</div>
      <h2 style={{ fontSize: 26, fontWeight: 300, marginBottom: 10 }}>Đăng ký thành công!</h2>
      <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Tài khoản của bạn đã được tạo với <strong style={{ color: 'var(--jade)' }}>2 xu miễn phí</strong>.<br />
        Đang chuyển hướng…
      </p>
    </div>
  )

  return (
    <div className="fade-up">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 44, color: 'var(--jade)', marginBottom: 12, animation: 'pulse 3s ease infinite' }}>◈</div>
        <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: '-.01em', marginBottom: 6 }}>Tạo tài khoản</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Nhận <strong style={{ color: 'var(--jade)' }}>2 xu</strong> miễn phí để định giá ngay
        </p>
      </div>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }}>
        {/* Free xu banner */}
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(94,234,212,.06)', border: '1px solid rgba(94,234,212,.15)', marginBottom: 20, fontSize: 12, color: 'var(--jade)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
          ✦ Tài khoản mới nhận ngay 2 xu = 1 lần định giá miễn phí
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'name',     label: 'HỌ VÀ TÊN',      type: 'text',     placeholder: 'Nguyễn Văn A' },
            { key: 'email',    label: 'EMAIL',            type: 'email',    placeholder: 'you@example.com' },
            { key: 'password', label: 'MẬT KHẨU',        type: 'password', placeholder: 'Tối thiểu 6 ký tự' },
            { key: 'confirm',  label: 'XÁC NHẬN MẬT KHẨU', type: 'password', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]} onChange={set(f.key)} />
            </div>
          ))}

          {error && <Alert type="error">{error}</Alert>}

          <Btn variant="jade" fullWidth onClick={handleRegister} disabled={loading}>
            {loading ? 'Đang tạo tài khoản…' : 'Đăng ký — nhận 2 xu miễn phí'}
          </Btn>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        Đã có tài khoản?{' '}
        <Link href="/login" style={{ color: 'var(--jade)' }}>Đăng nhập</Link>
      </p>
    </div>
  )
}
