"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  type MealPreferenceForm,
  type RecommendationExperience,
} from "@/lib/mock-recommendations";

const defaultForm: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 16,
  maxIngredients: 8,
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
};

type FormState = {
  zipCode: string;
  radiusMiles: string;
  budget: string;
  maxIngredients: string;
  dinnersWanted: string;
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  dietaryFocus: MealPreferenceForm["dietaryFocus"];
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type ExperienceState = {
  status: "idle" | "loading" | "ready" | "error";
  experience?: RecommendationExperience;
  error?: string;
  providerConfigured?: boolean;
};

const defaultFormState: FormState = {
  zipCode: defaultForm.zipCode,
  radiusMiles: String(defaultForm.radiusMiles),
  budget: String(defaultForm.budget),
  maxIngredients: String(defaultForm.maxIngredients),
  dinnersWanted: String(defaultForm.dinnersWanted),
  shoppingStyle: defaultForm.shoppingStyle,
  dietaryFocus: defaultForm.dietaryFocus,
};

const initialExperienceState: ExperienceState = {
  status: "idle",
};

export function RecommendationDemo() {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [experienceState, setExperienceState] =
    useState<ExperienceState>(initialExperienceState);
  const [isTrustExplainerOpen, setIsTrustExplainerOpen] = useState(false);
  const [hasDismissedTrustExplainer, setHasDismissedTrustExplainer] =
    useState(false);

  const validation = useMemo(() => validateForm(form), [form]);

  useEffect(() => {
    if (!validation.preferences) {
      setExperienceState(initialExperienceState);
      return;
    }

    const controller = new AbortController();

    setExperienceState((current) => ({
      ...current,
      status: "loading",
      error: undefined,
    }));

    void fetch("/api/recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.preferences),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as RecommendationResponse;

        if (!payload.ok) {
          setExperienceState({
            status: "error",
            providerConfigured: payload.providerConfigured,
            error: payload.error,
          });
          return;
        }

        setExperienceState({
          status: "ready",
          experience: payload.experience,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setExperienceState({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Recommendation lookup failed unexpectedly.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [validation.preferences]);

  useEffect(() => {
    if (experienceState.status === "ready" && !hasDismissedTrustExplainer) {
      setIsTrustExplainerOpen(true);
    }
  }, [experienceState.status, hasDismissedTrustExplainer]);

  const experience = experienceState.experience;
  const recommendations = experience?.recommendations ?? [];
  const market = experience?.market;
  const hasErrors = Object.keys(validation.errors).length > 0;
  const marketBlocked = !!market && market.nearbyStores.length === 0;

  return (
    <section className="demo-grid" aria-label="Local dinner recommendation flow">
      <div className="panel panel-padding">
        <h2>Search local dinner options</h2>
        <p className="panel-copy">
          Start with a ZIP code and radius to define the nearby market, then use
          your budget, ingredient, and shopping-style preferences to rank dinner
          options against the available store coverage.
        </p>

        <div className="form-grid">
          <Field
            label="ZIP code"
            error={validation.errors.zipCode}
            hint="We start with 23111 because the MVP is local first. GEOCODIO_API_KEY now enables live ZIP lookup, while DATABASE_URL lets the app read market data from Postgres instead of seeded memory data."
          >
            <input
              aria-invalid={validation.errors.zipCode ? true : undefined}
              value={form.zipCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  zipCode: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Radius in miles" error={validation.errors.radiusMiles}>
            <input
              aria-invalid={validation.errors.radiusMiles ? true : undefined}
              min={1}
              max={25}
              step={1}
              type="number"
              value={form.radiusMiles}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  radiusMiles: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Budget cap" error={validation.errors.budget}>
            <input
              aria-invalid={validation.errors.budget ? true : undefined}
              min={5}
              max={40}
              step={0.5}
              type="number"
              value={form.budget}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  budget: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            label="Maximum ingredients"
            error={validation.errors.maxIngredients}
          >
            <input
              aria-invalid={validation.errors.maxIngredients ? true : undefined}
              min={3}
              max={12}
              step={1}
              type="number"
              value={form.maxIngredients}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maxIngredients: event.target.value,
                }))
              }
            />
          </Field>

          <Field
            label="Dinner options wanted"
            error={validation.errors.dinnersWanted}
          >
            <input
              aria-invalid={validation.errors.dinnersWanted ? true : undefined}
              min={1}
              max={4}
              step={1}
              type="number"
              value={form.dinnersWanted}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dinnersWanted: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Shopping style">
            <select
              value={form.shoppingStyle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  shoppingStyle: event.target.value as MealPreferenceForm["shoppingStyle"],
                }))
              }
            >
              <option value="single-store">Single store only</option>
              <option value="multi-store">Multiple stores allowed</option>
            </select>
          </Field>

          <Field label="Dietary focus">
            <select
              value={form.dietaryFocus}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dietaryFocus: event.target.value as MealPreferenceForm["dietaryFocus"],
                }))
              }
            >
              <option value="anything">Anything</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="quick">Quick meals</option>
            </select>
          </Field>
        </div>

        {market ? (
          <div className="market-summary">
            <h3>Nearby Market Snapshot</h3>
            <p className="panel-copy">{market.message}</p>

            <div className="pill-row">
              <span className="pill">ZIP {market.searchedZipCode}</span>
              <span className="pill">{market.locationLabel}</span>
              <span className="pill">{market.radiusMiles} mile radius</span>
              <span className="pill">{market.nearbyStores.length} nearby store(s)</span>
              <span className="pill">{formatLookupSource(market.lookupSource)}</span>
              <span className="pill">{formatDataSource(market.dataSource)}</span>
              {!market.providerConfigured ? (
                <span className="pill">Geocodio not configured</span>
              ) : null}
            </div>

            {market.nearbyStores.length > 0 ? (
              <div className="store-summary-list">
                {market.nearbyStores.map((store) => (
                  <div className="store-summary-item" key={store.id}>
                    <strong>{store.name}</strong>
                    <span>
                      {formatStoreKind(store.kind)} · {store.distanceMiles} miles
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="panel panel-padding">
        <div className="results-header">
          <div>
            <h2>Dinner recommendations</h2>
            <p className="panel-copy">
              These recommendations use a real server-side location boundary and
              can read market data from Postgres when it is available, while
              still showing clear estimate and fallback context in the results.
            </p>
          </div>
          <div className="results-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setIsTrustExplainerOpen(true)}
            >
              How to read these labels
            </button>
            <span className="badge">
              {hasErrors
                ? "Fix inputs to rank meals"
                : experienceState.status === "loading"
                  ? "Building recommendations..."
                  : experienceState.status === "error"
                    ? "Resolve data to rank meals"
                    : `${recommendations.length} options ranked`}
            </span>
          </div>
        </div>

        <div className="warning">
          Totals are still estimates. If ZIP lookup or market data falls back to
          local seeded coverage, Yum4Less keeps running but labels the source so
          you can judge how much trust to place in each recommendation.
        </div>

        <div className="results-stack">
          {hasErrors ? (
            <div className="card">
              <h3 className="card-title">Results paused until the form is valid</h3>
              <p className="explanation">
                Fix the highlighted fields first. Yum4Less validates user input
                before it tries to price ingredients or rank meals.
              </p>
            </div>
          ) : experienceState.status === "loading" ? (
            <div className="card">
              <h3 className="card-title">Building recommendation context</h3>
              <p className="explanation">
                We are resolving the ZIP and loading the market layer before
                assembling the nearby stores, shopping plans, and ranked dinner
                options.
              </p>
            </div>
          ) : experienceState.status === "error" ? (
            <div className="card">
              <h3 className="card-title">We could not build recommendations yet</h3>
              <p className="explanation">
                {experienceState.error ??
                  "Try another ZIP or configure the required environment variables."}
              </p>
              {experienceState.providerConfigured === false ? (
                <p className="explanation">
                  Geocodio is not configured, so the app is limited to the local
                  fallback ZIP set.
                </p>
              ) : null}
            </div>
          ) : marketBlocked ? (
            <div className="card">
              <h3 className="card-title">Adjust the location search first</h3>
              <p className="explanation">
                The recommendation engine only ranks dinners after it resolves
                the ZIP and finds at least one nearby store inside your chosen
                radius.
              </p>
              <p className="explanation">
                Try a larger radius or a ZIP closer to the local MVP market so
                the store layer has enough context to build a shopping plan.
              </p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="card">
              <h3 className="card-title">No meals match the current filters</h3>
              <p className="explanation">
                That is useful feedback, not a failure. Your current budget,
                ingredient limit, or store preference may be too strict for the
                nearby store coverage.
              </p>
              <p className="explanation">
                Try raising the budget, allowing multiple stores, or increasing
                the maximum ingredient count.
              </p>
            </div>
          ) : (
            recommendations.map((meal) => (
              <article className="card" key={meal.title}>
                <div className="card-topline">
                  <h3 className="card-title">{meal.title}</h3>
                  <span className="price">${meal.estimatedTotal.toFixed(2)}</span>
                </div>

                <p className="card-summary">{meal.summary}</p>

                <div className="pill-row">
                  {market ? (
                    <>
                      <span className="pill">{formatDataSource(market.dataSource)}</span>
                      <span className="pill">{formatLookupSource(market.lookupSource)}</span>
                    </>
                  ) : null}
                  <span className="pill">Score {meal.score.total}</span>
                  <span className="pill">{meal.confidenceLabel}</span>
                  <span className="pill">{meal.cookTimeMinutes} min</span>
                  <span className="pill">{formatDifficulty(meal.difficulty)}</span>
                  <span className="pill">{meal.primaryStore}</span>
                </div>

                <div className="pill-row">
                  <span className="pill">{meal.storeCount} store(s)</span>
                  <span className="pill">
                    {meal.matchedIngredients} matched ingredients
                  </span>
                  <span className="pill">{meal.freshnessLabel}</span>
                  {!market?.providerConfigured ? (
                    <span className="pill">Local ZIP fallback</span>
                  ) : null}
                </div>

                <div className="pill-row">
                  {meal.tags.map((tag) => (
                    <span className="pill" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="ingredient-highlights">
                  Key ingredients: {meal.ingredientHighlights.join(", ")}.
                </p>
                <div className="score-grid">
                  <ScorePill label="Price fit" value={meal.score.price} />
                  <ScorePill label="Convenience" value={meal.score.convenience} />
                  <ScorePill label="Freshness" value={meal.score.freshness} />
                  <ScorePill label="Filter fit" value={meal.score.fit} />
                </div>
                <div className="card-section">
                  <h4>Store plan</h4>
                  <div className="store-summary-list">
                    {meal.storePlan.map((store) => (
                      <div className="store-summary-item" key={store.storeName}>
                        <strong>{store.storeName}</strong>
                        <span>
                          ${store.subtotal.toFixed(2)} · {store.itemCount} item(s)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-section">
                  <h4>Shopping plan</h4>
                  <ul className="detail-list">
                    {meal.shoppingPlan.map((item) => (
                      <li key={`${meal.title}-${item.storeName}-${item.ingredient}`}>
                        <strong>{item.ingredient}</strong> from {item.storeName} for $
                        {item.price.toFixed(2)} ({item.quantityNote})
                        {item.saleLabel ? ` · ${item.saleLabel}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card-section">
                  <h4>Recipe steps</h4>
                  <ol className="detail-list detail-list-numbered">
                    {meal.instructions.map((step) => (
                      <li key={`${meal.title}-${step}`}>{step}</li>
                    ))}
                  </ol>
                </div>
                <p className="explanation">{meal.explanation}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <TrustExplainerModal
        open={isTrustExplainerOpen}
        onClose={() => {
          setIsTrustExplainerOpen(false);
          setHasDismissedTrustExplainer(true);
        }}
      />
    </section>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

function validateForm(form: FormState): {
  errors: FieldErrors;
  preferences?: MealPreferenceForm;
} {
  const errors: FieldErrors = {};

  const zipCode = form.zipCode.trim();
  if (!/^\d{5}$/.test(zipCode)) {
    errors.zipCode = "Enter a valid 5-digit ZIP code.";
  }

  const radiusMiles = parseNumberField(form.radiusMiles);
  if (radiusMiles === undefined || !Number.isInteger(radiusMiles) || radiusMiles < 1 || radiusMiles > 25) {
    errors.radiusMiles = "Choose a radius between 1 and 25 miles.";
  }

  const budget = parseNumberField(form.budget);
  if (budget === undefined || budget < 5 || budget > 40) {
    errors.budget = "Enter a budget between $5 and $40.";
  }

  const maxIngredients = parseNumberField(form.maxIngredients);
  if (
    maxIngredients === undefined ||
    !Number.isInteger(maxIngredients) ||
    maxIngredients < 3 ||
    maxIngredients > 12
  ) {
    errors.maxIngredients = "Choose between 3 and 12 ingredients.";
  }

  const dinnersWanted = parseNumberField(form.dinnersWanted);
  if (
    dinnersWanted === undefined ||
    !Number.isInteger(dinnersWanted) ||
    dinnersWanted < 1 ||
    dinnersWanted > 4
  ) {
    errors.dinnersWanted = "Choose between 1 and 4 dinner options.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    errors,
    preferences: {
      zipCode,
      radiusMiles: radiusMiles!,
      budget: budget!,
      maxIngredients: maxIngredients!,
      dinnersWanted: dinnersWanted!,
      shoppingStyle: form.shoppingStyle,
      dietaryFocus: form.dietaryFocus,
    },
  };
}

function parseNumberField(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDifficulty(difficulty: string) {
  return `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} cook`;
}

function formatStoreKind(kind: string) {
  return kind.replace("-", " ");
}

function formatLookupSource(source: string) {
  return source === "geocodio" ? "Geocodio lookup" : "Local ZIP fallback";
}

function formatDataSource(source: string) {
  return source === "database" ? "Postgres market data" : "Seed market data";
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrustExplainerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="trust-explainer-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
      >
        <div className="modal-header">
          <h3 id="trust-explainer-title">How to read these results</h3>
          <button className="secondary-button" onClick={onClose} type="button">
            Dismiss
          </button>
        </div>
        <div className="modal-copy">
          <p>
            Yum4Less is still an early local MVP, so these meal results should be
            read as <strong>helpful estimates</strong>, not guaranteed final
            checkout totals.
          </p>
          <p>
            <strong>Source</strong> tells you where the store and price
            information came from. If it says `Postgres market data`, Yum4Less is
            using the current local database. If it says `Seed market data`, the
            app had to fall back to built-in sample coverage.
          </p>
          <p>
            <strong>Freshness</strong> tells you how recent the current price
            information is. Newer pricing is more trustworthy. Older pricing is
            still useful, but it should be treated as more directional.
          </p>
          <p>
            <strong>Fallback</strong> means the app kept working by using a
            backup source, like a local ZIP lookup or seeded market data, when a
            preferred source was not available.
          </p>
          <p>
            <strong>Estimate quality</strong> helps explain how simple the plan
            is. A single-store estimate is usually easier to trust and follow.
            A multi-store estimate can still save money, but it depends on more
            moving parts.
          </p>
          <p>
            In short: use these labels to judge how much confidence to place in a
            result before deciding what to cook or where to shop.
          </p>
        </div>
      </div>
    </div>
  );
}

type RecommendationResponse =
  | {
      ok: true;
      experience: RecommendationExperience;
    }
  | {
      ok: false;
      error: string;
      providerConfigured: boolean;
    };
