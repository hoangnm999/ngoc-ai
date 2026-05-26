// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ngọc AI — Nhận diện ngọc & đá quý',
  description: 'Hệ thống nhận diện ngọc bích, ruby, sapphire bằng trí tuệ nhân tạo — 2 AI phân tích song song',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/*
        Font được load qua @import trong globals.css (Cormorant + Inter + DM Mono).
        Không cần next/font vì đã có Google Fonts import trực tiếp.
      */}
      <body>{children}</body>
    </html>
  )
}
