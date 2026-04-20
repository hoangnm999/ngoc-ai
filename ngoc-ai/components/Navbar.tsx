// components/Navbar.tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XuBadge } from './ui'

export default function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [xu, setXu]       = useState<number | null>(null)
  const [name, setName]   = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('xu, full_name').eq('id', user.id).single()
      if (data) { setXu(data.xu); setName(data.full_name || user.email?.split('@')[0] || '') }
    }
    load()

    // Realtime: cập nhật xu ngay khi DB thay đổi
    const channel = supabase
      .channel('profile-xu')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        setXu((payload.new as { xu: number }).xu)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/appraise',  label: 'Định giá' },
    { href: '/dashboard', label: 'Ví xu' },
    { href: '/history',   label: 'Lịch sử' },
  ]

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      background: 'rgba(6,8,16,.88)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 58 }}>
        {/* Logo */}
        <Link href="/appraise" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
          <span style={{ fontSize: 18, color: 'var(--jade)', lineHeight: 1 }}>◈</span>
          <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '.02em' }}>
            Ngọc <em style={{ fontStyle: 'italic', color: 'var(--jade)' }}>AI</em>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13,
              fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
              color: pathname === l.href ? 'var(--text)' : 'var(--text-3)',
              background: pathname === l.href ? 'var(--bg-3)' : 'transparent',
              transition: 'all .15s',
            }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {xu !== null && <XuBadge xu={xu} size="sm" />}
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{name}</span>
          <button onClick={logout} style={{
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text-3)', borderRadius: 8,
            padding: '5px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
          }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
