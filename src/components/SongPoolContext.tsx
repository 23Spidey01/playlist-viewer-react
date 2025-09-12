import { createContext } from "react";
import type { SongPoolCache } from "./types";

export const SongPoolContext = createContext<{
  cache: SongPoolCache;
  setCache: React.Dispatch<React.SetStateAction<SongPoolCache>>;
}>({ cache: {}, setCache: () => {} });