// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ngọc AI — Định giá ngọc & đá quý',
  description: 'Hệ thống định giá ngọc bích, ruby, sapphire bằng trí tuệ nhân tạo — 3 AI phân tích song song',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
