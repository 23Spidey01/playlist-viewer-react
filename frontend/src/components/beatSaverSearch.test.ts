import { describe, it, expect } from "vitest";
import {
  parseBeatSaverId,
  looksLikeIdOrLink,
  extractBeatSaverPlaylistId,
  dedupeById,
  parsePlaylistSongHashes,
  scoreSearchResult,
  rankByQuery,
} from "./beatSaverSearch";
import type { BSSongInfo } from "./beatSaverTypes";

function fakeSong(id: string, overrides: Partial<BSSongInfo["metadata"]> = {}): BSSongInfo {
  return {
    id,
    name: "",
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
      songName: "",
      songSubName: "",
      songAuthorName: "",
      levelAuthorName: "",
      ...overrides,
    },
    stats: { plays: 0, downloads: 0, upvotes: 0, downvotes: 0, score: 0 },
    uploaded: "2026-01-01T00:00:00Z",
    automapper: false,
    ranked: false,
    qualified: false,
    versions: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lastPublishedAt: "2026-01-01T00:00:00Z",
    bookmarked: false,
    declaredAi: "None",
    blRanked: false,
    blQualified: false,
  };
}

describe("parseBeatSaverId", () => {
  it("extracts the id from a full map URL", () => {
    expect(parseBeatSaverId("https://beatsaver.com/maps/1a2b3")).toBe("1a2b3");
  });

  it("returns a bare id unchanged", () => {
    expect(parseBeatSaverId("1a2b3")).toBe("1a2b3");
  });

  it("trims whitespace around a pasted id", () => {
    expect(parseBeatSaverId("  1a2b3  ")).toBe("1a2b3");
  });
});

describe("looksLikeIdOrLink", () => {
  it("accepts a beatsaver.com URL", () => {
    expect(looksLikeIdOrLink("https://beatsaver.com/maps/1a2b3")).toBe(true);
  });

  it("accepts a short hex id", () => {
    expect(looksLikeIdOrLink("1a2b3")).toBe(true);
  });

  it("rejects an ordinary search phrase", () => {
    expect(looksLikeIdOrLink("empty bed")).toBe(false);
  });

  it("rejects a hex-looking string longer than 8 characters", () => {
    expect(looksLikeIdOrLink("123456789abcdef")).toBe(false);
  });
});

describe("extractBeatSaverPlaylistId", () => {
  it("extracts the numeric id from a playlist link", () => {
    expect(extractBeatSaverPlaylistId("check out beatsaver.com/playlists/4821 nice")).toBe(
      "4821",
    );
  });

  it("returns null for text with no playlist link", () => {
    expect(extractBeatSaverPlaylistId("https://beatsaver.com/maps/1a2b3")).toBeNull();
  });
});

describe("dedupeById", () => {
  it("keeps only the first occurrence of each map id", () => {
    const a = fakeSong("1");
    const b = fakeSong("2");
    const aAgain = fakeSong("1");

    expect(dedupeById([a, b, aAgain])).toEqual([a, b]);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeById([])).toEqual([]);
  });
});

describe("parsePlaylistSongHashes", () => {
  it("parses a standard .bplist/.json playlist file", () => {
    const file = JSON.stringify({
      playlistTitle: "My Playlist",
      playlistAuthor: "Me",
      image: "base64,abcd",
      songs: [
        {
          hash: "aaaa1111",
          difficulties: [{ characteristic: "Standard", name: "ExpertPlus" }],
        },
        { hash: "bbbb2222", difficulties: [] },
      ],
    });

    const result = parsePlaylistSongHashes(file);

    expect(result.title).toBe("My Playlist");
    expect(result.author).toBe("Me");
    expect(result.image).toBe("data:image/png;base64,abcd");
    expect(result.hashes.sort()).toEqual(["AAAA1111", "BBBB2222"]);
    expect(result.diffsByHash["AAAA1111"]).toEqual(["Standard|ExpertPlus"]);
    expect(result.diffsByHash["BBBB2222"]).toBeUndefined();
  });

  it("falls back to default title/author when missing", () => {
    const file = JSON.stringify({ songs: [{ hash: "aaaa1111" }] });

    const result = parsePlaylistSongHashes(file);

    expect(result.title).toBe("Imported playlist");
    expect(result.author).toBe("");
  });

  it("skips entries with no hash instead of throwing", () => {
    const file = JSON.stringify({ songs: [{ foo: "bar" }, { hash: "aaaa1111" }] });

    expect(parsePlaylistSongHashes(file).hashes).toEqual(["AAAA1111"]);
  });

  it("leaves an image already in data: URI form untouched", () => {
    const file = JSON.stringify({ songs: [], image: "data:image/jpeg;base64,xyz" });

    expect(parsePlaylistSongHashes(file).image).toBe("data:image/jpeg;base64,xyz");
  });

  it("throws a readable error for a file with no songs list", () => {
    expect(() => parsePlaylistSongHashes(JSON.stringify({ notAPlaylist: true }))).toThrow(
      /doesn't look like a playlist file/,
    );
  });
});

describe("scoreSearchResult", () => {
  it("scores a song name match higher than a mapper name match", () => {
    const nameMatch = fakeSong("1", { songName: "Empty Bed" });
    const mapperMatch = fakeSong("2", { levelAuthorName: "Empty Bed" });
    const words = ["empty", "bed"];

    expect(scoreSearchResult(nameMatch, words)).toBeGreaterThan(
      scoreSearchResult(mapperMatch, words),
    );
  });

  it("rewards every query word matching in the same field over a partial match", () => {
    const fullMatch = fakeSong("1", { songName: "Empty Bed" });
    const partialMatch = fakeSong("2", { songName: "Empty House" });

    expect(scoreSearchResult(fullMatch, ["empty", "bed"])).toBeGreaterThan(
      scoreSearchResult(partialMatch, ["empty", "bed"]),
    );
  });

  it("scores zero when nothing matches", () => {
    const song = fakeSong("1", { songName: "Unrelated Title" });

    expect(scoreSearchResult(song, ["empty", "bed"])).toBe(0);
  });
});

describe("rankByQuery", () => {
  it("moves the song matching every query word to the front", () => {
    const target = fakeSong("target", { songName: "Empty Bed" });
    const decoy1 = fakeSong("decoy1", { songName: "Empty House" });
    const decoy2 = fakeSong("decoy2", { songName: "Made of Bed Frames" });

    const ranked = rankByQuery([decoy1, decoy2, target], "empty bed");

    expect(ranked[0].id).toBe("target");
  });

  it("preserves the original order for a blank query", () => {
    const a = fakeSong("a");
    const b = fakeSong("b");

    expect(rankByQuery([a, b], "")).toEqual([a, b]);
  });

  it("breaks score ties by original order (stable sort)", () => {
    const a = fakeSong("a", { songName: "Nothing matches" });
    const b = fakeSong("b", { songName: "Also nothing matches" });

    expect(rankByQuery([a, b], "unmatched")).toEqual([a, b]);
  });
});
