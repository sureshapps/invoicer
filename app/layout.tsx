import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Define YEAR inside the component or as a constant outside if preferred
  const YEAR = new Date().getFullYear();

  return (
    // In Next.js App Router, the <html> and <body> tags are directly returned.
    // Metadata is handled by the `metadata` export, and global styles are imported.
    // Avoid explicit <head> tags and inline <style> blocks for global styles here.
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
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
