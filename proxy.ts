import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/app", "/manage", "/mentor"];

/**
 * Refreshes Supabase session cookies and redirects signed-out visitors away
 * from private areas. This is an optimistic check only — every page, action
 * and route handler re-verifies the session and its database permissions.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  let signedIn = false;

  if (process.env.AUTH_PROVIDER === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: true });
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } else {
    signedIn = request.cookies.has("maps_dev_session");
  }

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/manage/:path*", "/mentor/:path*", "/sign-in", "/accept-invitation", "/reset-password", "/auth/:path*", "/api/files/:path*"],
};
