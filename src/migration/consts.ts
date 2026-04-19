/**
 * Regex for ISO timestamp like format with Windows-compatible separators
 * (e.g., 2024-01-15T10-30-45.123Z ; uses `-` instead of `:` for time)
 */
export const MIGRATION_NAME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;
