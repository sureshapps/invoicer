import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'i-Invoice',
  description: 'Invoice Generator App',
  generator: 'suresh.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Define YEAR inside the component or as a constant outside if preferred
  const YEAR = new Date().getFullYear();

  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        {children}
        {/* The footer is placed directly within the body after the children */}
        <small style={{ display: 'block', marginTop: '8rem', textAlign: 'center', paddingBottom: '2rem' }}>
          <time>{YEAR}</time> © Suresh KALEYANNAN
        </small>
      </body>
    </html>
  )
}
