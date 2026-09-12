/**
 * src/lib/attribution.server.ts
 *
 * Server-only attribution enforcement. Never import this from a client
 * component — it uses `node:fs`. Client code should import AUTHOR from
 * `./attribution` instead.
 *
 * Two checks run once, when the server starts:
 *
 *   1. ACKNOWLEDGEMENT — ATTRIBUTION_ACK must be set to the author's profile.
 *   2. VISIBLE CREDIT  — the footer must still render that credit.
 *
 * The second check fails only on *positive evidence* that the credit was
 * removed. If it cannot inspect anything (an unusual deployment layout, a
 * standalone bundle, a read-only filesystem) it warns and lets the app start,
 * so a legitimate deployment is never broken by a check that simply could not
 * see the file.
 *
 * Removing these checks does not remove the ask — see COPYRIGHT.md.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AUTHOR, hasAttributionAck } from "./attribution";

export { AUTHOR, hasAttributionAck };

/** Source files that are expected to render the credit. */
const FOOTER_SOURCES = [
  join("src", "components", "shell", "Footer.tsx"),
  join("components", "shell", "Footer.tsx"),
];

/** A footer still wired to the credit references both of these. */
const SOURCE_MARKERS = ["AUTHOR.url", "AUTHOR.handle"] as const;

function creditInSource(root: string): boolean | null {
  for (const rel of FOOTER_SOURCES) {
    const full = join(root, rel);
    if (!existsSync(full)) continue;
    try {
      const src = readFileSync(full, "utf8");
      return SOURCE_MARKERS.every((m) => src.includes(m));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Runs at startup. Throws when the acknowledgement is missing, or when the
 * footer demonstrably no longer carries the credit.
 */
export function assertAttribution(): void {
  if (!hasAttributionAck()) {
    throw new Error(
      [
        "",
        "  This project is MIT licensed with one condition: visible credit to its author.",
        `  Built by ${AUTHOR.name} — ${AUTHOR.url}`,
        "",
        "  Set this in your environment to acknowledge it, and the app will start:",
        "",
        '    ATTRIBUTION_ACK="https://github.com/ys941"',
        "",
        "  Nothing is transmitted anywhere. See COPYRIGHT.md.",
        "",
      ].join("\n")
    );
  }

  const credit = creditInSource(process.cwd());
  if (credit === false) {
    throw new Error(
      [
        "",
        "  The footer credit has been removed.",
        `  Any deployment others can see must display: Built by ${AUTHOR.name} — ${AUTHOR.url}`,
        "",
        "  Restore the credit in the footer component and start again. See COPYRIGHT.md.",
        "",
      ].join("\n")
    );
  }

  if (credit === null) {
    console.warn(
      `[attribution] Could not verify the footer credit — keep it visible: ${AUTHOR.url}`
    );
  }
}
