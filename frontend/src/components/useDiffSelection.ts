// useDiffSelection.ts — the edit-mode difficulty-selection state
// machine, split out of SongList.tsx so that file is left with mostly
// rendering: selecting/deselecting diffs (individually or a whole
// song at once), and the "is everything selected ranked/unranked"
// checks the bulk-action buttons gate on, all live here instead of
// mixed into the page component's own state.
import { useEffect, useState } from "react";

// hash -> characteristic -> selected difficulties
export type SelectedDiffs = { [hash: string]: { [characteristic: string]: string[] } };

export type StarRatingMap = Record<string, Record<string, Record<string, number>>>;

export function useDiffSelection(editMode: boolean, starRatingMap: StarRatingMap) {
  const [selectedDiffs, setSelectedDiffs] = useState<SelectedDiffs>({});

  // Leaving edit mode clears whatever was selected — same behavior the
  // old local toggle used to do inline, before editMode moved up to
  // the parent (PoolSongListPage, for its own "EDIT MODE!!" banner).
  useEffect(() => {
    if (!editMode) setSelectedDiffs({});
  }, [editMode]);

  const toggleDiffSelection = (hash: string, characteristic: string, difficulty: string) => {
    setSelectedDiffs((prev) => {
      const prevChar = prev[hash]?.[characteristic] || [];
      const isSelected = prevChar.includes(difficulty);

      if (!isSelected) {
        return {
          ...prev,
          [hash]: {
            ...prev[hash],
            [characteristic]: [...prevChar, difficulty],
          },
        };
      }

      // Deselecting — drop the characteristic entirely once it's down
      // to zero diffs, and the song entirely once it has no
      // characteristics left, instead of leaving an empty {} behind.
      // Otherwise the song lingers in selectedDiffs with nothing
      // actually selected under it — invisible in the grid (every
      // badge there checks its own diff) but still shown as a ghost
      // entry in the "selected maps" tray above, which iterates
      // selectedDiffs directly.
      const nextChar = prevChar.filter((d) => d !== difficulty);
      const nextHashEntry = { ...prev[hash] };
      if (nextChar.length > 0) {
        nextHashEntry[characteristic] = nextChar;
      } else {
        delete nextHashEntry[characteristic];
      }

      const next = { ...prev };
      if (Object.keys(nextHashEntry).length > 0) {
        next[hash] = nextHashEntry;
      } else {
        delete next[hash];
      }
      return next;
    });
  };

  // Select or deselect every difficulty of one song at once
  const setSongSelection = (
    hash: string,
    select: boolean,
    diffs: { characteristic: string; difficulty: string }[],
  ) => {
    setSelectedDiffs((prev) => {
      const next = { ...prev };
      if (!select) {
        delete next[hash];
        return next;
      }
      const byCharacteristic: { [characteristic: string]: string[] } = {};
      diffs.forEach(({ characteristic, difficulty }) => {
        byCharacteristic[characteristic] = [
          ...(byCharacteristic[characteristic] || []),
          difficulty,
        ];
      });
      next[hash] = byCharacteristic;
      return next;
    });
  };

  const clearSelection = () => setSelectedDiffs({});

  const allSelectedAreRanked = Object.entries(selectedDiffs).every(
    ([hash, chars]) =>
      Object.entries(chars).every(([characteristic, diffs]) =>
        diffs.every(
          (difficulty) =>
            starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined,
        ),
      ),
  );

  const allSelectedAreUnranked = Object.entries(selectedDiffs).every(
    ([hash, chars]) =>
      Object.entries(chars).every(([characteristic, diffs]) =>
        diffs.every(
          (difficulty) =>
            starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined,
        ),
      ),
  );

  // Total number of currently selected difficulties (across all songs)
  const selectedCount = Object.values(selectedDiffs).reduce(
    (sum, chars) =>
      sum + Object.values(chars).reduce((s, arr) => s + arr.length, 0),
    0,
  );

  return {
    selectedDiffs,
    toggleDiffSelection,
    setSongSelection,
    clearSelection,
    selectedCount,
    allSelectedAreRanked,
    allSelectedAreUnranked,
  };
}
