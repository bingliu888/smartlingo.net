import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const withClerk = clerkMiddleware();

const PRIVATE_PAGE = /^\/(?:en|zh)\/(?:account|auth|classes|community|dashboard|members|messages|share)(?:\/|$)/;
const IDENTITY_API = /^\/api\/(?:auth\/clerk-session|classes|community|message-media|messages|platform|profile|referral-media|talent)(?:\/|$)/;

function isLocalRequest(request: NextRequest) {
  return request.nextUrl.hostname === "localhost"
    || request.nextUrl.hostname === "127.0.0.1"
    || request.nextUrl.hostname === "[::1]";
}

export default function proxy(request: NextRequest, event: unknown) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const identityRequired = PRIVATE_PAGE.test(request.nextUrl.pathname)
      || IDENTITY_API.test(request.nextUrl.pathname);
    if (!isLocalRequest(request) && identityRequired) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Identity service is not configured." },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
      return new NextResponse("SmartLingo identity service is temporarily unavailable.", {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }
    return NextResponse.next();
  }
  return withClerk(request, event as never);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
