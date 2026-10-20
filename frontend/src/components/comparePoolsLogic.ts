// comparePoolsLogic.ts — the one correctness-critical piece of
// ComparePoolsPage.tsx's duplicate-detection, split into its own
// module for the same reason as beatSaverSearch.ts: a file that
// exports both a function and a React component breaks Vite's Fast
// Refresh (react-refresh/only-export-components), and a standalone
// function is what makes this unit-testable on its own. See
// comparePoolsLogic.test.ts.
import type { DetailedSong } from "./hitbloqTypes";

// Identity for "is this the same ranked difficulty" across two pools —
// hash normalized to uppercase (Hitbloq's own data is consistent about
// this, but cheap to guarantee), plus the raw difficulty/characteristic
// short codes exactly as ranked.
export function songKey(song: DetailedSong): string {
  const [hash, diffShort, charShort] = song.song_id.split("_");
  return `${hash.toUpperCase()}_${diffShort}_${charShort}`;
}
