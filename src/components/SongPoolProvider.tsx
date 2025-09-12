import React, { useState } from "react";
import { SongPoolContext } from "./SongPoolContext";
import type { SongPoolCache } from "./types";

export const SongPoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<SongPoolCache>({});
  return (
    <SongPoolContext.Provider value={{ cache, setCache }}>
      {children}
    </SongPoolContext.Provider>
  );
};