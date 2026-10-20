import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postToPool, fetchPoolRankedSongs } from "./hitbloqApi";
import type { DetailedSong } from "./hitbloqTypes";

describe("postToPool", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts JSON to /proxy/<path> and reports ok on a success body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), { status: 200 }),
    );

    const { ok, result } = await postToPool("unrank", { key: "k", pool: "p", song: "s" });

    expect(ok).toBe(true);
    expect(result).toEqual({ status: "success" });
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe("/proxy/unrank");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ key: "k", pool: "p", song: "s" });
  });

  // The backend proxy forwards Hitbloq's response body as-is with its
  // own HTTP 200, regardless of whether Hitbloq itself accepted the
  // request — a wrong API key still comes back as an HTTP-level
  // success with a JSON body like { status: "error", error: "..." }.
  // res.ok alone can't tell success from failure; only this matters.
  it("reports not-ok when the body's own status isn't \"success\", even on HTTP 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "error", error: "invalid key" }), { status: 200 }),
    );

    const { ok, result } = await postToPool("unrank", {});

    expect(ok).toBe(false);
    expect(result?.error).toBe("invalid key");
  });

  it("reports not-ok without throwing on a non-JSON error body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("<html>500</html>", { status: 500 }));

    const { ok, result } = await postToPool("unrank", {});

    expect(ok).toBe(false);
    expect(result).toBeNull();
  });
});

describe("fetchPoolRankedSongs", () => {
  const originalFetch = globalThis.fetch;
  const PAGE_SIZE = 30;

  const entry = (i: number): DetailedSong => ({
    song_cover: "",
    song_difficulty: "ExpertPlus",
    song_id: `HASH${i}_ep_s`,
    song_name: `Song ${i}`,
  });

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockPages(totalEntries: number) {
    vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const page = Number(url.split("/").pop());
      const start = page * PAGE_SIZE;
      const remaining = Math.max(0, totalEntries - start);
      const count = Math.min(PAGE_SIZE, remaining);
      const data = Array.from({ length: count }, (_, i) => entry(start + i));
      return new Response(JSON.stringify(data), { status: 200 });
    });
  }

  it("stops at the first short page and returns every entry up to it", async () => {
    mockPages(45); // page 0: 30 entries (full), page 1: 15 entries (short, stops here)

    const songs = await fetchPoolRankedSongs("some-pool");

    expect(songs).toHaveLength(45);
    expect(songs[0].song_id).toBe("HASH0_ep_s");
    expect(songs[44].song_id).toBe("HASH44_ep_s");
  });

  it("returns an empty list for a pool with zero ranked songs", async () => {
    mockPages(0);

    const songs = await fetchPoolRankedSongs("empty-pool");

    expect(songs).toEqual([]);
  });

  it("throws when Hitbloq returns an error status for a page", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchPoolRankedSongs("broken-pool")).rejects.toThrow(/500/);
  });
});
