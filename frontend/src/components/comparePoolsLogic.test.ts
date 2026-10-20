import { describe, it, expect } from "vitest";
import { songKey } from "./comparePoolsLogic";
import type { DetailedSong } from "./hitbloqTypes";

function song(songId: string): DetailedSong {
  return { song_cover: "", song_difficulty: "ExpertPlus", song_id: songId };
}

describe("songKey", () => {
  it("treats the same hash/difficulty/characteristic as the same key", () => {
    expect(songKey(song("ABCD1234_ep_s"))).toBe(songKey(song("ABCD1234_ep_s")));
  });

  it("normalizes hash case, so a lowercase hash from one pool still matches", () => {
    expect(songKey(song("abcd1234_ep_s"))).toBe(songKey(song("ABCD1234_ep_s")));
  });

  it("treats a different difficulty on the same song as a different key", () => {
    expect(songKey(song("ABCD1234_ep_s"))).not.toBe(songKey(song("ABCD1234_ex_s")));
  });

  it("treats a different characteristic on the same song/difficulty as a different key", () => {
    expect(songKey(song("ABCD1234_ep_s"))).not.toBe(songKey(song("ABCD1234_ep_s1s")));
  });

  it("treats a different song entirely as a different key", () => {
    expect(songKey(song("ABCD1234_ep_s"))).not.toBe(songKey(song("DEADBEEF_ep_s")));
  });
});
