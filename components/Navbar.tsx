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
  const [xu, setXu]     = useState<number | null>(null)
  const [name, setName] = useState('')

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
      background: '#FFFFFF',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 58 }}>

        {/* Logo */}
        <Link href="/appraise" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
          <span style={{ fontSize: 18, color: 'var(--jade)', lineHeight: 1 }}>◈</span>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-serif)', letterSpacing: '.02em', color: 'var(--text)' }}>
            Ngọc <em style={{ fontStyle: 'italic', color: 'var(--jade)' }}>AI</em>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: '6px 14px', borderRadius: 8,
              fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500,
              color: pathname === l.href ? 'var(--jade-text)' : 'var(--text-2)',
              background: pathname === l.href ? 'var(--jade-light)' : 'transparent',
              transition: 'all .15s',
            }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {xu !== null && <XuBadge xu={xu} size="sm" />}
          <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{name}</span>
          <button onClick={logout} style={{
            background: 'var(--bg-3)',
            border: '1.5px solid #D1D5DB',
            color: 'var(--text-2)',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
