// app/(app)/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Btn, Card, XuBadge, Label, Alert, Spinner } from '@/components/ui'

interface Transaction {
  id: string; amount_vnd: number; xu_added: number; package_id: string
  payment_method: string; status: string; created_at: string
}

const PACKAGES = [
  { id: 'basic',     label: 'Cơ bản',        price: 50000,  xu: 30,  turns: 15, badge: null,        color: '#0D9488' },
  { id: 'standard', label: 'Tiêu chuẩn',     price: 99000,  xu: 70,  turns: 35, badge: 'PHỔ BIẾN',  color: '#3B82F6' },
  { id: 'pro',      label: 'Chuyên nghiệp',  price: 199000, xu: 160, turns: 80, badge: 'TỐT NHẤT',  color: '#8B5CF6' },
]

export default function DashboardPage() {
  const supabase  = createClient()
  const [xu, setXu]               = useState<number | null>(null)
  const [txs, setTxs]             = useState<Transaction[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<'vnpay' | 'momo'>('vnpay')
  const [paying, setPaying]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: transactions }] = await Promise.all([
        supabase.from('profiles').select('xu').eq('id', user.id).single(),
        supabase.from('transactions').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(10),
      ])
      if (profile) setXu(profile.xu)
      if (transactions) setTxs(transactions)
    }
    load()
  }, [supabase])

  const handlePay = async () => {
    if (!selected) return
    setPaying(true); setError('')
    try {
      const endpoint = payMethod === 'vnpay'
        ? '/api/payment/vnpay-create'
        : '/api/payment/momo-create'
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Lỗi tạo thanh toán')
      window.location.href = data.payUrl
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định')
      setPaying(false)
    }
  }

  const pkg = PACKAGES.find(p => p.id === selected)

  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6) var(--space-16)' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 'var(--space-10)' }}>
        <h1 style={{ marginBottom: 12 }}>
          Ví <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>xu</em>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {xu !== null
            ? <XuBadge xu={xu} />
            : <Spinner size={20} />}
          {xu !== null && (
            <span style={{ fontSize: 16, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              = {Math.floor(xu / 2)} lượt nhận diện còn lại
            </span>
          )}
        </div>
      </div>

      {/* Package selection */}
      <div className="fade-up-2" style={{ marginBottom: 'var(--space-8)' }}>
        <Label>Chọn gói nạp xu</Label>
        <div className="pkg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {PACKAGES.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              style={{
                borderRadius: 'var(--radius)', padding: 'var(--space-6) var(--space-4)', cursor: 'pointer', position: 'relative',
                border: `2px solid ${selected === p.id ? p.color : 'var(--border)'}`,
                background: selected === p.id ? `${p.color}0d` : 'var(--bg-2)',
                transition: 'all .2s',
                boxShadow: selected === p.id
                  ? `0 4px 16px ${p.color}22`
                  : '0 1px 4px rgba(0,0,0,.04)',
              }}
            >
              {p.badge && (
                <div style={{
                  position: 'absolute', top: -1, right: 14,
                  background: p.color, color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: '0 0 8px 8px',
                  letterSpacing: '.08em', fontFamily: 'var(--font-mono)',
                }}>
                  {p.badge}
                </div>
              )}
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: p.color, marginBottom: 'var(--space-2)' }}>
                {p.xu} xu
              </div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--text)', marginBottom: 'var(--space-2)' }}>
                {(p.price / 1000).toFixed(0)}k đ
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {p.turns} lượt · {Math.round(p.price / p.turns / 1000)}k/lần
              </div>
              {selected === p.id && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 22, height: 22, borderRadius: '50%',
                  background: p.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>✓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment method + checkout */}
      {selected && (
        <div className="fade-up">
          <Card style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
            <Label>Phương thức thanh toán</Label>
            <div className="pay-grid" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
              {[
                { id: 'vnpay' as const, label: 'VNPay',  color: '#e2384d', desc: 'ATM / QR / Thẻ quốc tế' },
                { id: 'momo'  as const, label: 'MoMo',   color: '#ae2070', desc: 'Ví MoMo / QR' },
              ].map(m => (
                <div key={m.id} onClick={() => setPayMethod(m.id)} style={{
                  flex: 1, borderRadius: 12, padding: '16px 18px',
                  cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${payMethod === m.id ? m.color : 'var(--border)'}`,
                  background: payMethod === m.id ? `${m.color}0d` : 'transparent',
                  transition: 'all .2s',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              background: 'var(--bg-3)', borderRadius: 12,
              padding: '16px 18px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--text-2)', marginBottom: 8 }}>
                <span>Gói {pkg?.label}</span>
                <span>{((pkg?.price ?? 0) / 1000).toFixed(0)}k đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: 'var(--text-2)', marginBottom: 10 }}>
                <span>Nhận được</span>
                <span style={{ color: 'var(--jade)', fontWeight: 600 }}>
                  {pkg?.xu} xu ({pkg?.turns} lượt)
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)' }}>
                <span>Tổng</span>
                <span>{((pkg?.price ?? 0) / 1000).toFixed(0)},000 đ</span>
              </div>
            </div>

            {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

            <Btn variant="jade" fullWidth onClick={handlePay} disabled={paying}>
              {paying
                ? <><Spinner size={18} color="#fff" />Đang chuyển sang {payMethod === 'vnpay' ? 'VNPay' : 'MoMo'}…</>
                : `Thanh toán qua ${payMethod === 'vnpay' ? 'VNPay' : 'MoMo'} — ${((pkg?.price ?? 0) / 1000).toFixed(0)}k đ`}
            </Btn>
            <div style={{
              textAlign: 'center', marginTop: 12,
              fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              🔒 Giao dịch được mã hóa SSL · Hoàn tiền nếu lỗi hệ thống
            </div>
          </Card>
        </div>
      )}

      {/* Transaction history */}
      {txs.length > 0 && (
        <div className="fade-up-3">
          <Label>Lịch sử nạp tiền</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {txs.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--bg-2)', borderRadius: 12,
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 3, fontWeight: 500 }}>
                    Nạp {tx.xu_added} xu · {tx.payment_method.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                    {(tx.amount_vnd / 1000).toFixed(0)}k đ
                  </div>
                  <div style={{
                    fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500,
                    color: tx.status === 'success'
                      ? 'var(--jade)'
                      : tx.status === 'pending'
                      ? '#B45309'
                      : '#DC2626',
                  }}>
                    {tx.status === 'success' ? '✓ Thành công'
                      : tx.status === 'pending' ? '⏳ Chờ xử lý'
                      : '✕ Thất bại'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
