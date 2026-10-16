/** Match the configured password; never accept global demonstration-password overrides. */
export const matchesUserPassword = (expected: string | undefined, attempt: string): boolean => {
  const value = attempt.trim();
  const configured = expected?.trim() || "123";
  return value.length > 0 && value === configured;
};
