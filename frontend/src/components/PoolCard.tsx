// PoolCard.tsx — banner-header layout (option 1b)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

interface PoolDetailed {
  id: string;
  title: string;
  image: string;
  short_description: string;
  author: string;
  player_count: number;
  popularity: number;
  banner_image?: string;
}

// "A, B, and C" -> "A, B +1" when there are more than 2 names.
const formatAuthors = (author: string) => {
  const names = author
    .replace(/ and /gi, ", ")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length <= 2) return author;
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
};

const PoolCard: React.FC<{ pool: PoolDetailed }> = ({ pool }) => {
  const navigate = useNavigate();
  const [heroBroken, setHeroBroken] = useState(false);

  // Prefer the banner, fall back to the cover, then the stripe fallback.
  const hero = !heroBroken ? pool.banner_image || pool.image : undefined;

  return (
    <div
      className="pixel-pool-card cursor-pointer h-full flex flex-col"
      onClick={() => navigate(`/pool/${pool.id}`)}
    >
      {/* Header: banner as the image area, title overlaid on top */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "600 / 150", boxShadow: "inset 0 -4px 0 var(--px-outline)" }}
      >
        {hero ? (
          <img
            src={hero}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHeroBroken(true)}
          />
        ) : (
          <div className="pixel-banner-fallback w-full h-full" />
        )}
        <div className="pixel-card-title-scrim absolute inset-x-0 bottom-0 px-3 py-2.5">
          <div
            className="pixel-font text-[13px] leading-tight text-cyan-300 truncate"
            title={pool.title}
          >
            {pool.title}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3.5">
        <div className="text-xs text-neutral-500 mb-2 truncate" title={pool.author}>
          by <span className="text-neutral-300">{formatAuthors(pool.author)}</span>
        </div>

        <div
          className="text-[13px] leading-relaxed text-neutral-400 mb-3.5 min-h-[2.9em]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {pool.short_description}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <span className="pixel-stat">
            PLAYERS <b>{pool.player_count.toLocaleString()}</b>
          </span>
          <span className="pixel-stat">
            POPULARITY <b className="text-[#f3c542]">{pool.popularity}</b>
          </span>
          <span className="pixel-font text-[9px] text-[#1a6f96] ml-auto">OPEN ▸</span>
        </div>
      </div>
    </div>
  );
};

export default PoolCard;
