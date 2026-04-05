import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthenticatedRedirectPath,
  getBlockedRouteRedirect,
  isAuthRoutePath,
  isProtectedRoutePath,
  isSetupRoutePath,
  isVerifyEmailPath,
  shouldRedirectUnverifiedUser,
} from "@/lib/supabase/route-access";

async function getAuthenticatedDestination(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<string> {
  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1);

  const membership = memberships?.[0];

  if (!membership) {
    return getAuthenticatedRedirectPath({
      hasMembership: false,
      isSetupComplete: false,
    });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("setup_completed, setup_completed_at")
    .eq("id", membership.tenant_id)
    .single();

  return getAuthenticatedRedirectPath({
    hasMembership: true,
    isSetupComplete: Boolean(
      tenant?.setup_completed || tenant?.setup_completed_at,
    ),
  });
}

export async function updateSession(request: NextRequest) {
  // Skip auth when Supabase is not configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // No Supabase configured - allow all requests through
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = isProtectedRoutePath(pathname);
  const isSetupRoute = isSetupRoutePath(pathname);
  const isAuthRoute = isAuthRoutePath(pathname);
  const isVerifyEmailRoute = isVerifyEmailPath(pathname);

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !user.email_confirmed_at &&
    shouldRedirectUnverifiedUser(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.search = "";

    if (user.email) {
      url.searchParams.set("email", user.email);
    }

    return NextResponse.redirect(url);
  }

  if (user && user.email_confirmed_at && (isAuthRoute || isVerifyEmailRoute)) {
    const destination = await getAuthenticatedDestination(supabase, user.id);
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isProtectedRoute && user && user.email_confirmed_at && !isSetupRoute) {
    const destination = await getAuthenticatedDestination(supabase, user.id);

    if (destination !== "/dashboard") {
      const url = request.nextUrl.clone();
      url.pathname = destination;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Server-side route lockdown: block non-essential pages before render
  if (isProtectedRoute && user) {
    const blockedRedirect = getBlockedRouteRedirect(pathname);
    if (blockedRedirect) {
      const url = request.nextUrl.clone();
      url.pathname = blockedRedirect;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
