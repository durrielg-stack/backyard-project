import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TABLES_HOST = 'byp.theserverprojectph.cc'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''

  if (host === TABLES_HOST) {
    const url = req.nextUrl.clone()
    // Rewrite root and any sub-path to /tables so the page renders at /
    if (!url.pathname.startsWith('/tables') && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/api')) {
      url.pathname = '/tables' + (url.pathname === '/' ? '' : url.pathname)
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Exclude _next assets, API routes, and any path with a file extension (static files)
  matcher: ['/((?!_next/static|_next/image|api|.*\\..*).*)',],
}
