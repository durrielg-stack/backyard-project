import type { Metadata } from 'next'
import { Oswald, Hanken_Grotesk } from 'next/font/google'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-oswald',
  display: 'swap',
})

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Backyard Project',
  description: 'Live table availability at The Backyard Project · bar + kitchen',
}

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${oswald.variable} ${hankenGrotesk.variable}`}>
      {children}
    </div>
  )
}
