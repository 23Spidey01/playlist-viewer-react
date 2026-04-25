import { useContext } from "react";
import { SongPoolContext } from "./SongPoolContext";

export const useSongPoolCache = () => useContext(SongPoolContext);