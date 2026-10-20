// usePlaylistImport.ts — the "IMPORT PLAYLIST" tab's whole flow: a
// dropped/browsed .bplist/.json file, or a beatsaver.com/playlists/<id>
// link (handed off from useBeatSaverSearch when one gets pasted into
// the search box instead). Split out of RankNewMaps.tsx alongside
// useBeatSaverSearch and useRankQueue.
import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { BSSongInfo } from "./beatSaverTypes";
import { dedupeById, parsePlaylistSongHashes } from "./beatSaverSearch";
import { fetchSongsByHashes } from "./beatsaverApi";

interface ImportedPlaylist {
  title: string;
  author: string;
  image: string | null;
  resolved: BSSongInfo[];
  unresolvedCount: number;
  // Hash (uppercase) -> "characteristic|difficulty" keys, matching
  // useRankQueue's own selection key format — the difficulties a
  // playlist entry actually lists, i.e. the ones BeatSaver highlights
  // when you pick that playlist there. See addSongFromPlaylist.
  diffsByHash: Record<string, string[]>;
}

// Loads a BeatSaver-hosted playlist (beatsaver.com/playlists/<id>) via
// the paginated /playlists/id/{id}/{page} API — NOT the site's
// "download" link (…/playlists/id/{id}/download), which is meant for
// a browser to navigate straight to as a file save and isn't set up
// for cross-origin fetch()/XHR the way the rest of api.beatsaver.com
// is, so it fails with an opaque "Failed to fetch" no matter what
// playlist you point it at. This endpoint already hands back full map
// objects per entry (not just hashes), so there's no extra
// fetchSongsByHashes round trip needed the way the file-upload path
// requires.
async function fetchBeatSaverPlaylistMaps(playlistId: string): Promise<{
  title: string;
  author: string;
  image: string | null;
  resolved: BSSongInfo[];
  diffsByHash: Record<string, string[]>;
}> {
  let title = "Imported playlist";
  let author = "";
  let image: string | null = null;
  const resolved: BSSongInfo[] = [];
  const diffsByHash: Record<string, Set<string>> = {};

  // Paged the same way BeatSaver's other listing endpoints are;
  // capped so a malformed/looping response can't hang forever.
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`https://api.beatsaver.com/playlists/id/${playlistId}/${page}`);
    if (!res.ok) {
      if (page === 0) throw new Error(`Couldn't load that BeatSaver playlist (${res.status}).`);
      break;
    }
    const data = await res.json();
    if (page === 0) {
      title = data?.playlist?.name || data?.playlist?.title || title;
      author = data?.playlist?.owner?.name || data?.playlist?.curator?.name || author;
      image = data?.playlist?.playlistImage || data?.playlist?.playlistImage512 || null;
    }
    const entries: unknown[] = Array.isArray(data?.maps) ? data.maps : [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const record = entry as Record<string, unknown>;
      const map = (record?.map ?? entry) as BSSongInfo;
      if (!map?.id) continue;
      resolved.push(map);

      // The playlist can highlight specific difficulties per song —
      // same idea as a .bplist file's own per-song `difficulties`
      // list (see parsePlaylistSongHashes) — carried over here too so
      // adding a song from this panel auto-selects the same ones.
      const hash = map.versions?.[0]?.hash?.toUpperCase();
      const diffs = record?.difficulties;
      if (hash && Array.isArray(diffs)) {
        for (const d of diffs) {
          const diffRecord = d as Record<string, unknown>;
          const characteristic = diffRecord?.characteristic;
          const name = diffRecord?.name ?? diffRecord?.difficulty;
          if (typeof characteristic === "string" && typeof name === "string") {
            (diffsByHash[hash] ??= new Set()).add(`${characteristic}|${name}`);
          }
        }
      }
    }
  }

  return {
    title,
    author,
    image,
    resolved: dedupeById(resolved),
    diffsByHash: Object.fromEntries(
      Object.entries(diffsByHash).map(([hash, keys]) => [hash, Array.from(keys)]),
    ),
  };
}

export function usePlaylistImport() {
  const playlistFileInputRef = useRef<HTMLInputElement>(null);
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [isDraggingPlaylist, setIsDraggingPlaylist] = useState(false);
  const [showOnlyNewFromPlaylist, setShowOnlyNewFromPlaylist] = useState(true);

  // Two independently-triggered, discrete actions (a file drop/browse,
  // or a beatsaver.com/playlists/<id> link pasted elsewhere) rather
  // than something reactive to a key — useMutation fits this better
  // than useQuery, and gives each its own loading/error state for free
  // instead of the hand-rolled playlistLoading/playlistError pair both
  // used to share.
  const fileMutation = useMutation({
    mutationFn: async (file: File): Promise<ImportedPlaylist> => {
      const parsed = parsePlaylistSongHashes(await file.text());
      if (parsed.hashes.length === 0) {
        throw new Error("This playlist doesn't have any songs in it.");
      }
      const { songs: resolvedSongs } = await fetchSongsByHashes(
        parsed.hashes.map((h) => h.toLowerCase()),
      );
      const resolved = dedupeById(resolvedSongs);
      return {
        title: parsed.title,
        author: parsed.author,
        image: parsed.image,
        resolved,
        unresolvedCount: parsed.hashes.length - resolved.length,
        diffsByHash: parsed.diffsByHash,
      };
    },
    onSuccess: setPlaylist,
  });

  // No shared mutationFn with fileMutation above — the JSON API used by
  // fetchBeatSaverPlaylistMaps already hands back full map objects, so
  // there's nothing left to resolve.
  const urlMutation = useMutation({
    mutationFn: async (playlistId: string): Promise<ImportedPlaylist> => {
      const data = await fetchBeatSaverPlaylistMaps(playlistId);
      return {
        title: data.title,
        author: data.author,
        image: data.image,
        resolved: data.resolved,
        unresolvedCount: 0,
        diffsByHash: data.diffsByHash,
      };
    },
    onSuccess: setPlaylist,
  });
  const { mutateAsync: runUrlMutation } = urlMutation;

  const handlePlaylistFile = async (file: File) => {
    setPlaylist(null);
    await fileMutation.mutateAsync(file).catch(() => {
      // Surfaced to the caller via fileMutation.error below instead.
    });
  };

  // Stabilized (useCallback) since useBeatSaverSearch calls this from
  // its own debounced search effect — needs a stable identity to be a
  // legitimate effect dependency instead of triggering the "missing
  // dependency" lint rule by way of just being suppressed. mutateAsync
  // itself is stable across renders, so this stays stable too.
  const handlePlaylistUrl = useCallback(
    async (playlistId: string) => {
      setPlaylist(null);
      await runUrlMutation(playlistId).catch(() => {
        // Surfaced to the caller via urlMutation.error below instead.
      });
    },
    [runUrlMutation],
  );

  const playlistLoading = fileMutation.isPending || urlMutation.isPending;
  const playlistErrorSource = fileMutation.error ?? urlMutation.error;
  const playlistError = playlistErrorSource
    ? playlistErrorSource instanceof Error
      ? playlistErrorSource.message
      : "Couldn't load that playlist."
    : null;

  return {
    playlistFileInputRef,
    playlistLoading,
    playlistError,
    playlist,
    setPlaylist,
    isDraggingPlaylist,
    setIsDraggingPlaylist,
    showOnlyNewFromPlaylist,
    setShowOnlyNewFromPlaylist,
    handlePlaylistFile,
    handlePlaylistUrl,
  };
}
