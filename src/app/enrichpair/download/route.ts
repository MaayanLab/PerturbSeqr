import {
  EnrichmentQueryDocument,
  EnrichmentQueryQuery,
  FetchUserGeneSetDocument,
  FetchUserGeneSetQuery,
} from "@/graphql";
import { getClient } from "@/lib/apollo/client";
import ensureArray from "@/utils/ensureArray";
import streamTsv from "@/utils/streamTsv";
import {paginatedPairNodeGenerator, paginatedPairConsensusGenerator, paginatedPairMoAsGenerator} from "@/utils/paginatedGenerators";
import { DEFAULT_CONSENSUS_TOP_N_SIGNATURES, DEFAULT_PVALUE_CUTOFF, MAX_DOWNLOAD_RESULT_COUNT } from "@/constants/enrichment";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("q") || "";
  const datasetUp =  searchParams.get("datasetup");
  const datasetDown = searchParams.get("datasetdown");
  const consensusFilter = searchParams.get("consensus") || "false";
  const MoAsFilter = searchParams.get("moas") || "false";
  const filterKo = searchParams.get("ko") || "false";
  const filterFda = searchParams.get("fda") || "false";
  const dir = searchParams.get("dir") || "";
  const sort = searchParams.get("sort") || "pvalue";
  const topN = searchParams.get("topn") || String(DEFAULT_CONSENSUS_TOP_N_SIGNATURES);
  const maxTotal = searchParams.get("maxTotal") || String(MAX_DOWNLOAD_RESULT_COUNT);
  const pvalueLe = searchParams.get("pvaluele") || String(DEFAULT_PVALUE_CUTOFF);
  const ds = searchParams.get("ds") || "";
  const dsArray = ds ? ds.split(",").filter(Boolean) : null;
  const libraries = searchParams.get("libraries") || "";
  const librariesArray = libraries ? libraries.split(",").filter(Boolean) : null;

  console.log(datasetUp, datasetDown)

  const { data: userGeneSetUp, error: userGeneSetErrorUp } =
    await getClient().query<FetchUserGeneSetQuery>({
      query: FetchUserGeneSetDocument,
      variables: { id: datasetUp },
    });
  if (userGeneSetErrorUp) throw new Error(userGeneSetErrorUp.message);

  const genesUp = ensureArray(userGeneSetUp.userGeneSet?.genes)
    .filter((gene): gene is string => !!gene)
    .map((gene) => gene.toUpperCase());

  const { data: userGeneSetDown, error: userGeneSetErrorDown } =
    await getClient().query<FetchUserGeneSetQuery>({
      query: FetchUserGeneSetDocument,
      variables: { id: datasetDown },
    });
  if (userGeneSetErrorDown) throw new Error(userGeneSetErrorDown.message);

  const genesDown = ensureArray(userGeneSetDown.userGeneSet?.genes)
    .filter((gene): gene is string => !!gene)
    .map((gene) => gene.toUpperCase());
  
  if (genesUp.length === 0 || genesDown.length === 0) {
    return new Response("At least one gene set is empty", { status: 400 });
  } else if (consensusFilter === "true") {
       return new Response(
          streamTsv(
            [
                "drug",
                "countSig",
                "countInsig",
                "countUpSig",
                "countDownSig",
                "oddsRatio",
                "pvalueUp",
                "adjPvalueUp",
                "oddsRatioUp",
                "pvalueDown",
                "adjPvalueDown",
                "oddsRatioDown",
            ],
            paginatedPairConsensusGenerator(
              genesUp,
              genesDown,
              term + " " + dir,
              filterFda === "true",
              filterKo === "true",
              parseInt(topN),
              sort
            ),
            (item) => item
          ),
          {
            headers: {
              "Content-Type": "text/tab-separated-values",
            },
          }
        );
      } else if (MoAsFilter === "true") {

        return new Response(
          streamTsv(
            [
                "drug",
                "countSig",
                "countInsig",
                "countUpSig",
                "countDownSig",
                "oddsRatio",
                "pvalueUp",
                "adjPvalueUp",
                "oddsRatioUp",
                "pvalueDown",
                "adjPvalueDown",
                "oddsRatioDown",
            ],
            paginatedPairMoAsGenerator(
              genesUp,
              genesDown,
              term + " " + dir,
              filterFda === "true",
              filterKo === "true",
              parseInt(topN),
              sort
            ),
            (item) => item
          ),
          {
            headers: {
              "Content-Type": "text/tab-separated-values",
            },
          }
        );
      } else {
        return new Response(
          streamTsv(
            [
              "dataset",
              "perturbation",
              "perturbationId",
              "cellLine",
              "timepoint",
              "concentration",
              "signatureCount",
              "moa",
              "fdaApproved",
              "geneSetSizeUp",
              "geneSetSizeDown",
              "nMimicOverlap",
              "oddsRatioMimic",
              "pvalueMimic",
              "adjPvalueMimic",
              "nReverseOverlap",
              "oddsRatioReverse",
              "pvalueReverse",
              "adjPvalueReverse",
            ],
            paginatedPairNodeGenerator(
              genesUp,
              genesDown,
              term + " " + dir,
              filterFda === "true",
              filterKo === "true",
              parseInt(topN),
              sort,
              parseInt(maxTotal),
              parseFloat(pvalueLe),
              dsArray,
              librariesArray
            ),
            (item) => item
          ),
          {
            headers: {
              "Content-Type": "text/tab-separated-values",
            },
          }
        );
      }
}
