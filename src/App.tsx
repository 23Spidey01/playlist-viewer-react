import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import type { HBPlaylist } from "./components/types";
import SongList from "./components/SongList";

const App: React.FC = () => {
  const [playlist, setPlaylist] = useState<HBPlaylist | null>(null);

  return (
    <div className="App p-8">
      <h1 className="text-2xl font-bold mb-4">Playlist Upload</h1>
      <FileUpload onLoad={setPlaylist} />
      {playlist && <SongList playlist={playlist} />}
    </div>
  );
};

export default App;
