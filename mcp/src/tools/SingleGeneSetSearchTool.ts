import { z } from 'zod';
import { graphql } from '../api.js';
import { genes, enrichmentFilters, readOnly } from '../schemas.js';
import { geneSetFields } from '../fields.js';

const inputSchema = z.object({ genes, ...enrichmentFilters,
  sortBy: z.enum(['pvalue', 'adj_pvalue', 'odds_ratio', 'overlap']).default('pvalue'),
}).strict();

export default ['single_gene_set_search', {
  title: 'Single Gene Set Search', description: 'Find perturbation signatures enriched for a gene set. Returns per-signature statistics, library support, and signature counts.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($genes:[String]!, $libraryNames:[String],
  $filterTerm:String, $filterFda:Boolean, $first:Int!, $offset:Int!, $sortBy:String,
  $overlapGe:Int, $pvalueLe:Float, $adjPvalueLe:Float) {
  currentBackground { enrich(genes:$genes, libraryNames:$libraryNames, filterTerm:$filterTerm,
    filterFda:$filterFda, first:$first, offset:$offset, sortby:$sortBy,
    overlapGe:$overlapGe, pvalueLe:$pvalueLe, adjPvalueLe:$adjPvalueLe) {
    totalCount geneSetCount nodes { geneSetHash pvalue adjPvalue oddsRatio nOverlap libraryCount supportingLibraries
      geneSets { nodes { ${geneSetFields} } } }
  } }
}`, input)] as const;
