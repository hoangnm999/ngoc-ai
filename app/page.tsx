// app/page.tsx  — Public landing page
'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/* ── Animated counter ── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = Date.now()
      const dur = 1400
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(ease * to))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
  return (
    <div style={{
      padding: '28px 24px', borderRadius: 16,
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,.04)',
      transition: 'border-color .3s, transform .3s, box-shadow .3s',
      animation: `fadeUp .6s ${delay} both`,
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(13,148,136,.30)'
        el.style.transform = 'translateY(-4px)'
        el.style.boxShadow = '0 12px 32px rgba(13,148,136,.10)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,.04)'
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 16, display: 'block' }}>{icon}</div>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>{title}</h3>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.75, fontFamily: 'var(--font-sans)' }}>{desc}</p>
    </div>
  )
}

/* ── Pricing card ── */
function PricingCard({ xu, price, turns, badge, color, features }: {
  xu: number; price: number; turns: number; badge?: string; color: string; features: string[]
}) {
  return (
    <div style={{
      padding: '28px 24px', borderRadius: 18, position: 'relative',
      background: badge ? `${color}08` : 'var(--bg-2)',
      border: `1.5px solid ${badge ? color + '40' : 'var(--border)'}`,
      boxShadow: badge
        ? `0 8px 32px ${color}18`
        : '0 2px 8px rgba(0,0,0,.04)',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: color, color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 14px', borderRadius: 99, letterSpacing: '.1em',
          fontFamily: 'var(--font-mono)',
        }}>{badge}</div>
      )}
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 6 }}>{xu} xu</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {xu === 2 ? 'Miễn phí' : `${(price / 1000).toFixed(0)}k`}
        {xu !== 2 && <span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 400 }}> đ</span>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 22 }}>
        {turns} lượt · {xu === 2 ? 'miễn phí' : `${Math.round(price / turns / 1000)}k/lần`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
            <span style={{ color, fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
          </div>
        ))}
      </div>
      <Link href="/register">
        <button style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: badge ? color : 'transparent',
          border: `1.5px solid ${badge ? 'transparent' : color}`,
          color: badge ? '#fff' : color,
          fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 600,
          cursor: 'pointer', transition: 'all .2s',
        }}>
          Bắt đầu →
        </button>
      </Link>
    </div>
  )
}

/* ── Main ── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Top nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(253,251,247,.95)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'all .3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, color: 'var(--jade)' }}>◈</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text)' }}>
            Ngọc <em style={{ color: 'var(--jade)', fontStyle: 'italic' }}>AI</em>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login">
            <button style={{ padding: '7px 18px', borderRadius: 99, background: 'transparent', border: '1.5px solid var(--border-2)', color: 'var(--text-2)', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, cursor: 'pointer', transition: 'all .2s' }}>
              Đăng nhập
            </button>
          </Link>
          <Link href="/register">
            <button style={{ padding: '7px 18px', borderRadius: 99, background: 'var(--jade)', color: '#fff', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .2s' }}>
              Dùng miễn phí
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows — nhẹ hơn trên nền sáng */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(13,148,136,.07) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(180,83,9,.05) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        <div style={{ maxWidth: 780, textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: '.35em', color: 'var(--jade)', textTransform: 'uppercase', marginBottom: 20, fontFamily: 'var(--font-mono)', animation: 'fadeIn .8s .1s both' }}>
            ✦ Hệ thống định giá ngọc thông minh
          </div>

          <h1 style={{ fontSize: 'clamp(40px,7vw,80px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 24, animation: 'fadeUp .8s .2s both', color: 'var(--text)' }}>
            Nhận diện Ngọc & Đá quý<br />
            <em style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, var(--jade), #0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              bằng trí tuệ nhân tạo
            </em>
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px', fontFamily: 'var(--font-sans)', animation: 'fadeUp .8s .3s both' }}>
            2 AI phân tích song song — Claude Sonnet &amp; Claude Haiku.<br />
            Kết quả trong 10 giây thay vì chờ lab 3–7 ngày.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56, animation: 'fadeUp .8s .4s both' }}>
            <Link href="/register">
              <button style={{ padding: '14px 36px', borderRadius: 12, background: 'var(--jade)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 8px 24px rgba(13,148,136,.25)', fontFamily: 'var(--font-sans)', transition: 'all .2s' }}>
                ◈ Bắt đầu miễn phí — 2 xu
              </button>
            </Link>
            <Link href="#how-it-works">
              <button style={{ padding: '14px 28px', borderRadius: 12, background: 'transparent', border: '1.5px solid var(--border-2)', color: 'var(--text-2)', fontSize: 16, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500, transition: 'all .2s' }}>
                Xem cách hoạt động ↓
              </button>
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp .8s .5s both' }}>
            {[
              { n: 2,  s: ' AI',  label: 'Phân tích song song' },
              { n: 10, s: 's',    label: 'Thời gian kết quả' },
              { n: 85, s: '%',    label: 'Độ chính xác nhận diện' },
            ].map(({ n, s, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--jade)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                  <Counter to={n} suffix={s} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: '80px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-3)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14, textTransform: 'uppercase' }}>QUY TRÌNH</div>
            <h2 style={{ color: 'var(--text)' }}>Cách hoạt động</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, position: 'relative' }}>
            {[
              { n: '01', title: 'Upload ảnh', desc: 'Chụp 3–5 góc: tổng thể, cận cảnh, dưới ánh sáng. Tùy chọn thêm video.' },
              { n: '02', title: '2 AI phân tích', desc: 'Claude Sonnet phân tích chuyên sâu, Claude Haiku xác thực nhanh — xử lý song song trong ~10 giây.' },
              { n: '03', title: 'Tổng hợp kết quả', desc: 'Hệ thống tính đồng thuận loại đá, mức độ tự nhiên và độ tin cậy %.' },
              { n: '04', title: 'Nhận báo cáo', desc: 'Loại đá, đặc điểm, cảnh báo giả/xử lý hóa học và hướng dẫn kiểm định.' },
            ].map((s, i) => (
              <div key={s.n} style={{ padding: '32px 24px', position: 'relative' }}>
                {i < 3 && <div style={{ position: 'absolute', top: 48, right: 0, width: '50%', height: 1, background: 'linear-gradient(90deg, rgba(13,148,136,.3), transparent)', pointerEvents: 'none' }} />}
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--jade)', marginBottom: 14, letterSpacing: '.1em', fontWeight: 500 }}>{s.n}</div>
                <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>{s.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14, textTransform: 'uppercase' }}>TÍNH NĂNG</div>
            <h2 style={{ color: 'var(--text)' }}>Tại sao chọn Ngọc AI?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <FeatureCard delay=".1s"  icon="◈" title="2 AI độc lập"        desc="Claude Sonnet phân tích sâu, Haiku xác thực nhanh. Kết quả đồng thuận từ 2 góc nhìn khác nhau, giảm sai số." />
            <FeatureCard delay=".15s" icon="◎" title="Multi-image + Video" desc="Upload 5 ảnh nhiều góc và video. AI trích frames tự động, phân tích toàn diện hơn từ một ảnh đơn lẻ." />
            <FeatureCard delay=".2s"  icon="⊡" title="Phát hiện hàng giả"  desc="Nhận diện ngọc bích type B/C tẩm polymer, xử lý nhiệt, đá tổng hợp và các dấu hiệu can thiệp hóa học." />
            <FeatureCard delay=".25s" icon="✦" title="Tập trung thị trường VN" desc="Tối ưu cho Jade (Ngọc bích) — loại đá phổ biến nhất Việt Nam. Thông tin tham chiếu phù hợp thực tế." />
            <FeatureCard delay=".3s"  icon="◉" title="Bảo mật tuyệt đối"   desc="API keys ẩn hoàn toàn phía server. Ảnh không lưu lại. Giao dịch mã hóa SSL qua VNPay/MoMo." />
            <FeatureCard delay=".35s" icon="◐" title="Lịch sử nhận diện"   desc="Lưu toàn bộ lịch sử nhận diện. Xem lại loại đá, độ tin cậy, cảnh báo giả/thật từ 2 AI." />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-3)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, letterSpacing: '.3em', color: 'var(--jade)', fontFamily: 'var(--font-mono)', marginBottom: 14, textTransform: 'uppercase' }}>GIÁ CẢ</div>
            <h2 style={{ color: 'var(--text)', marginBottom: 14 }}>Mua xu, nhận diện thoải mái</h2>
            <p style={{ fontSize: 16, color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>
              Không thuê bao. Mỗi lần nhận diện tốn 2 xu (~2,000đ). Đăng ký nhận 2 xu miễn phí.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <PricingCard xu={2}   price={0}      turns={1}  color="#9C9890"
              features={['1 lần nhận diện', '2 AI phân tích', 'Kết quả đầy đủ', 'Hết là hết']} />
            <PricingCard xu={30}  price={50000}  turns={15} color="#0D9488"
              features={['15 lượt nhận diện', '2 AI song song', 'Lịch sử nhận diện', '~3,300đ/lần']} />
            <PricingCard xu={70}  price={99000}  turns={35} badge="PHỔ BIẾN" color="#3B82F6"
              features={['35 lượt nhận diện', '2 AI song song', 'Ưu tiên xử lý', '~2,800đ/lần']} />
            <PricingCard xu={160} price={199000} turns={80} badge="TỐT NHẤT" color="#8B5CF6"
              features={['80 lượt nhận diện', '2 AI song song', 'Ưu tiên cao nhất', '~2,500đ/lần']} />
          </div>

          <div style={{ marginTop: 32, padding: '16px 24px', borderRadius: 12, background: 'var(--jade-light)', border: '1px solid rgba(13,148,136,.2)', textAlign: 'center', fontSize: 15, color: 'var(--jade-text)', fontFamily: 'var(--font-sans)' }}>
            ✦ So sánh: Định giá lab chuyên nghiệp $50–200/viên · Ngọc AI ~2,500–3,300đ/lần (tiết kiệm 95%+)
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 24px 100px', borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-2)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 56, marginBottom: 24, animation: 'pulse 3s ease infinite', color: 'var(--jade)' }}>◈</div>
          <h2 style={{ color: 'var(--text)', marginBottom: 16 }}>
            Bắt đầu nhận diện ngay hôm nay
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-2)', fontFamily: 'var(--font-sans)', marginBottom: 36, lineHeight: 1.7 }}>
            Đăng ký miễn phí · Nhận 2 xu · Nhận diện ngay lần đầu
          </p>
          <Link href="/register">
            <button style={{
              padding: '16px 44px', borderRadius: 12,
              background: 'var(--jade)', color: '#fff',
              fontSize: 17, fontWeight: 700, cursor: 'pointer', border: 'none',
              boxShadow: '0 8px 28px rgba(13,148,136,.28)',
              fontFamily: 'var(--font-sans)',
              transition: 'all .2s',
            }}>
              ✦ Đăng ký miễn phí
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '24px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)' }}>
        © 2026 Ngọc AI · Kết quả mang tính tham khảo · Xác nhận với gemologist trước giao dịch lớn
      </footer>
    </div>
  )
}
