import { API_LIMITS } from "@/lib/api-request";

/** Client form defense-in-depth; API accepts up to {@link API_LIMITS.budget.max}. */
export const FORM_BUDGET_LIMITS = { min: 5, max: 40 } as const;

export { API_LIMITS };
