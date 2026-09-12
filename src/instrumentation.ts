/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs ONCE when the server starts.
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Attribution gate — refuses to boot without credit to the original author.
    // See COPYRIGHT.md for what this requires and why.
    const { assertAttribution } = await import("@/lib/attribution.server");
    assertAttribution();
  }
}
