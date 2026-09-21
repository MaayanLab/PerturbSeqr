import { z } from 'zod';
import { graphql } from '../api.js';
import { genePagination, readOnly } from '../schemas.js';

const inputSchema = z.object({ id: z.uuid(), ...genePagination }).strict();
export default ['get_gene_set_genes', {
  title: 'Get Reference Gene Set Members', description: 'Retrieve signature genes and annotations. Paginate until totalCount is reached before using a large signature as enrichment input.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($id:UUID!, $first:Int!, $offset:Int!) {
  geneSet(id:$id) { id term nGeneIds genes(first:$first,offset:$offset) { totalCount nodes { id symbol synonyms ncbiGeneId description summary } } }
}`, input)] as const;
