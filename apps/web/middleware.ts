import { NextResponse, type NextRequest } from 'next/server';

// Lightweight middleware: gates routes by checking for the presence of a
// Supabase auth cookie. Full token verification happens in server components and
// API routes. Keeping it dependency-light keeps the edge bundle small.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  // Supabase stores session cookies as sb-<project-ref>-auth-token
  const isAuthenticated = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value.length > 0
  );

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/inbox', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|powersync).*)'],
};
