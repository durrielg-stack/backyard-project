import type { NextConfig } from 'next'

// ── Content Security Policy ───────────────────────────────────────────────────
// Shipped in Report-Only mode first: the browser reports violations but blocks
// nothing, so this cannot break the (all-inline-style) UI. Once the violation
// reports are clean, promote the header name to 'Content-Security-Policy'.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Next.js injects inline bootstrap scripts; Vercel Analytics loads same-origin
  "script-src 'self' 'unsafe-inline'",
  // App is 100% inline styles; Google Fonts stylesheet is remote
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // Supabase REST + realtime websockets, Vercel analytics beacon
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://vitals.vercel-insights.com",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options',        value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
  // Modest max-age to start (1 day); raise once confident, then add preload.
  { key: 'Strict-Transport-Security', value: 'max-age=86400' },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
