export const TERMS_TITLE = "Terms of use";

export const TERMS_PARAGRAPHS: readonly string[] = [
  "Yum4Less is a beta dinner planner. It is not a checkout, coupon, or price-guarantee service. Meal totals are estimates. Always verify price, package size, and deals in the store before you buy.",
  "There are no shopper accounts in this version. Location preferences stay on this device. We do not store your exact browser GPS in Settings. A ZIP code may be saved so we can find nearby stores.",
  "Recipes shown to shoppers come from TheMealDB meals with a full recipe page. Recipe pages and store websites have their own terms.",
  "Feedback is an anonymous tip form, not a public review wall. Do not include personal information, receipts, or contact details.",
  "If these terms do not work for you, do not use the app.",
] as const;

export function collectTermsText(): string {
  return TERMS_PARAGRAPHS.join(" ");
}
