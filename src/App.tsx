import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import type { HBPlaylist } from "./components/types";
import SongList from "./components/SongList";

const App: React.FC = () => {
  const [playlist, setPlaylist] = useState<HBPlaylist | null>(null);

  return (
    <div className="min-h-screen bg-neutral-900 font-sans">
      <div className="w-full max-w-screen-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-cyan-400 text-center tracking-tight">
          Beat Saber Playlist Viewer
        </h1>
        <FileUpload onLoad={setPlaylist} />
        {playlist && <SongList playlist={playlist} />}
      </div>
    </div>
  );
};

export default App;