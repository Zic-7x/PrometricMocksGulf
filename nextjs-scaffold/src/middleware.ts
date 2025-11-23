// Simplified middleware - just pass through
// Auth checks are done client-side in components
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // No auth checks here - let client components handle it
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/exam/:path*',
  ],
}

