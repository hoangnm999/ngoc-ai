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
      const { data } = await supabase
        .from('profiles').select('xu, full_name').eq('id', user.id).single()
      if (data) {
        setXu(data.xu)
        setName(data.full_name || user.email?.split('@')[0] || '')
      }
    }
    load()

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
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', height: 62,
      }}>

        {/* Logo */}
        <Link href="/appraise" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 36 }}>
          <span style={{ fontSize: 20, color: 'var(--jade)', lineHeight: 1 }}>◈</span>
          <span style={{
            fontSize: 20, fontWeight: 700,
            fontFamily: 'var(--font-serif)',
            letterSpacing: '.01em', color: 'var(--text)',
          }}>
            Ngọc <em style={{ fontStyle: 'italic', color: 'var(--jade)' }}>AI</em>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {links.map(l => {
            const active = pathname === l.href
            return (
              <Link key={l.href} href={l.href} style={{
                padding: '7px 16px', borderRadius: 10,
                fontSize: 16, fontFamily: 'var(--font-sans)', fontWeight: 500,
                color: active ? 'var(--jade-text)' : 'var(--text-2)',
                background: active ? 'var(--jade-light)' : 'transparent',
                transition: 'all .15s',
              }}>
                {l.label}
              </Link>
            )
          })}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {xu !== null && <XuBadge xu={xu} size="sm" />}
          <span style={{
            fontSize: 14, color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)', fontWeight: 500,
            maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
          <button onClick={logout} style={{
            background: 'var(--bg-3)',
            border: '1.5px solid var(--border-2)',
            color: 'var(--text-2)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}>
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  )
}
