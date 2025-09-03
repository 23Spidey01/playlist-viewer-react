import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import type { HBPlaylist } from "./components/types";
import SongList from "./components/SongList";

const App: React.FC = () => {
  const [playlist, setPlaylist] = useState<HBPlaylist | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-extrabold mb-6 text-purple-700 drop-shadow">
          Beat Saber Playlist Viewer
        </h1>
        <FileUpload onLoad={setPlaylist} />
        {playlist && <SongList playlist={playlist} />}
      </div>
    </div>
  );
};

export default App;
