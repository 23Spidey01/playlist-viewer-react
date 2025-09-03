export type HBPlaylist = {
  playlistTitle: string;
  playlistAuthor: string;
  playlistDescription: string;
  image: string; // Base64-String
  songs: {
    hash: string;
    difficulties: { characteristic: string; name: string }[];
    hitbloq: {
      difficulties: {
        [characteristic: string]: { [difficultyName: string]: number };
      };
    };
  }[];
};

export type BSSongInfo = {
  id: string;
  name: string;
  description: string;
  uploader: {
    id: number;
    name: string;
    avatar: string;
    playlistUrl: string;
  };
  metadata: {
    bpm: number;
    duration: number;
    songName: string;
    songSubName: string;
    songAuthorName: string;
    levelAuthorName: string;
  };
  stats: {
    plays: number;
    downloads: number;
    upvotes: number;
    downvotes: number;
    score: number;
  };
  uploaded: string;
  ranked: boolean;
  qualified: boolean;
  versions: any[];
};