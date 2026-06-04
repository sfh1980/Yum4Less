"use client";

import {
  Children,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type RecommendationResultsCarouselProps = {
  ariaLabel: string;
  children: ReactNode;
};

export function RecommendationResultsCarousel({
  ariaLabel,
  children,
}: RecommendationResultsCarouselProps) {
  const slides = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track || slides.length === 0) {
      return;
    }

    const boundedIndex = Math.max(0, Math.min(index, slides.length - 1));
    scrollElementTo(
      track,
      boundedIndex * track.clientWidth,
      prefersReducedMotion() ? "auto" : "smooth",
    );
    setActiveIndex(boundedIndex);
  }, [slides.length]);

  useEffect(() => {
    setActiveIndex(0);
    if (trackRef.current) {
      scrollElementTo(trackRef.current, 0, "auto");
    }
  }, [slides.length]);

  const syncActiveIndexFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    }
  }

  if (slides.length === 0) {
    return null;
  }

  const showControls = slides.length > 1;

  return (
    <section
      aria-label={ariaLabel}
      className="recommendation-carousel"
      onKeyDown={handleKeyDown}
    >
      {showControls ? (
        <div className="recommendation-carousel-header">
          <p className="field-hint recommendation-carousel-hint">
            Swipe sideways or use the arrows to move between ranked dinners.
          </p>
          <div className="recommendation-carousel-controls">
            <button
              type="button"
              className="secondary-button recommendation-carousel-nav"
              aria-label="Previous recommendation"
              disabled={activeIndex === 0}
              onClick={() => scrollToIndex(activeIndex - 1)}
            >
              Previous
            </button>
            <span
              aria-live="polite"
              className="recommendation-carousel-status"
            >
              {activeIndex + 1} of {slides.length}
            </span>
            <button
              type="button"
              className="secondary-button recommendation-carousel-nav"
              aria-label="Next recommendation"
              disabled={activeIndex >= slides.length - 1}
              onClick={() => scrollToIndex(activeIndex + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className="recommendation-carousel-track"
        tabIndex={showControls ? 0 : undefined}
        onScroll={syncActiveIndexFromScroll}
      >
        {slides.map((slide, index) => (
          <div
            aria-hidden={index !== activeIndex}
            className="recommendation-carousel-slide"
            inert={index !== activeIndex ? true : undefined}
            key={index}
          >
            {slide}
          </div>
        ))}
      </div>

      {showControls ? (
        <div
          aria-label="Recommendation pagination"
          className="recommendation-carousel-dots"
        >
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Show recommendation ${index + 1}`}
              className={
                index === activeIndex
                  ? "recommendation-carousel-dot is-active"
                  : "recommendation-carousel-dot"
              }
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function scrollElementTo(
  element: HTMLElement,
  left: number,
  behavior: ScrollBehavior,
) {
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ left, behavior });
    return;
  }

  element.scrollLeft = left;
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
