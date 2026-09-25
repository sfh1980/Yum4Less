"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { buildOwnerCoverageMapModel } from "@/lib/owner/owner-market-coverage-map-model";
import type { OwnerMarketCoverageShade } from "@/lib/owner/owner-market-coverage-map-model";

type OwnerMarketCoverageMapProps = {
  shades: readonly OwnerMarketCoverageShade[];
};

type MapView = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function parseViewBox(viewBox: string): MapView {
  const [x, y, width, height] = viewBox.split(" ").map(Number);
  return { x, y, width, height };
}

function formatViewBox(view: MapView): string {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

export function OwnerMarketCoverageMap({ shades }: OwnerMarketCoverageMapProps) {
  const model = buildOwnerCoverageMapModel(shades);
  const baseView = useMemo(() => parseViewBox(model.viewBox), [model.viewBox]);
  const [view, setView] = useState<MapView>(baseView);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; view: MapView } | null>(null);
  const shadeCount = model.shades.length;
  const label =
    shadeCount === 0
      ? "No coverage area shaded yet."
      : `Coverage area. ${shadeCount} shaded shape${shadeCount === 1 ? "" : "s"}. Scroll or use the zoom buttons. Drag to move.`;

  useEffect(() => {
    setView(baseView);
  }, [baseView]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || shadeCount === 0) {
      return;
    }
    // Nested handlers do not keep the narrowed type of `svg`.
    const mapSvg = svg;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = mapSvg.getBoundingClientRect();
      const px = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
      const py = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
      const zoomIn = event.deltaY < 0;
      setView((current) => zoomView(current, zoomIn ? 0.85 : 1.18, px, py));
    }
    mapSvg.addEventListener("wheel", onWheel, { passive: false });
    return () => mapSvg.removeEventListener("wheel", onWheel);
  }, [shadeCount]);

  function zoomFromCenter(zoomIn: boolean) {
    setView((current) => zoomView(current, zoomIn ? 0.85 : 1.18, 0.5, 0.5));
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (shadeCount === 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, view };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const dx = ((event.clientX - drag.x) / rect.width) * drag.view.width;
    const dy = ((event.clientY - drag.y) / rect.height) * drag.view.height;
    setView({
      ...drag.view,
      x: drag.view.x - dx,
      y: drag.view.y - dy,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <figure className="owner-market-coverage-map">
      {shadeCount > 0 ? (
        <div className="owner-market-coverage-zoom">
          <button onClick={() => zoomFromCenter(true)} type="button">
            Zoom in
          </button>
          <button onClick={() => zoomFromCenter(false)} type="button">
            Zoom out
          </button>
          <button onClick={() => setView(baseView)} type="button">
            Reset
          </button>
        </div>
      ) : null}
      <svg
        aria-label={label}
        className="owner-market-coverage-map-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={svgRef}
        role="img"
        style={{ height: `${model.heightPx}px` }}
        viewBox={formatViewBox(view)}
      >
        {model.shades.map((shade) => (
          <path
            className={`owner-market-coverage-shade owner-market-coverage-shade--${shade.status}`}
            d={shade.d}
            key={`${shade.status}-${shade.zipCode}`}
          />
        ))}
      </svg>
      <figcaption className="owner-market-coverage-caption">
        Shaded coverage only. Scroll to zoom, drag to move. Active, paused, and
        Check ZIP preview use different fills. Picture only.
      </figcaption>
    </figure>
  );
}

function zoomView(view: MapView, factor: number, px: number, py: number): MapView {
  const nextWidth = clamp(view.width * factor, 0.01, 40);
  const nextHeight = clamp(view.height * factor, 0.01, 20);
  const anchorX = view.x + view.width * px;
  const anchorY = view.y + view.height * py;
  return {
    x: anchorX - nextWidth * px,
    y: anchorY - nextHeight * py,
    width: nextWidth,
    height: nextHeight,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
