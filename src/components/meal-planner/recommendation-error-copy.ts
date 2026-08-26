export type MealPlannerClientError = {
  title: string;
  body: string;
  hint?: string;
};

export function mapRecommendationApiError(input: {
  httpStatus: number;
  error?: string;
  providerConfigured?: boolean;
}): MealPlannerClientError {
  const apiError = input.error?.trim() ?? "";

  if (input.httpStatus === 400) {
    if (apiError.includes("valid JSON")) {
      return {
        title: "Could not read your request",
        body: "Something went wrong sending meal preferences. Refresh the page and try again.",
      };
    }

    if (apiError.toLowerCase().includes("too large")) {
      return {
        title: "Too much store data to rank at once",
        body:
          "Your nearby-store search returned more data than this meal ranking request allows. Try a smaller radius, then search again before suggesting recipes.",
        hint: "Find nearby stores again with a smaller radius, then select sale ingredients and suggest recipes.",
      };
    }

    if (
      apiError.includes("Market snapshot payload is invalid") ||
      apiError.includes("Market snapshot store readiness counts are inconsistent") ||
      apiError.includes("Market snapshot radius does not match") ||
      apiError.includes("Market snapshot location does not match") ||
      apiError.includes("Market snapshot ZIP does not match")
    ) {
      return {
        title: "Store search is out of date",
        body:
          apiError ||
          "The saved store list no longer matches this location. Find nearby stores again, then suggest recipes.",
        hint: "Search for stores again in Step 1 before ranking meals.",
      };
    }

    if (apiError.includes("Recommendation request payload is invalid")) {
      return {
        title: "Check your meal preferences",
        body: "Spending limit must be between $5 and $40 and search radius 1–25 miles. Check selected sale ingredients and dietary filters.",
        hint: "Adjust Step 2 filters or select more sale ingredients before ranking.",
      };
    }

    return {
      title: "We could not suggest recipes yet",
      body: apiError || "Try searching for stores again or adjusting your filters.",
    };
  }

  if (input.httpStatus === 404) {
    if (
      apiError.toLowerCase().includes("unsupported zip") ||
      apiError.toLowerCase().includes("continental")
    ) {
      return {
        title: "Location is outside the beta service area",
        body: apiError || "Yum4Less beta v1 supports continental US ZIP codes only.",
        hint: "Try a nearby ZIP or use browser location inside the continental US.",
      };
    }

    if (input.providerConfigured === false) {
      return {
        title: "ZIP lookup is limited in this environment",
        body:
          apiError ||
          "Geocoding is not fully configured, so only a short local ZIP list is available.",
        hint: "Use geolocation or enter any continental US ZIP. Add GEOCODIO_API_KEY for ZIP lookup beyond the local seed set.",
      };
    }

    return {
      title: "Could not resolve that location",
      body:
        apiError ||
        "We could not turn that ZIP or browser location into a market search.",
      hint: "Confirm the ZIP, widen the radius, or search for stores again in Step 1.",
    };
  }

  if (input.httpStatus >= 500) {
    return {
      title: "Recommendations are temporarily unavailable",
      body:
        apiError ||
        "Yum4Less could not load ranked meal estimates right now. Ingested prices may still be refreshing.",
      hint: "Try again in a few minutes after daily ingest completes.",
    };
  }

  return {
    title: "We could not suggest recipes yet",
    body: apiError || "Try searching for stores again or adjusting your filters.",
  };
}

export function mapMarketSearchApiError(input: {
  httpStatus: number;
  error?: string;
  providerConfigured?: boolean;
}): MealPlannerClientError {
  const apiError = input.error?.trim() ?? "";

  if (input.httpStatus === 400) {
    return {
      title: "Check your location search",
      body: "ZIP must be five digits (or use browser location) and radius must be 1–25 miles.",
    };
  }

  if (input.httpStatus === 404) {
    if (
      apiError.toLowerCase().includes("unsupported zip") ||
      apiError.toLowerCase().includes("continental")
    ) {
      return {
        title: "Location is outside the beta service area",
        body: apiError || "Yum4Less beta v1 supports continental US ZIP codes only.",
        hint: "Try a nearby ZIP inside the continental US.",
      };
    }

    if (input.providerConfigured === false) {
      return {
        title: "ZIP lookup is limited in this environment",
        body:
          apiError ||
          "Geocoding is not fully configured, so only a short local ZIP list is available.",
        hint: "Use geolocation or enter any continental US ZIP. Add GEOCODIO_API_KEY for ZIP lookup beyond the local seed set.",
      };
    }

    return {
      title: "Could not find stores for that location",
      body: apiError || "We could not resolve that ZIP or browser location.",
      hint: "Try another ZIP, widen the radius, or check location permissions.",
    };
  }

  if (input.httpStatus >= 500) {
    return {
      title: "Store lookup is temporarily unavailable",
      body: apiError || "Nearby store search failed on the server. Try again shortly.",
    };
  }

  return {
    title: "We could not find nearby stores yet",
    body: apiError || "Try another ZIP, a different radius, or browser location.",
  };
}
