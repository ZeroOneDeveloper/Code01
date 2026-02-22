import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // No-op compatibility shim. Session validation is performed by page-level auth checks.
  if (!hasEnvVars) {
    return response;
  }

  return response;
}
