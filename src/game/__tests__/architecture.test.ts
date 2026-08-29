/**
 * The engine boundary. Roadmap Part II §H.4.
 *
 *   "The battle engine should not depend on React."
 *
 * This is the most valuable line in the project — it is what makes replays, the
 * headless AI, server-authoritative multiplayer and the balance sweep possible
 * later without a rewrite. A test guards it rather than a lint rule, because a
 * lint rule can be turned off in a config file without anyone noticing.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = join(process.cwd(), "src", "game");

const BANNED = [
  { module: "react", why: "the engine must run headless, in Node and on a server" },
  { module: "react-dom", why: "the engine must never touch the DOM" },
  { module: "zustand", why: "UI state must not leak into simulation state" },
];

/** Comments talk ABOUT banned APIs; only real code should fail these checks. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("engine boundary", () => {
  const files = walk(ENGINE_DIR);

  it("finds the engine sources", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(BANNED)("src/game/ never imports $module", ({ module, why }) => {
    const offenders = files.filter((file) => {
      const source = stripComments(readFileSync(file, "utf8"));
      const pattern = new RegExp(`from\s+["']${module}(/|["'])`);
      return pattern.test(source);
    });
    expect(offenders, `${offenders.join(", ")} — ${why}`).toEqual([]);
  });

  it("src/game/ never calls Math.random", () => {
    // Determinism depends on exactly one seeded stream (§B.8).
    const offenders = files.filter((file) => {
      if (file.includes("__tests__")) return false;
      return /Math\.random\s*\(/.test(stripComments(readFileSync(file, "utf8")));
    });
    expect(offenders).toEqual([]);
  });

  it("src/game/ never calls non-portable Math functions", () => {
    // sqrt/sin/cos/pow are NOT specified to agree across JS engines, so a
    // battle on a phone could diverge from the same battle on the server (§H.3).
    const offenders: string[] = [];
    for (const file of files) {
      if (file.includes("__tests__")) continue;
      const source = stripComments(readFileSync(file, "utf8"));
      if (/Math\.(sqrt|sin|cos|tan|pow|log|exp|atan2|cbrt|hypot)\s*\(/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
