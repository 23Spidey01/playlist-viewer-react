// hitbloqTypes.ts — Hitbloq's own pool/ranking data shape and the
// short-code translations/presentation helpers built on top of it. See
// beatSaverTypes.ts for BeatSaver's own API shape (BSSongInfo etc.).
export interface DetailedSong {
  song_cover: string;
  song_difficulty: string;
  song_id: string;
  song_name?: string;
  song_plays?: number;
  song_stars?: number;
}

export interface PoolDetailed {
  id: string;
  title: string;
  image: string;
  short_description: string;
  author: string;
  player_count: number;
  popularity: number;
  banner_image?: string;
}

export interface LeaderEntry {
  rank: number;
  name: string;
  cr: number;
}

// Hitbloq translations
export const diffMap: Record<string, string> = {
  ep: "ExpertPlus",
  ex: "Expert",
  h: "Hard",
  n: "Normal",
  e: "Easy",
};
export const charMap: Record<string, string> = {
  s: "Standard",
  sll: "Lawless",
  // Hitbloq's actual OneSaber code is "s1s" — confirmed against live
  // ranked-list data (maps with only a OneSaber difficulty, no
  // Standard one, e.g. "Unholy"/"Cross Slash" in funny_haha_pauls).
  // "sos" never once appears in that data; kept mapped too in case
  // some other pool really does use it, but it looks like it was
  // simply the wrong guess for this code all along. Without "s1s"
  // mapped, a OneSaber ranked diff's characteristic fell back to the
  // raw "s1s" string, which never matches a real diff's characteristic
  // ("OneSaber") when SongCard looks up its star rating — so it just
  // silently rendered as unranked everywhere, in every pool.
  sos: "OneSaber",
  s1s: "OneSaber",
  sna: "NoArrows",
  s90: "90Degree",
  s360: "360Degree",
  sls: "Lightshow",
};

// Labels for Characteristics
export const characteristicLabels: Record<string, string> = {
  Standard: "Standard",
  Lawless: "Lawless",
  Lightshow: "Lightshow",
  NoArrows: "No Arrows",
  "360Degree": "360°",
};

// Icon imports for characteristics
import standardIcon from "../assets/Icons/standard.svg";
import onesaberIcon from "../assets/Icons/onesaber.svg";
import lawlessIcon from "../assets/Icons/lawless.svg";
import lightshowIcon from "../assets/Icons/lightshow.svg";
import noarrowsIcon from "../assets/Icons/noarrows.svg";
import threesixtydegreeIcon from "../assets/Icons/360degree.svg";
import ninetydegreeIcon from "../assets/Icons/90degree.svg";

export const characteristicIcons: Record<string, string> = {
  Standard: standardIcon,
  Lawless: lawlessIcon,
  OneSaber: onesaberIcon,
  NoArrows: noarrowsIcon,
  "90Degree": ninetydegreeIcon,
  "360Degree": threesixtydegreeIcon,
  Lightshow: lightshowIcon,
};
