import React, { useRef, useState } from "react";
import type { HBPlaylist } from "./types";

const FileUpload: React.FC<{ onLoad?: (playlist: HBPlaylist) => void }> = ({ onLoad }) => {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json") && !file.name.endsWith(".bplist")) {
      setError("Bitte eine gültige Playlist-Datei (.json oder .bplist) auswählen.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const playlist = JSON.parse(reader.result as string);
        onLoad?.(playlist);
        setError(null);
      } catch {
        setError("Fehler beim Laden der Datei.");
      }
    };

    reader.readAsText(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 mb-8 flex flex-col items-center shadow">
      <label className="block mb-4 text-neutral-200 font-semibold text-lg">
        Playlist-Datei auswählen
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.bplist"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="text-orange-400 text-sm mt-2">{error}</p>}
      <button
        type="button"
        className="mt-4 bg-cyan-500 text-white px-4 py-2 rounded-lg shadow hover:bg-cyan-600 transition font-semibold cursor-pointer"
        onClick={handleButtonClick}
      >
        Datei auswählen
      </button>
    </div>
  );
};

export default FileUpload;
