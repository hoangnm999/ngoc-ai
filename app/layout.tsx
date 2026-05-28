// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ngọc AI — Nhận diện ngọc & đá quý',
  description: 'Hệ thống nhận diện ngọc bích, ruby, sapphire bằng trí tuệ nhân tạo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Preconnect tối ưu load time — phải đặt trước @import trong globals.css */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
