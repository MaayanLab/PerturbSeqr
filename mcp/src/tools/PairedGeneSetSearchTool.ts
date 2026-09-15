import { z } from 'zod';
import { graphql } from '../api.js';
import { genes, enrichmentFilters, readOnly } from '../schemas.js';
import { geneSetFields } from '../fields.js';

const inputSchema = z.object({ genesUp: genes, genesDown: genes, ...enrichmentFilters,
  sortBy: z.enum(['pvalue_mimic', 'pvalue_reverse', 'adj_pvalue_mimic', 'adj_pvalue_reverse', 'odds_ratio_mimic', 'odds_ratio_reverse']).default('pvalue_mimic'),
}).strict();

export default ['paired_gene_set_search', {
  title: 'Paired Gene Set Search', description: 'Find mimicking and reversing perturbation signatures for up/down gene sets. Each result contains both directions and their reference gene-set IDs.',
  inputSchema, annotations: readOnly,
}, async (input: z.infer<typeof inputSchema>) => graphql(`query($genesUp:[String]!, $genesDown:[String]!, $libraryNames:[String],
  $filterTerm:String, $filterFda:Boolean, $first:Int!, $offset:Int!, $sortBy:String,
  $overlapGe:Int, $pvalueLe:Float, $adjPvalueLe:Float) {
  currentBackground { pairedEnrich(genesUp:$genesUp, genesDown:$genesDown, libraryNames:$libraryNames,
    filterTerm:$filterTerm, filterFda:$filterFda, first:$first, offset:$offset, sortby:$sortBy,
    overlapGe:$overlapGe, pvalueLe:$pvalueLe, adjPvalueLe:$adjPvalueLe) {
    totalCount geneSetCount nodes { geneSetIdUp geneSetIdDown geneSetHashUp geneSetHashDown
      pvalueMimic adjPvalueMimic oddsRatioMimic mimickerOverlap
      pvalueReverse adjPvalueReverse oddsRatioReverse reverserOverlap libraryCount supportingLibraries
      geneSet { nodes { ${geneSetFields} } } }
  } }
}`, input)] as const;
