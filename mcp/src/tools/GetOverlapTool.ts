import { z } from 'zod';
import { graphql } from '../api.js';
import { genes, genePagination, readOnly } from '../schemas.js';

const inputSchema = z.object({ id: z.uuid(), genes, ...genePagination }).strict();
export default ['get_overlap', {
  title: 'Get Query–Signature Overlap', description: 'Retrieve genes shared by an input gene set and one reference signature ID. For paired results, query the desired up/down arms separately.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($id:UUID!, $genes:[String]!, $first:Int!, $offset:Int!) {
  geneSet(id:$id) { id term overlap(genes:$genes,first:$first,offset:$offset) { totalCount nodes { symbol ncbiGeneId description summary } } }
}`, input)] as const;
