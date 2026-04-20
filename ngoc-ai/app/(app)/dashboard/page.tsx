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
  { id: 'basic',    label: 'Cơ bản',         price: 50000,  xu: 30,  turns: 15, badge: null,       color: '#5eead4' },
  { id: 'standard', label: 'Tiêu chuẩn',     price: 99000,  xu: 70,  turns: 35, badge: 'PHỔ BIẾN', color: '#60a5fa' },
  { id: 'pro',      label: 'Chuyên nghiệp',  price: 199000, xu: 160, turns: 80, badge: 'TỐT NHẤT', color: '#d4a853' },
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
        supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
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
      const endpoint = payMethod === 'vnpay' ? '/api/payment/vnpay-create' : '/api/payment/momo-create'
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Lỗi tạo thanh toán')
      // Redirect sang cổng thanh toán
      window.location.href = data.payUrl
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định')
      setPaying(false)
    }
  }

  const pkg = PACKAGES.find(p => p.id === selected)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px' }}>

      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 300, letterSpacing: '-.01em', marginBottom: 8 }}>
          Ví <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>xu</em>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {xu !== null ? <XuBadge xu={xu} /> : <Spinner size={16} />}
          {xu !== null && (
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              = {Math.floor(xu / 2)} lượt định giá còn lại
            </span>
          )}
        </div>
      </div>

      {/* Package selection */}
      <div className="fade-up-2">
        <Label>Chọn gói nạp xu</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {PACKAGES.map(pkg => (
            <div key={pkg.id} onClick={() => setSelected(pkg.id)} style={{
              borderRadius: 'var(--radius)', padding: '20px 18px', cursor: 'pointer', position: 'relative',
              border: `1.5px solid ${selected === pkg.id ? pkg.color : pkg.color + '22'}`,
              background: selected === pkg.id ? `${pkg.color}0a` : 'var(--bg-2)',
              transition: 'all .2s',
            }}>
              {pkg.badge && (
                <div style={{ position: 'absolute', top: -1, right: 14, background: pkg.color, color: '#000', fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: '0 0 6px 6px', letterSpacing: '.08em', fontFamily: 'var(--font-mono)' }}>
                  {pkg.badge}
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 600, color: pkg.color, marginBottom: 4 }}>{pkg.xu} xu</div>
              <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text)', marginBottom: 4 }}>{(pkg.price / 1000).toFixed(0)}k đ</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {pkg.turns} lượt · {Math.round(pkg.price / pkg.turns / 1000)}k/lần
              </div>
              {selected === pkg.id && (
                <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: pkg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 700 }}>✓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment method + checkout */}
      {selected && (
        <div className="fade-up">
          <Card style={{ padding: 24, marginBottom: 20 }}>
            <Label>Phương thức thanh toán</Label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {[
                { id: 'vnpay' as const, label: 'VNPay', color: '#e2384d', desc: 'ATM / QR / Thẻ quốc tế' },
                { id: 'momo'  as const, label: 'MoMo',  color: '#ae2070', desc: 'Ví MoMo / QR' },
              ].map(m => (
                <div key={m.id} onClick={() => setPayMethod(m.id)} style={{
                  flex: 1, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'center',
                  border: `1.5px solid ${payMethod === m.id ? m.color : m.color + '33'}`,
                  background: payMethod === m.id ? `${m.color}0f` : 'transparent',
                  transition: 'all .2s',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
                <span>Gói {pkg?.label}</span><span>{((pkg?.price ?? 0) / 1000).toFixed(0)}k đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                <span>Nhận được</span>
                <span style={{ color: 'var(--jade)', fontWeight: 600 }}>{pkg?.xu} xu ({pkg?.turns} lượt)</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                <span>Tổng</span><span>{((pkg?.price ?? 0) / 1000).toFixed(0)},000 đ</span>
              </div>
            </div>

            {error && <div style={{ marginBottom: 14 }}><Alert type="error">{error}</Alert></div>}

            <Btn variant="jade" fullWidth onClick={handlePay} disabled={paying}>
              {paying
                ? <><Spinner size={16} color="#020c0a" />Đang chuyển sang {payMethod === 'vnpay' ? 'VNPay' : 'MoMo'}…</>
                : `Thanh toán qua ${payMethod === 'vnpay' ? 'VNPay' : 'MoMo'} — ${((pkg?.price ?? 0) / 1000).toFixed(0)}k đ`}
            </Btn>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              🔒 Giao dịch được mã hóa SSL · Hoàn tiền nếu lỗi hệ thống
            </div>
          </Card>
        </div>
      )}

      {/* Transaction history */}
      {txs.length > 0 && (
        <div className="fade-up-3">
          <Label>Lịch sử nạp tiền</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txs.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                    Nạp {tx.xu_added} xu · {tx.payment_method.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{(tx.amount_vnd / 1000).toFixed(0)}k đ</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: tx.status === 'success' ? 'var(--jade)' : tx.status === 'pending' ? '#d4a853' : '#f87171' }}>
                    {tx.status === 'success' ? '✓ Thành công' : tx.status === 'pending' ? '⏳ Chờ xử lý' : '✕ Thất bại'}
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
