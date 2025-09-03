import React, { useState } from "react";
import type { HBPlaylist } from "./types";

const FileUpload: React.FC<{ onLoad?: (playlist: HBPlaylist) => void }> = ({ onLoad }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json") && !file.name.endsWith(".bplist")) {
      setError("Bitte eine JSON- oder BPLIST-Datei hochladen.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const playlist: HBPlaylist = JSON.parse(text); // direkt in Typ parsen
        setError(null);

        if (onLoad) onLoad(playlist); // Callback nach außen, um weiterzuarbeiten
      } catch (err) {
        console.error("Fehler beim Einlesen:", err);
        setError("Ungültige JSON-Datei.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="p-4 border rounded-xl bg-gray-100">
      <input type="file" accept=".json,.bplist" onChange={handleFileChange} />
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default FileUpload;
