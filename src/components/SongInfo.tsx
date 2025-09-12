import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import type { BSSongInfo, BSDifficulty } from "./types";
import { diffColors, characteristicLabels, characteristicIcons } from "./types";

// Hilfsfunktion: Sekunden in Minuten:Sekunden umwandeln
function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")} min`;
}

const SongInfo: React.FC = () => {
  // Song-ID aus der URL holen
  const { id } = useParams<{ id: string }>();
  // Router-State für Star-Ratings (wird von SongCard übergeben)
  const location = useLocation();
  const poolId = location.state?.poolId;
  const starRatings: Record<string, Record<string, number>> | undefined = location.state?.starRatings;

  // State für die Songdaten von BeatSaver
  const [song, setSong] = useState<BSSongInfo | null>(null);

  // Songdaten von BeatSaver laden, wenn ID sich ändert
  useEffect(() => {
    if (!id) return;
    fetch(`https://api.beatsaver.com/maps/id/${id}`)
      .then(res => res.json())
      .then(setSong);
  }, [id]);

  // Ladeanzeige, solange Songdaten noch nicht da sind
  if (!song) return <div className="text-cyan-300">Lade Songdaten...</div>;

  // Difficulties nach characteristic gruppieren (z.B. Standard, Lawless, ...)
  const difficulties: BSDifficulty[] = song.versions?.[0]?.diffs || [];
  const grouped: Record<string, BSDifficulty[]> = {};
  difficulties.forEach((diff) => {
    if (!grouped[diff.characteristic]) grouped[diff.characteristic] = [];
    grouped[diff.characteristic].push(diff);
  });

  return (
    <div className="max-w-8xl mx-auto p-6 bg-neutral-900 rounded-xl shadow text-neutral-100">
      {/* Zurück-Link */}
      <Link
        to={poolId ? `/pool/${poolId}` : "/"}
        className="text-cyan-400 hover:underline mb-4 inline-block"
      >
        ← Zurück
      </Link>
      {/* Song-Cover und Metadaten */}
      <div className="flex gap-6 mb-6">
        <img src={song.versions?.[0]?.coverURL} alt={song.metadata.songName} className="w-40 h-40 rounded-lg border border-neutral-700" />
        <div>
          <h2 className="text-4xl font-bold text-cyan-300 mb-2">{song.metadata.songName}</h2>
          <div className="text-neutral-400 mb-1 text-lg">von {song.metadata.songAuthorName}</div>
          <div className="text-neutral-500 text-base mb-2">Uploader: {song.uploader.name}</div>
          <div className="text-neutral-400 text-base">{song.description}</div>
        </div>
      </div>
      {/* Song-Statistiken */}
      <div className="mt-4 flex flex-wrap gap-8 text-lg">
        <div>BPM: <b>{song.metadata.bpm}</b></div>
        <div>Dauer: <b>{formatDuration(song.metadata.duration)}</b></div>
        <div>Upvotes: <b>{song.stats.upvotes}</b></div>
        <div>Downvotes: <b>{song.stats.downvotes}</b></div>
      </div>
      {/* Difficulties groß und mit Star-Rating und Detailinfos */}
      <div className="mt-8">
        <h3 className="text-2xl font-bold text-cyan-200 mb-4">Difficulties</h3>
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([characteristic, diffs]) => (
            <div key={characteristic} className="flex items-center gap-4">
              {/* Icon oder Label für die characteristic */}
              {characteristicIcons[characteristic] ? (
                <img
                  src={characteristicIcons[characteristic]}
                  alt={characteristicLabels[characteristic] || characteristic}
                  className="w-8 h-8 inline-block"
                />
              ) : (
                <span className="text-lg font-semibold text-cyan-400 min-w-[120px]">
                  {characteristicLabels[characteristic] || characteristic}
                </span>
              )}
              {/* Alle Difficulties dieser characteristic */}
              <div className="flex flex-wrap gap-3">
                {diffs.map((diff) => {
                  const star =
                    starRatings?.[characteristic]?.[diff.difficulty] ?? undefined;
                  return (
                    <span
                      key={`${characteristic}-${diff.difficulty}`}
                      className={`px-4 py-2 rounded-lg text-lg font-bold shadow backdrop-blur-sm flex flex-col items-start gap-1 ${
                        star !== undefined
                          ? "border border-yellow-400 bg-yellow-700/40 text-yellow-100"
                          : diffColors[diff.difficulty] ||
                            "bg-neutral-700/60 text-cyan-100"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {diff.difficulty}
                        {star !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-yellow-400 inline-block"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.967c.3.921-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.175 0l-3.38 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.967a1 1 0 00-.364-1.118L2.049 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                            </svg>
                            <span className="font-bold">
                              {star % 1 === 0 ? star : star.toString()}
                            </span>
                          </span>
                        )}
                      </span>
                      {/* Zusatzinfos direkt im Badge, kleiner und grau */}
                      <span className="text-xs text-neutral-300 font-normal">
                        NJS: <b>{diff.njs}</b> | Offset: <b>{diff.offset}</b> | Notes: <b>{diff.notes}</b> | Bombs: <b>{diff.bombs}</b> | Obstacles: <b>{diff.obstacles}</b> | Events: <b>{diff.events}</b>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SongInfo;