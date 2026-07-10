/** Test-only helpers for mutating `process.env` under strict ProcessEnv typing. */

export function deleteProcessEnvKey(key: string): void {
  Reflect.deleteProperty(process.env, key);
}

export function buildTestProcessEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides,
  } as NodeJS.ProcessEnv;
}
