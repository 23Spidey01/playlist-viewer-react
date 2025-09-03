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
