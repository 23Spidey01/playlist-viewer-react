import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMapDetail, fetchSongsByHashes } from "./beatsaverApi";
import type { BSSongInfo } from "./beatSaverTypes";

// A minimal-but-real-shaped MapDetail, built from an actual BeatSaver
// API response captured while debugging the bug these tests exist to
// catch (see fetchSongsByHashes's own comment, and the CHANGELOG/
// commit history around the "pool page goes blank" fix).
function fakeMapDetail(id: string, hash: string): BSSongInfo {
  return {
    id,
    name: `Song ${id}`,
    description: "",
    uploader: {
      id: 1,
      name: "uploader",
      avatar: "",
      type: "DISCORD",
      admin: false,
      curator: false,
      seniorCurator: false,
      playlistUrl: "",
    },
    metadata: {
      bpm: 120,
      duration: 180,
      songName: `Song ${id}`,
      songSubName: "",
      songAuthorName: "Author",
      levelAuthorName: "Mapper",
    },
    stats: { plays: 0, downloads: 0, upvotes: 0, downvotes: 0, score: 0 },
    uploaded: "2026-01-01T00:00:00Z",
    automapper: false,
    ranked: false,
    qualified: false,
    versions: [
      {
        hash,
        state: "Published",
        createdAt: "2026-01-01T00:00:00Z",
        sageScore: 0,
        diffs: [],
        downloadURL: "",
        coverURL: "",
        previewURL: "",
      },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lastPublishedAt: "2026-01-01T00:00:00Z",
    bookmarked: false,
    declaredAi: "None",
    blRanked: false,
    blQualified: false,
  };
}

describe("isMapDetail", () => {
  it("accepts a real MapDetail shape", () => {
    expect(isMapDetail(fakeMapDetail("abc12", "hash1"))).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a plain string (BeatSaver error payload field)", "too many requests"],
    ["an object missing id", { metadata: { songName: "x" } }],
    ["an object missing metadata", { id: "abc12" }],
    ["an object whose metadata has no songName", { id: "abc12", metadata: {} }],
  ])("rejects %s", (_label, value) => {
    expect(isMapDetail(value)).toBe(false);
  });
});

describe("fetchSongsByHashes", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves a multi-hash chunk from BeatSaver's {hash: MapDetail} dictionary shape", async () => {
    const mapA = fakeMapDetail("aaa", "hash-a");
    const mapB = fakeMapDetail("bbb", "hash-b");
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ "hash-a": mapA, "hash-b": mapB }), { status: 200 }),
    );

    const { songs, queryHashByEntry } = await fetchSongsByHashes(["hash-a", "hash-b"]);

    expect(songs.map((s) => s.id).sort()).toEqual(["aaa", "bbb"]);
    expect(queryHashByEntry.get(songs.find((s) => s.id === "aaa")!)).toBe("HASH-A");
  });

  // Regression test for the real production bug: a chunk of exactly
  // one hash makes BeatSaver return a bare MapDetail object with no
  // {hash: ...} wrapper at all. Before this was handled, that shape
  // was iterated with Object.entries() as if it WERE the dictionary,
  // pushing the map's own top-level fields (id, name, description,
  // uploader, ...) into the results as fake "songs" — which then
  // crashed every .metadata.songName access on render and
  // white-screened the whole pool page. See HitbloqSongCard /
  // SongList.tsx's fetchBeatSaverSongs history for the full story.
  it("resolves a single-hash chunk from BeatSaver's bare-MapDetail shape, not as a dictionary", async () => {
    const map = fakeMapDetail("solo", "only-hash");
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(map), { status: 200 }),
    );

    const { songs, queryHashByEntry } = await fetchSongsByHashes(["only-hash"]);

    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe("solo");
    expect(songs[0].metadata.songName).toBe("Song solo");
    expect(queryHashByEntry.get(songs[0])).toBe("ONLY-HASH");
  });

  it("retries a failing chunk with backoff and eventually succeeds", async () => {
    const map = fakeMapDetail("retried", "h1");
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(map), { status: 200 }));

    const { songs } = await fetchSongsByHashes(["h1"], { maxAttempts: 2 });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe("retried");
  });

  it("drops hashes whose chunk fails every retry, without throwing", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 500 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { songs } = await fetchSongsByHashes(["dead-hash"], { maxAttempts: 2 });

    expect(songs).toHaveLength(0);
  });

  it("skips a malformed entry inside an otherwise-valid dictionary response", async () => {
    const mapA = fakeMapDetail("good", "hash-a");
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ "hash-a": mapA, "hash-b": { not: "a map" } }),
        { status: 200 },
      ),
    );

    const { songs } = await fetchSongsByHashes(["hash-a", "hash-b"]);

    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe("good");
  });
});
