import { z } from 'zod';
import { graphql } from '../api.js';
import { pagination, libraryNames, readOnly } from '../schemas.js';
import { geneSetFields } from '../fields.js';

const inputSchema = z.object({ terms: z.array(z.string().trim().min(1)).min(1), libraryNames, ...pagination }).strict();
export default ['term_search', {
  title: 'Term Search', description: 'Find reference signatures that match term substring, such as a drug, gene, or cell line.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($terms:[String]!, $libraryNames:[String], $first:Int!, $offset:Int!) {
  geneSetTermSearch(terms:$terms, libraryNames:$libraryNames, first:$first, offset:$offset) {
    totalCount nodes { ${geneSetFields} }
  }
}`, input)] as const;
