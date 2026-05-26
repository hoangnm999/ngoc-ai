// components/ui.tsx
'use client'
import { ReactNode, CSSProperties } from 'react'

/* ── Spinner ── */
export function Spinner({ size = 20, color = 'var(--jade)' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${color}33`,
      borderTopColor: color,
      borderRadius: '50%',
      flexShrink: 0,
    }} className="spin" />
  )
}

/* ── Button variants ── */
type BtnVariant = 'primary' | 'ghost' | 'danger' | 'jade'
export function Btn({
  children, onClick, disabled, variant = 'primary', fullWidth, style, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean
  variant?: BtnVariant; fullWidth?: boolean; style?: CSSProperties; type?: 'button'|'submit'
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 24px', borderRadius: 99,
    fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '.01em',
    transition: 'all .2s ease', width: fullWidth ? '100%' : undefined,
    opacity: disabled ? .45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    /* Primary: indigo sâu */
    primary: {
      background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
      color: '#fff',
      boxShadow: '0 2px 12px rgba(99,102,241,.25)',
    },
    /* Jade: màu ngọc chủ đạo — CTA chính */
    jade: {
      background: 'var(--jade)',
      color: '#fff',
      boxShadow: '0 2px 12px rgba(13,148,136,.25)',
    },
    /* Ghost: nền trắng viền xám */
    ghost: {
      background: 'var(--bg-2)',
      color: 'var(--text-2)',
      border: '1.5px solid #D1D5DB',
    },
    /* Danger */
    danger: {
      background: '#FEF2F2',
      color: '#DC2626',
      border: '1.5px solid #FECACA',
    },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

/* ── Card ── */
export function Card({ children, style, glow }: { children: ReactNode; style?: CSSProperties; glow?: 'jade'|'gold' }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: `1px solid ${
        glow === 'jade' ? 'rgba(13,148,136,.18)'
        : glow === 'gold' ? 'rgba(180,83,9,.15)'
        : 'var(--border)'
      }`,
      borderRadius: 'var(--radius)',
      boxShadow: glow === 'jade'
        ? '0 4px 24px rgba(13,148,136,.08)'
        : glow === 'gold'
        ? '0 4px 24px rgba(180,83,9,.07)'
        : '0 1px 3px rgba(0,0,0,.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Xu Badge ── */
export function XuBadge({ xu, size = 'md' }: { xu: number; size?: 'sm'|'md' }) {
  const sm = size === 'sm'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 6,
      background: 'var(--jade-light)',
      border: '1px solid rgba(13,148,136,.25)',
      borderRadius: 99,
      padding: sm ? '3px 10px' : '5px 14px',
      fontSize: sm ? 12 : 14,
      color: 'var(--jade-text)',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
    }}>
      ◈ <strong>{xu}</strong> xu
    </span>
  )
}

/* ── Section label ── */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase',
      color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 14,
      fontWeight: 500,
    }}>
      {children}
    </div>
  )
}

/* ── Score bar ── */
export function ScoreBar({ label, score, desc }: { label: string; score: number; desc?: string }) {
  const c = score >= 8 ? 'var(--jade)' : score >= 6 ? '#3B82F6' : score >= 4 ? 'var(--gold)' : 'var(--ruby)'
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: c, fontFamily: 'var(--font-mono)' }}>{score}<span style={{ color: 'var(--text-3)', fontSize: 11 }}>/10</span></span>
      </div>
      <div style={{ height: 4, background: '#E5E7EB', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${score * 10}%`,
          background: `linear-gradient(90deg, ${c}88, ${c})`,
          borderRadius: 99, transition: 'width 1.2s cubic-bezier(.16,1,.3,1)',
        }} />
      </div>
      {desc && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.5 }}>{desc}</div>}
    </div>
  )
}

/* ── Alert ── */
export function Alert({ type, children }: { type: 'warn'|'error'|'success'|'info'; children: ReactNode }) {
  const cfg = {
    warn:    { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', icon: '⚠' },
    error:   { bg: '#FEE2E2', border: '#FCA5A5', color: '#991B1B', icon: '✕' },
    success: { bg: '#ECFDF5', border: '#6EE7B7', color: '#065F46', icon: '✓' },
    info:    { bg: '#EFF6FF', border: '#93C5FD', color: '#1E40AF', icon: 'ℹ' },
  }[type]
  return (
    <div style={{
      padding: '13px 16px', borderRadius: 'var(--radius-sm)',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      display: 'flex', gap: 10, alignItems: 'flex-start',
      fontSize: 14, color: cfg.color, fontFamily: 'var(--font-sans)',
      lineHeight: 1.6,
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700, marginTop: 1 }}>{cfg.icon}</span>
      <span>{children}</span>
    </div>
  )
}

/* ── Divider ── */
export function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', fontWeight: 500 }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}
