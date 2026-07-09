/** Decorative bullets TheMealDB sometimes emits as standalone "steps". */
const JUNK_STEP_PATTERN = /^[▢□■●•\-\s]+$/u;

export function normalizeRecipeInstructionSteps(steps: readonly string[]): string[] {
  return steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0 && !JUNK_STEP_PATTERN.test(step));
}
