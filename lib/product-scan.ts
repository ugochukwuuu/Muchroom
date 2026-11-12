import { categories } from './types';

export const maxScanBytes = 4 * 1024 * 1024;

export const suggestionFields = {
  name: 100,
  brand: 100,
  category: 30,
  description: 2000,
  'variant name': 100,
  specs: 2000,
  uses: 300,
} as const;

export type SuggestionField = keyof typeof suggestionFields;

export function cleanSuggestions(value: unknown): Partial<Record<SuggestionField, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Partial<Record<SuggestionField, string>> = {};
  const data = value as Record<string, unknown>;
  for (const field of Object.keys(suggestionFields) as SuggestionField[]) {
    const entry = data[field];
    if (typeof entry !== 'string') continue;
    const clean = entry.trim().slice(0, suggestionFields[field]);
    if (clean && (field !== 'category' || categories.some(category => category === clean))) result[field] = clean;
  }
  return result;
}
