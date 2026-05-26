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
        Fonts: Playfair Display (tiêu đề serif, hỗ trợ dấu tiếng Việt tốt)
               Inter (body sans-serif, tối ưu màn hình)
               DM Mono (số liệu, code)
        Đều được load qua @import trong globals.css.
      */}
      <body>{children}</body>
    </html>
  )
}
