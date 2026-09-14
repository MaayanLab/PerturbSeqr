import { z } from 'zod';

export const genes = z.array(z.string().trim().min(1).toUpperCase()).min(1).max(3000).describe('Gene symbols; case is normalized as in the website.');
export const pagination = {
  first: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
};
export const genePagination = { ...pagination, first: z.number().int().min(1).max(10000).default(1000) };
export const libraryNames = z.array(z.string().min(1)).min(1).optional().describe('Exact library names returned by list_datasets; omit to search all libraries.');
export const enrichmentFilters = {
  ...pagination, libraryNames,
  filterTerm: z.string().default(''),
  filterFda: z.boolean().default(false),
  overlapGe: z.number().int().min(1).default(1),
  pvalueLe: z.number().min(0).max(1).default(0.05),
  adjPvalueLe: z.number().min(0).max(1).default(0.05),
};
export const readOnly = { readOnlyHint: true };
