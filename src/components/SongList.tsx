import React, { useEffect, useState } from "react";
import SongCard from "./SongCard";
import type { BSSongInfo } from "./types";

interface DetailedSong {
  song_cover: string;
  song_difficulty: string;
  song_id: string;
  song_name: string;
  song_plays: number;
  song_stars: number;
}

interface SongListProps {
  poolId: string;
}

const SongList: React.FC<SongListProps> = ({ poolId }) => {
  const [songs, setSongs] = useState<DetailedSong[]>([]);
  const [bsSongs, setBsSongs] = useState<BSSongInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [starRatingMap, setStarRatingMap] = useState<Record<string, Record<string, Record<string, number>>>>({});

  useEffect(() => {
    if (!poolId) return;
    setLoading(true);

    // Alle Songs aus ranked_list_detailed holen
    const fetchAllSongs = async () => {
      let page = 0;
      let allSongs: DetailedSong[] = [];
      while (true) {
        const res = await fetch(`http://localhost:3001/proxy/ranked_list_detailed/${poolId}/${page}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        allSongs = allSongs.concat(data);
        if (data.length < 30) break;
        page++;
      }
      setSongs(allSongs);
      setLoading(false);
    };

    fetchAllSongs();
  }, [poolId]);

  useEffect(() => {
    if (songs.length === 0) return;
    setStarRatingMap(buildStarRatingMap(songs));
    const hashes = Array.from(new Set(songs.map(song => song.song_id.split("_")[0].toLowerCase())));
    fetchBeatSaverSongs(hashes).then(setBsSongs);
  }, [songs]);

  // BeatSaver-Infos holen
  const fetchBeatSaverSongs = async (hashes: string[]) => {
    const CHUNK_SIZE = 50;
    const DELAY_MS = 250;
    const results: BSSongInfo[] = [];
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      const chunk = hashes.slice(i, i + CHUNK_SIZE);
      const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
      results.push(...songsArray);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    return results;
  };

  // Star-Rating-Map bauen
  const buildStarRatingMap = (songs: DetailedSong[]) => {
    const map: Record<string, Record<string, Record<string, number>>> = {};
    const diffMap: Record<string, string> = {
      ep: "ExpertPlus",
      ex: "Expert",
      h: "Hard",
      n: "Normal",
      e: "Easy",
    };
    const charMap: Record<string, string> = {
      s: "Standard",
      sll: "Lawless",
      l: "Lightshow",
      sna: "NoArrows",
      s360: "360Degree",
    };
    songs.forEach(song => {
      const parts = song.song_id.split("_");
      const hash = parts[0].toUpperCase();
      const diffShort = parts[1];
      const charShort = parts[2];
      const difficulty = diffMap[diffShort] || diffShort;
      const characteristic = charMap[charShort] || charShort;

      if (!map[hash]) map[hash] = {};
      if (!map[hash][characteristic]) map[hash][characteristic] = {};
      map[hash][characteristic][difficulty] = song.song_stars;
    });
    return map;
  };

  return (
    <div>
      {loading && <p className="text-cyan-400">Pool wird geladen...</p>}
      {/* Nur BeatSaver SongCards anzeigen */}
      {!loading && bsSongs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bsSongs.map((song) => (
            <SongCard
              key={song.versions?.[0]?.hash || song.id}
              song={song}
              starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            />
          ))}
        </div>
      )}
      {!loading && bsSongs.length === 0 && (
        <p className="text-orange-400">Keine Songs gefunden.</p>
      )}
    </div>
  );
};

export default SongList;