import "@testing-library/jest-dom/vitest";

/**
 * Existing calendar tests expect the dates America/New_York produces.
 * Production has no default: an unset YUM4LESS_BUSINESS_TIME_ZONE throws.
 * This pin is test-only. A test that needs the unset path deletes the variable
 * and restores it.
 */
process.env.YUM4LESS_BUSINESS_TIME_ZONE ??= "America/New_York";
