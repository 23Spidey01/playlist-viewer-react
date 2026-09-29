import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Hitbloq's cr_curve: a function from accuracy (0 = 0%, 1 = 100%) to a
// score multiplier — piecewise-linear between the given points, per the
// API's own "type": "linear". Real CR for a play is
// `stars * 50 * multiplier(accuracy)` (see DaFluffyPotato/hitbloq's
// cr_formulas.py, calculate_cr). Since this chart is pool-wide rather
// than for one song, it's scaled against the pool's hardest ranked
// difficulty (maxStars) to show real, representative CR numbers instead
// of the bare 0-ish multiplier. Shown next to the leaderboard in
// PoolHeader.tsx so mods can see the shape of the curve at a glance.
type CrCurvePoint = [number, number];

const CR_PER_STAR_AT_MULTIPLIER_1 = 50;

const MIN_STARS = 1;
const MAX_STARS = 50;
const STARS_STEP = 0.5;

// Sized to fit the same 176px-tall header column the leaderboard
// uses (see .pixel-pool-header-chart) — no room for axis labels or a
// description at this size, just the line itself plus a hover value.
const WIDTH = 172;
const HEIGHT = 84;
const PAD = 4;
const PLOT_W = WIDTH - PAD * 2;
const PLOT_H = HEIGHT - PAD * 2;

// Piecewise-linear interpolation matching the curve's own "type":
// "linear" — the value at an arbitrary x between two defined points
// is a straight-line blend between them, same as Hitbloq computes it.
function interpolate(points: CrCurvePoint[], x: number): number {
  if (points.length === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) {
      if (x2 === x1) return y2;
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return points[points.length - 1][1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const CrCurveChart: React.FC<{ poolId: string; maxStars?: number }> = ({ poolId, maxStars }) => {
  const [rawPoints, setRawPoints] = useState<CrCurvePoint[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  // null = "not touched yet, follow the pool's own hardest difficulty".
  // Once the user drags the slider it's pinned until the pool changes.
  const [simulatedStars, setSimulatedStars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRawPoints(null);
    setSimulatedStars(null);
    fetch(`http://localhost:3001/proxy/ranked_list/${poolId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const pts = data?.cr_curve?.points;
        if (Array.isArray(pts) && pts.length > 0) {
          setRawPoints([...pts].sort((a, b) => a[0] - b[0]));
        }
      })
      .catch(() => {
        // Supplementary info, not critical — fail quietly, same as
        // this page already does for other best-effort fetches.
      });
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  // Real CR = stars * 50 * multiplier. Fall back to 1 star (i.e. show
  // the bare multiplier) if the pool has no star-rated songs yet.
  const defaultStars = clamp(maxStars && maxStars > 0 ? maxStars : 1, MIN_STARS, MAX_STARS);
  const stars = simulatedStars ?? defaultStars;
  const points = useMemo<CrCurvePoint[] | null>(() => {
    if (!rawPoints) return null;
    const scale = stars * CR_PER_STAR_AT_MULTIPLIER_1;
    return rawPoints.map(([x, y]) => [x, y * scale] as CrCurvePoint);
  }, [rawPoints, stars]);

  const maxY = useMemo(() => {
    if (!points) return 10;
    return Math.max(...points.map((p) => p[1]), 1) * 1.08;
  }, [points]);

  const xScale = useCallback((x: number) => PAD + x * PLOT_W, []);
  const yScale = useCallback((y: number) => PAD + (1 - y / maxY) * PLOT_H, [maxY]);

  const linePath = useMemo(() => {
    if (!points) return "";
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${xScale(x)} ${yScale(y)}`).join(" ");
  }, [points, xScale, yScale]);

  const areaPath = useMemo(() => {
    if (!points) return "";
    const baseline = yScale(0);
    const top = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${xScale(x)} ${yScale(y)}`).join(" ");
    const lastX = xScale(points[points.length - 1][0]);
    const firstX = xScale(points[0][0]);
    return `${top} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  }, [points, xScale, yScale]);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!points || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const x = Math.min(1, Math.max(0, (px - PAD) / PLOT_W));
    setHoverX(x);
  };

  if (!points) return null;

  const hoverY = hoverX === null ? null : interpolate(points, hoverX);

  return (
    <div className="pixel-pool-header-chart">
      <div className="inner">
        <div className="flex items-baseline gap-2 mb-px">
          <span className="pixel-font text-[8px] text-[#f3c542]">CR CURVE</span>
          <span className="text-[9px] text-[#4b5568] ml-auto">
            ★{stars % 1 === 0 ? stars : stars.toFixed(1)}
          </span>
        </div>

        <input
          type="range"
          className="pixel-cr-slider"
          min={MIN_STARS}
          max={MAX_STARS}
          step={STARS_STEP}
          value={stars}
          onChange={(e) => setSimulatedStars(Number(e.target.value))}
          title="Simulate a different star rating"
        />

        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverX(null)}
        >
          <path d={areaPath} fill="var(--px-cyan)" opacity={0.15} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--px-cyan)" strokeWidth={1.5} />

          {hoverX !== null && hoverY !== null && (
            <>
              <line
                x1={xScale(hoverX)}
                x2={xScale(hoverX)}
                y1={PAD}
                y2={HEIGHT - PAD}
                stroke="var(--px-gold)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={xScale(hoverX)}
                cy={yScale(hoverY)}
                r={2.5}
                fill="var(--px-gold)"
                stroke="var(--px-outline)"
                strokeWidth={0.75}
              />
            </>
          )}
        </svg>

        <div className="text-[10px] text-[#6a7690] mt-auto">
          {hoverX !== null && hoverY !== null ? (
            <>
              <span className="text-cyan-200">{(hoverX * 100).toFixed(0)}% acc</span>
              {" → "}
              <span className="text-cyan-200">{Math.round(hoverY).toLocaleString()}</span>cr
            </>
          ) : (
            "hover: accuracy → cr"
          )}
        </div>
      </div>
    </div>
  );
};

export default CrCurveChart;
