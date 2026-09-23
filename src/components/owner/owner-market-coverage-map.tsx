import { buildOwnerCoverageMapModel } from "@/lib/owner/owner-market-coverage-map-model";
import type { OwnerMarketCoverageShade } from "@/lib/owner/owner-market-coverage-map-model";

type OwnerMarketCoverageMapProps = {
  shades: readonly OwnerMarketCoverageShade[];
};

export function OwnerMarketCoverageMap({ shades }: OwnerMarketCoverageMapProps) {
  const model = buildOwnerCoverageMapModel(shades);
  const shadeCount = model.shades.length;
  const label =
    shadeCount === 0
      ? "Virginia outline. No Census ZIP coverage shaded yet."
      : `Census ZIP outlines on a ${
          model.frame === "virginia"
            ? "Virginia"
            : model.frame === "mid-atlantic"
              ? "Mid-Atlantic"
              : "continental US"
        } outline. ${shadeCount} ZIP shape${shadeCount === 1 ? "" : "s"} shaded.`;

  return (
    <figure className="owner-market-coverage-map">
      <svg
        aria-label={label}
        className="owner-market-coverage-map-svg"
        role="img"
        style={{ height: `${model.heightPx}px` }}
        viewBox={model.viewBox}
      >
        {model.landPaths.map((land) => (
          <path className="owner-market-coverage-land" d={land.d} key={land.id} />
        ))}
        {model.shades.map((shade) => (
          <g key={`${shade.status}-${shade.zipCode}`}>
            <path
              className={`owner-market-coverage-shade owner-market-coverage-shade--${shade.status}`}
              d={shade.d}
            />
            <text
              className="owner-market-coverage-label"
              dy="0.35em"
              fontSize={model.labelFontSize}
              textAnchor="middle"
              x={shade.labelX}
              y={shade.labelY}
            >
              {shade.zipCode}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="owner-market-coverage-caption">
        Census ZIP outlines only. Shopper search can reach about 8 miles past
        these shapes. Active, paused, and Check ZIP preview use different
        fills. Picture only.
      </figcaption>
    </figure>
  );
}
