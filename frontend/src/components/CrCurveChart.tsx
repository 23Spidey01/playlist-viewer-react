import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Hitbloq's cr_curve: a function from accuracy (0 = 0%, 1 = 100%) to a
// score multiplier. Real CR for a play is `stars * 50 * multiplier(accuracy)`
// (see DaFluffyPotato/hitbloq's cr_formulas.py, calculate_cr). Two curve
// shapes exist there:
//  - "linear": piecewise-linear between explicit [accuracy, multiplier]
//    points (cr_formulas.py's linear_curve).
//  - "basic": a baseline/cutoff/exponential formula with no points at
//    all (cr_formulas.py's base_curve) — pools like "vocaloid" use this
//    one. Missing this case is why some pools showed no chart at all.
// Since this chart is pool-wide rather than for one song, it's scaled
// against the pool's hardest ranked difficulty (maxStars) to show real,
// representative CR numbers instead of the bare 0-ish multiplier. Shown
// next to the leaderboard in PoolHeader.tsx so mods can see the shape
// of the curve at a glance.
type CrCurvePoint = [number, number];

type LinearCurve = { type: "linear"; points: CrCurvePoint[] };
type BasicCurve = {
  type: "basic";
  baseline?: number;
  cutoff?: number;
  exponential?: number;
};
type CurveData = LinearCurve | BasicCurve;

const CR_PER_STAR_AT_MULTIPLIER_1 = 50;

const MIN_STARS = 1;
const MAX_STARS = 50;
const STARS_STEP = 0.5;

// Only used to draw a smooth line for "basic" curves, which have no
// points of their own to plot — "linear" curves render their exact
// points instead, so a sharp/late spike (real pools have these) isn't
// smeared out by a fixed sampling grid.
const BASIC_CURVE_SAMPLES = 64;

// Sized to fit the same 176px-tall header column the leaderboard
// uses (see .pixel-pool-header-chart) — no room for axis labels or a
// description at this size, just the line itself plus a hover value.
const WIDTH = 172;
const HEIGHT = 84;
const PAD = 4;
const PLOT_W = WIDTH - PAD * 2;
const PLOT_H = HEIGHT - PAD * 2;

// Piecewise-linear interpolation matching linear_curve's own behavior
// — the value at an arbitrary x between two defined points is a
// straight-line blend between them, same as Hitbloq computes it.
function interpolateLinear(points: CrCurvePoint[], x: number): number {
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

// Mirrors cr_formulas.py's base_curve exactly, just working in 0-1
// accuracy fractions throughout instead of 0-100 percentages.
function evaluateBasicCurve(curve: BasicCurve, x: number): number {
  const baseline = curve.baseline ?? 0.78;
  const cutoff = curve.cutoff ?? 0.5;
  const exponential = curve.exponential ?? 2.5;
  if (x < baseline) return x * cutoff;
  const denom = 1 - baseline;
  const t = denom > 0 ? (x - baseline) / denom : 0;
  return x * cutoff + (1 - cutoff) * Math.pow(t, exponential);
}

function multiplierAt(curve: CurveData, x: number): number {
  const clamped = Math.min(1, Math.max(0, x));
  return curve.type === "linear"
    ? interpolateLinear(curve.points, clamped)
    : evaluateBasicCurve(curve, clamped);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Parses the proxy's raw cr_curve payload into CurveData, or null for
// an unrecognized/missing shape — the chart just doesn't render rather
// than guessing at it.
function parseCurve(raw: unknown): CurveData | null {
  const r = raw as { type?: string; points?: unknown; baseline?: number; cutoff?: number; exponential?: number } | null | undefined;
  if (r?.type === "linear" && Array.isArray(r.points) && r.points.length > 0) {
    return {
      type: "linear",
      points: [...(r.points as CrCurvePoint[])].sort((a, b) => a[0] - b[0]),
    };
  }
  if (r?.type === "basic") {
    return {
      type: "basic",
      baseline: r.baseline,
      cutoff: r.cutoff,
      exponential: r.exponential,
    };
  }
  return null;
}

const CrCurveChart: React.FC<{ poolId: string; maxStars?: number }> = ({ poolId, maxStars }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  // null = "not touched yet, follow the pool's own hardest difficulty".
  // Once the user drags the slider it's pinned until the pool changes.
  const [simulatedStars, setSimulatedStars] = useState<number | null>(null);

  // Supplementary info, not critical — a failed fetch here just leaves
  // `curve` undefined/null and the chart doesn't render, same as the
  // old silent .catch().
  const { data: curve } = useQuery({
    queryKey: ["crCurve", poolId],
    queryFn: async () => {
      const res = await fetch(`/proxy/ranked_list/${poolId}`);
      const data = await res.json();
      return parseCurve(data?.cr_curve);
    },
    enabled: Boolean(poolId),
  });

  // A simulated star rating from the previous pool doesn't mean
  // anything once poolId changes — this component can stay mounted
  // across a pool switch (same route, different :id param).
  useEffect(() => {
    setSimulatedStars(null);
  }, [poolId]);

  // Real CR = stars * 50 * multiplier. Fall back to 1 star (i.e. show
  // the bare multiplier) if the pool has no star-rated songs yet.
  const defaultStars = clamp(maxStars && maxStars > 0 ? maxStars : 1, MIN_STARS, MAX_STARS);
  const stars = simulatedStars ?? defaultStars;

  // The shape to draw: a linear curve's own points (exact, so a sharp
  // late spike stays sharp), or a fixed sampling of a basic curve
  // (which has no points of its own).
  const shape = useMemo<CrCurvePoint[] | null>(() => {
    if (!curve) return null;
    if (curve.type === "linear") return curve.points;
    const samples: CrCurvePoint[] = [];
    for (let i = 0; i <= BASIC_CURVE_SAMPLES; i++) {
      const x = i / BASIC_CURVE_SAMPLES;
      samples.push([x, evaluateBasicCurve(curve, x)]);
    }
    return samples;
  }, [curve]);

  const points = useMemo<CrCurvePoint[] | null>(() => {
    if (!shape) return null;
    const scale = stars * CR_PER_STAR_AT_MULTIPLIER_1;
    return shape.map(([x, y]) => [x, y * scale] as CrCurvePoint);
  }, [shape, stars]);

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

  if (!curve || !points) return null;

  // Evaluated exactly against the curve formula/points rather than by
  // interpolating over `points` — matters for "basic" curves, whose
  // rendered shape is only a fixed sampling of the real formula.
  const hoverY = hoverX === null ? null : multiplierAt(curve, hoverX) * stars * CR_PER_STAR_AT_MULTIPLIER_1;

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
