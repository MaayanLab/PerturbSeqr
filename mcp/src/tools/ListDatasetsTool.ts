import { z } from 'zod';
import { graphql } from '../api.js';
import { pagination, readOnly } from '../schemas.js';

const inputSchema = z.object({ ...pagination, first: z.number().int().min(1).max(100).default(100) }).strict();
export default ['list_datasets', {
  title: 'List Datasets', description: 'List available gene-set libraries, exact names for libraryNames filters, library IDs, and stored signature counts.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($first:Int!, $offset:Int!) {
  geneSetLibraries(first:$first,offset:$offset,orderBy:NAME_ASC) { totalCount nodes { id name description geneSetsByLibraryId { totalCount } } }
}`, input)] as const;
