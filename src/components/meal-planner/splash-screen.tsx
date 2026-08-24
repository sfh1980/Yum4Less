"use client";

type SplashScreenProps = {
  onContinue: () => void;
};

export const SPLASH_TAGLINE = "Find realistic low-cost dinner options near you.";

export const SPLASH_INTRO =
  "Yum4Less is a dinner planner for grocery stores near you. You pick a location, the stores you shop, and a spending limit. Then we suggest meals that use items on this week's sales.";

export const SPLASH_TRUST =
  "Prices are estimates. Check them in the store before you shop.";

const SPLASH_PHOTOS = [
  {
    src: "/splash/grocery-aisle.webp",
    className: "splash-photo splash-photo--hero",
  },
  {
    src: "/splash/grocery-produce.webp",
    className: "splash-photo",
  },
  {
    src: "/splash/home-dinner.webp",
    className: "splash-photo",
  },
] as const;

export function SplashScreen({ onContinue }: SplashScreenProps) {
  return (
    <section
      className="wizard-screen wizard-screen--splash"
      aria-labelledby="splash-title"
      data-testid="onboarding-splash"
    >
      <h1 id="splash-title" className="wizard-brand">
        Yum4Less
      </h1>
      <div className="splash-media" aria-hidden="true">
        {SPLASH_PHOTOS.map((photo) => (
          // Static decorative webp in /public; empty alt. next/image would need fixed sizes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.src}
            className={photo.className}
            src={photo.src}
            alt=""
            decoding="async"
          />
        ))}
      </div>
      <p className="wizard-tagline">{SPLASH_TAGLINE}</p>
      <div className="wizard-copy-stack">
        <p className="wizard-copy">{SPLASH_INTRO}</p>
        <p className="wizard-copy">{SPLASH_TRUST}</p>
      </div>
      <button className="wizard-continue" type="button" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
