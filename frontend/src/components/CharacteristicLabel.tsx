import React from "react";
import { characteristicIcons, characteristicLabels } from "./types";

// Small icon-first stand-in for a characteristic's plain-text name
// (Standard, Lawless, ...) — used wherever a characteristic is shown
// as its own compact label (not inline with other prose). Falls back
// to the plain name for the rare characteristic with no icon mapped
// (see types.ts's characteristicIcons) instead of rendering nothing.
const CharacteristicLabel: React.FC<{
  characteristic: string;
  className?: string;
}> = ({ characteristic, className = "char-label" }) => {
  const icon = characteristicIcons[characteristic];
  const label = characteristicLabels[characteristic] || characteristic;
  if (!icon) {
    return <span className={className}>{label}</span>;
  }
  return (
    <img
      src={icon}
      alt={label}
      title={label}
      className="w-4 h-4 opacity-80 flex-shrink-0"
    />
  );
};

export default CharacteristicLabel;
