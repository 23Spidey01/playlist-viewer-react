export type HBPlaylist = {
  playlistTitle: string;
  playlistAuthor: string;
  playlistDescription: string;
  image: string; // Base64-String
  songs: {
    hash: string;
    difficulties: {
      characteristic: string;
      name: string
    }[];
    hitbloq: {
      difficulties: {
        [characteristic: string]: {
          [difficultyName: string]: number
        };
      };
    };
  }[];
};

// BeatSaver Song Info Types
export interface BSSongInfo {
  id: string;
  name: string;
  description: string;
  uploader: BSUploader;
  metadata: BSMetaData;
  stats: BSStats;
  uploaded: string;
  automapper: boolean;
  ranked: boolean;
  qualified: boolean;
  versions: BSVersion[];
  createdAt: string;
  updatedAt: string;
  lastPublishedAt: string;
  bookmarked: boolean;
  declaredAi: string;
  blRanked: boolean;
  blQualified: boolean;
}

export interface BSUploader {
  id: number;
  name: string;
  avatar: string;
  type: string;
  admin: boolean;
  curator: boolean;
  seniorCurator: boolean;
  playlistUrl: string;
}

export interface BSMetaData {
  bpm: number;
  duration: number;
  songName: string;
  songSubName: string;
  songAuthorName: string;
  levelAuthorName: string;
}

export interface BSStats {
  plays: number;
  downloads: number;
  upvotes: number;
  downvotes: number;
  score: number;
}

export interface BSVersion {
  hash: string;
  state: string;
  createdAt: string;
  sageScore: number;
  diffs: BSDifficulty[];
  downloadURL: string;
  coverURL: string;
  previewURL: string;
}

export interface BSDifficulty {
  njs: number;
  offset: number;
  notes: number;
  bombs: number;
  obstacles: number;
  nps: number;
  length: number;
  characteristic: string;
  difficulty: string;
  events: number;
  chroma: boolean;
  me: boolean;
  ne: boolean;
  cinema: boolean;
  seconds: number;
  paritySummary: BSParitySummary;
  maxScore: number;
  label: string;
  environment: string;
}

export interface BSParitySummary {
  errors: number;
  warns: number;
  resets: number;
}

//Hitbloq translations
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
  sos: "OneSaber",
  sna: "NoArrows",
  s90: "90Degree",
  s360: "360Degree",
  sls: "Lightshow",
};

export interface DetailedSong {
  song_cover: string;
  song_difficulty: string;
  song_id: string;
  song_name?: string;
  song_plays?: number;
  song_stars?: number;
}

// Difficulty-Colors for Tailwind
export const diffColors: Record<string, string> = {
  Easy: "bg-green-600/60 text-green-100",
  Normal: "bg-blue-600/60 text-blue-100",
  Hard: "bg-yellow-600/60 text-yellow-100",
  Expert: "bg-orange-600/60 text-orange-100",
  ExpertPlus: "bg-red-600/60 text-red-100",
};

// Labels for Characteristics
export const characteristicLabels: Record<string, string> = {
  Standard: "Standard",
  Lawless: "Lawless",
  Lightshow: "Lightshow",
  NoArrows: "No Arrows",
  "360Degree": "360°",
};

// Icon-Imports for Characteristics
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
export interface SongPoolCache {
  [poolId: string]: {
    songs: DetailedSong[];
    bsSongs: BSSongInfo[];
    starRatingMap: Record<string, Record<string, Record<string, number>>>; // 3 Ebenen!
  };
}
