'use client';

export const dynamic = 'force-dynamic'

import Image from "next/image";
import Link from "next/link";
import { FaCopy } from "react-icons/fa";
import { singleGeneEnrich, upDownGeneSetEnrich, overlap, upDownOverlap, validGenes } from "./examples";

export default function UserManual() {
  return (
    <div className="prose">
      <div className="flex">
        <div className="flex-col mx-auto max-w-5xl">
          <h2 className="title text-2xl font-medium mb-3 mt-3 text-center">
            Perturb-Seqr Documentation
          </h2>
          <div className="text-center mb-6 mt-2">
            <h3 className="text-lg font-semibold mb-2">Table of Contents</h3>
            <ol className="list-decimal list-inside text-base inline-block text-left">
              <li><Link href="#getting-started" className="underline cursor-pointer" shallow>Getting Started</Link></li>
              <li><Link href="#dataset-filtering" className="underline cursor-pointer" shallow>Dataset Filtering</Link></li>
              <li><Link href="#bar-charts" className="underline cursor-pointer" shallow>Bar Charts</Link></li>
              <li><Link href="#up-down-gene-set-search" className="underline cursor-pointer" shallow>Up &amp; Down Gene Set Search</Link></li>
              <li><Link href="#gene-set-search" className="underline cursor-pointer" shallow>Single Gene Set Search</Link></li>
              <li><Link href="#dataset-visualizations" className="underline cursor-pointer" shallow>Dataset Visualizations</Link></li>
              <li><Link href="#metadata-search" className="underline cursor-pointer" shallow>Term Search</Link></li>
              <li><Link href="#download-page" className="underline cursor-pointer" shallow>Download Page</Link></li>
              <li><Link href="#api" className="underline cursor-pointer" shallow>API</Link></li>
            </ol>
          </div>
          <h2 className="title text-xl font-medium mb-3" id="getting-started">
            Getting Started
          </h2>
          <p>
            The Perturb-Seqr web application is a comprehensive Connectivity Mapping
            search engine that integrates 9 drug perturbation and 7 gene perturbation
            datasets into a single unifying resource. The application provides single
            gene set search, up and down gene set search, and term search.
            Additionally, Perturb-Seqr offers interactive UMAP visualizations and an
            API for programmatic access. To get started try submitting the included
            examples on the home page:
          </p>
          <figure className="my-4">
            <Image
              src="/images/home-default-updown.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The Perturb-Seqr home page with the example up and down gene set input form.
            </figcaption>
          </figure>
          <p>
            All search features are accompanied by dataset filtering, enabling users
            to select which drug and gene perturbation datasets are included in their
            results. Each gene set&apos;s p-value is computed against its own
            dataset-specific background (the union of all genes appearing in that
            dataset&apos;s gene sets), ensuring that statistical comparisons are
            internally consistent and that p-values are reproducible regardless of
            which datasets are selected. Once submitting either of the examples,
            results are returned as per-library bar graphs of the top significantly
            overlapping gene sets. This view of results spots the top hits from
            each library independently while making common directionality across
            the submitted gene set easy to spot:
          </p>
          <div className="flex flex-col md:flex-row gap-4 my-4">
            <figure className="flex-1">
              <Image
                src="/images/enrichpair-bar-charts.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg mx-auto"
              />
              <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
                Up and down gene set enrichment results, shown as per-library bar graphs.
              </figcaption>
            </figure>
            <figure className="flex-1">
              <Image
                src="/images/enrich-bar-charts.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg mx-auto"
              />
              <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
                Single gene set enrichment results, shown as per-library bar graphs.
              </figcaption>
            </figure>
          </div>
          <p>
            To see combined results sorted by p-value across all libraries, users
            can click the Table tab at the top of the results page. From here, you
            can apply additional filtering for FDA-approved drugs, for the
            directionality of the gene sets, as well as identify consensus
            mechanisms of action (MoAs), and consensus compounds seen across cell
            lines, time points and concentrations:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-table.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The combined table view shows results from all libraries sorted by adjusted p-value.
            </figcaption>
          </figure>
          <p>
            Additionally, users can apply dataset filtering on the results page to further narrow down results of interest.
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-dataset-dropdown.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Dataset filtering applied to the combined results table.
            </figcaption>
          </figure>
          <br></br>
          <h2 className="title text-xl font-medium mb-3" id="dataset-filtering">
            Dataset Filtering
          </h2>
          <p>
            Users can toggle individual datasets on or off to
            control which are included in their query. Cyan icons represent drug
            perturbation datasets while magenta icons represent gene perturbation
            datasets. By default, all datasets are selected.
          </p>
          <figure className="my-4">
            <Image
              src="/images/dataset-icons.gif"
              width={900}
              height={1000}
              alt={""}
              className="border rounded-lg mx-auto"
              unoptimized
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Toggling individual drug and gene perturbation datasets on and off.
            </figcaption>
          </figure>
          <p>
            Each gene set is always tested against its own dataset-specific
            background, so p-values remain reproducible regardless of which datasets are
            selected.
          </p>
          <p>
            Dataset filtering selections and gene set inputs will persist as long as the user navigates back using the &quot;RECOMPUTE&quot; button on the results page.
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-recompute-button.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The Recompute button at the top left of the results page (outlined in red) returns to the input form with all selections preserved.
            </figcaption>
          </figure>
          <hr className="my-10" />
          <h2 className="title text-xl font-medium mb-3" id="bar-charts">
            Bar Charts
          </h2>
          <p>
            Bar Charts is the default view for both single and paired enrichment
            results. On the paired up and down results page, each card shows
            the top ten mimicker and top ten reverser hits from one library.
            On the single gene set results page, each card shows the top ten
            up-regulated and top ten down-regulated hits from one library.
          </p>
          <p>
            Library cards are sorted by the geometric mean of the top ten
            adjusted p-values, pooled across up- and down-regulated hits for
            single enrichment and across mimicker and reverser hits for paired
            enrichment.
          </p>
          <p>
            Within each chart, bars are scaled in length and colored in
            saturation by p-value.
            Drug perturbation libraries use red and blue while gene
            perturbation libraries use orange and purple.
          </p>
          <p>
            Clicking on any library card opens the combined table filtered to
            that library only, allowing you to see the full results for a
            single library:
          </p>
          <figure className="my-4">
            <div className="flex flex-col md:flex-row gap-4 justify-center items-start">
              <Image
                src="/images/enrichpair-rummageo-card.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg w-full md:w-1/2 h-auto"
              />
              <Image
                src="/images/enrichpair-rummageo-table.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg w-full md:w-1/2 h-auto"
              />
            </div>
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Clicking a library card (left, RummaGEO Chem outlined in red) opens the combined table filtered to that library only (right).
            </figcaption>
          </figure>
          <hr className="my-10" />
          <h2
            className="title text-xl font-medium mb-3"
            id="up-down-gene-set-search"
          >
            Up & Down Gene Set Search
          </h2>
          <p>
          The up and down gene set search functionality enables users to search the
          Perturb-Seqr database for gene set pairs that most significantly mimic or
          reverse the expression of the submitted up and down gene sets. A
          Fisher&apos;s exact test is also used to assess the significance of these
          results, specifically measuring a mimicker overlap (up Perturb-Seqr gene
          set & up user gene set + down Perturb-Seqr gene set & down user gene set)
          and reverser overlap (up Perturb-Seqr gene set & down user gene set + down
          Perturb-Seqr gene set & up user gene set). Any significantly overlapping
          mimicker or reverser gene set is returned to the user along with their
          accompanying metadata. User query gene sets can be pasted or typed into
          the two input boxes with each gene on a new line, or the user may upload
          a file containing genes where the genes are listed with new line, tab,
          or comma separators:
          </p>
          <figure className="my-4">
            <Image
              src="/images/updown-input-form-example.png"
              width={700}
              height={500}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The up and down gene set input form, populated with the example.
            </figcaption>
          </figure>
          <p>
            The gene set search page displays the enrichment statistics, button
            filters, and mimicker and reverser overlaps which can be opened in
            a pop-up window and further explored:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrichpair-table.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Paired enrichment results shown in the combined table view.
            </figcaption>
          </figure>
          <br></br>
          <br></br>
          <h2 className="title text-xl font-medium mb-3 mt-10" id="gene-set-search">
            Single Gene Set Search
          </h2>
          <p>
          Perturb-Seqr also supports single gene set search against the database
          using Fisher&apos;s exact test. Any significantly overlapping gene sets
          are returned to the user along with their accompanying metadata. User
          query gene sets can be pasted or typed into the input form with each
          gene on a new line, or the user may upload a file containing genes
          where the genes are listed with new line, tab, or comma separators
          after switching to the single gene set option on the input form:
          </p>
          <figure className="my-4">
            <Image
              src="/images/single-input-form.png"
              width={600}
              height={500}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The single gene set input form, populated with the example.
            </figcaption>
          </figure>
          <p>
          Paginated results are returned with the total number of gene sets which the
          query was compared to and the number of those gene sets which were
          significantly enriched. The user may explore the metadata associated with the
          gene sets on each results page, by clicking on the icon next to the
          compound or gene perturbation, or on the underlined cell line:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-table.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The combined results table sorted by adjusted p-value, with filter buttons and search bar above.
            </figcaption>
          </figure>
          <p>
          Other information such as the directionality of the gene set, the number of
          overlapping genes, and the total number of genes in the enriched gene set
          are also displayed. Clicking the overlap or gene set size will open a
          pop-up window with the corresponding genes as well as buttons to copy the gene set to
          the clipboard, or to view the enrichment results on RummaGEO, Rummagene, or
          Enrichr:
          </p>
          <figure className="my-4">
            <div className="flex flex-col md:flex-row gap-4 justify-center items-start">
              <Image
                src="/images/enrich-overlap-click-target.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg w-full md:w-1/2 h-auto"
              />
              <Image
                src="/images/enrich-overlap-modal.png"
                width={700}
                height={500}
                alt={""}
                className="border rounded-lg w-full md:w-1/2 h-auto"
              />
            </div>
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Clicking an overlap count in the table (left, outlined in red) opens a pop-up window listing the genes shared between the query and the matched gene set (right).
            </figcaption>
          </figure>
          <p>
          To further filter and refine the results, the user may use the search bar
          located above the table to search for gene sets containing certain
          keywords. This allows, for instance, to view enriched results from the A549
          cell line based upon the same input gene set. The total number of enriched
          gene sets is updated accordingly:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-search-filter.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Results filtered to A549 cell line entries through the search bar.
            </figcaption>
          </figure>
          <p>
          Results may also be easily downloaded using the button to the far right of
          the search feature in a tab delimited format (for downloads of greater than
          100,000 results please refer to the downloads page):
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-download-button.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The download icon (outlined in red) sits at the far right of the search bar row.
            </figcaption>
          </figure>

          <p>
          Users may additionally filter results by the direction of the gene set, FDA approved drugs, drug or gene perturbation type, and dataset with the buttons above the table:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-filter-buttons.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The direction, FDA approved, perturbation type, and dataset filter buttons (outlined in red) sit above the table.
            </figcaption>
          </figure>
           <p>
          To generate consensus results, selecting the consensus perturbations button
          at the top of the table will compute significant compounds and gene
          perturbations using the Fisher&apos;s exact test, taking into account the
          number of significant and insignificant gene sets corresponding to that
          perturbation. P-values for the direction of the gene set are then generated
          for each significant consensus perturbation using the number of significant
          up and down, and insignificant up and down terms for that perturbation:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-consensus-perturbations.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Consensus perturbations computed across all matching signatures.
            </figcaption>
          </figure>
            <p>
          To identify the most common mechanisms of action and their directionality
          similar to the consensus compound feature, the consensus mechanism of
          action button can be selected. This will compute the number of significant
          and insignificant gene sets corresponding to that mechanism of action and
          generate p-values for the direction of the gene set using the number of
          significant up and down, and insignificant up and down terms for that
          mechanism of action:
          </p>
          <figure className="my-4">
            <Image
              src="/images/enrich-consensus-moas.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Consensus mechanisms of action with directional p-values.
            </figcaption>
          </figure>
          <br></br>
          <br></br>
          <h2
            className="title text-xl font-medium mb-3 mt-10"
            id="dataset-visualizations"
          >
            Dataset Visualizations
          </h2>
          <p>
            Users can explore the unique structure and clustering of each dataset
            through precomputed UMAP visualizations. Datasets can be selected from
            the dropdown menu. Hovering over points on the UMAP will display the
            corresponding term.
          </p>
          <figure className="my-4">
            <Image
              src="/images/explore-umap.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The precomputed UMAP for the LINCS L1000 XPR gene perturbation dataset.
            </figcaption>
          </figure>
          <br></br>
          <br></br>
          <h2
            className="title text-xl font-medium mb-3 mt-10"
            id="metadata-search"
          >
            Term Search
          </h2>
          Perturb-Seqr also provides direct metadata search of all dataset gene sets. Paginated results are returned with accompanying metadata of the returned gene sets:
          <figure className="my-4">
            <Image
              src="/images/term-search-results.png"
              width={1100}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Term search results for &quot;U2OS&quot;.
            </figcaption>
          </figure>
         These results can also be further filtered using the search bar at the top right of the table:
          <figure className="my-4">
            <Image
              src="/images/term-search-filter.png"
              width={1100}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Filtering term search results by library through the column filter dropdown.
            </figcaption>
          </figure>
          Term search results, formatted as a gene matrix transpose (GMT), or a metadata table can be downloaded in a tab-delimited format as well:
          <figure className="my-4">
            <Image
              src="/images/term-search-download.png"
              width={1100}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              Term search results can be downloaded as a GMT or a tab-delimited metadata table.
            </figcaption>
          </figure>
          <br></br>
          <br></br>
          <h2
            className="title text-xl font-medium mb-3 mt-10"
            id="download-page"
          >
            Download Page
          </h2>
          <p>
            All data is available in GMT format on the Download page. The term format
            for each dataset is shown, with each term format consistent up to the
            fifth position. Links to the original publication, Harmonizome, and full
            differential expression matrices are also available.
          </p>
          <figure className="my-4">
            <Image
              src="/images/download-page.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The Download page lists per-dataset GMTs along with publication and full DE matrix links.
            </figcaption>
          </figure>
          <br></br>
          <br></br>
          <h2 className="title text-xl font-medium mb-3 mt-10" id="api">
            API
          </h2>
          <p>
            Perturb-Seqr provides programmatic access through a GraphQL endpoint.
            Users can learn more about GraphQL queries from their provided{" "}
            <a className="underline cursor-pointer" href="https://graphql.org/learn/" target="_blank">
              documentation
            </a>
            . The Perturb-Seqr{" "}
            <Link className="underline cursor-pointer" href="/graphiql" target="_blank">
              GraphQL endpoint
            </Link>{" "}
            and associated Postgres database provide users with a wide range of
            available queries and with a user interface to test and develop
            these queries:
          </p>
          <figure className="my-4">
            <Image
              src="/images/graphiql.png"
              width={900}
              height={700}
              alt={""}
              className="border rounded-lg mx-auto"
            />
            <figcaption className="text-center text-xs italic text-base-content/60 mt-2">
              The built-in GraphiQL interface for testing and developing queries against the API.
            </figcaption>
          </figure>

          <h3 className="text-lg font-semibold mb-2 mt-6">Python wrapper: <code>perturbseqr-py</code></h3>
          <p>
            A Python wrapper around this GraphQL endpoint is also available.
            Standard queries return results directly into Python data
            structures such as pandas DataFrames.
          </p>

          {/* TODO(prose): one-line lead-in to the uv install command. */}
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-2 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <pre>
              <code>{`uv add \\
  "perturbseqr @ git+https://github.com/MaayanLab/PerturbSeqr.git#subdirectory=perturbseqr-py"`}</code>
            </pre>
          </div>

          <p>
            More information on the available functions and their parameters
            can be found at{" "}
            <a className="underline cursor-pointer"
              href="https://github.com/MaayanLab/PerturbSeqr/tree/main/perturbseqr-py"
              target="_blank">
              https://github.com/MaayanLab/PerturbSeqr/tree/main/perturbseqr-py
            </a>.
          </p>
          {/* numpy-style function docs: signature in a code block, then a
              short description, then a bulleted parameter list. */}
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-3 p-3 rounded-lg">
            <pre><code>{`ps.enrich(
    genes,
    *,
    libraries=None,
    top=100,
    sort_by="pvalue",
    filter_term="",
    filter_fda=False,
    filter_ko=False,
)`}</code></pre>
          </div>
          <p className="text-sm mt-2">Single gene set enrichment.</p>
          <dl className="text-sm ml-4 mt-1 mb-4">
            <dt className="font-semibold mt-2"><code>genes</code> : <em>list[str]</em></dt>
            <dd className="ml-6">Gene symbols.</dd>
            <dt className="font-semibold mt-2"><code>libraries</code> : <em>list[str], optional</em></dt>
            <dd className="ml-6">Restrict to these library names.</dd>
            <dt className="font-semibold mt-2"><code>top</code> : <em>int, default 100</em></dt>
            <dd className="ml-6">Max rows returned.</dd>
            <dt className="font-semibold mt-2"><code>sort_by</code> : <em>str, default &quot;pvalue&quot;</em></dt>
            <dd className="ml-6">Sort column.</dd>
            <dt className="font-semibold mt-2"><code>filter_term</code> : <em>str, default &quot;&quot;</em></dt>
            <dd className="ml-6">Substring filter on the term column.</dd>
            <dt className="font-semibold mt-2"><code>filter_fda</code> : <em>bool, default False</em></dt>
            <dd className="ml-6">Keep only FDA-approved drugs.</dd>
            <dt className="font-semibold mt-2"><code>filter_ko</code> : <em>bool, default False</em></dt>
            <dd className="ml-6">Keep only gene knockouts.</dd>
          </dl>

          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-3 p-3 rounded-lg">
            <pre><code>{`ps.enrich_pair(
    *,
    up,
    down,
    libraries=None,
    top=100,
    sort_by="pvalue_mimic",
    filter_term="",
    filter_fda=False,
    filter_ko=False,
    top_n=1000,
    pvalue_le=0.05,
)`}</code></pre>
          </div>
          <p className="text-sm mt-2">Paired up and down gene set enrichment.</p>
          <dl className="text-sm ml-4 mt-1 mb-4">
            <dt className="font-semibold mt-2"><code>up</code> : <em>list[str]</em></dt>
            <dd className="ml-6">Up-regulated gene symbols.</dd>
            <dt className="font-semibold mt-2"><code>down</code> : <em>list[str]</em></dt>
            <dd className="ml-6">Down-regulated gene symbols.</dd>
            <dt className="font-semibold mt-2"><code>libraries</code> : <em>list[str], optional</em></dt>
            <dd className="ml-6">Restrict to these library names.</dd>
            <dt className="font-semibold mt-2"><code>top</code> : <em>int, default 100</em></dt>
            <dd className="ml-6">Max rows returned.</dd>
            <dt className="font-semibold mt-2"><code>sort_by</code> : <em>str, default &quot;pvalue_mimic&quot;</em></dt>
            <dd className="ml-6">Sort column.</dd>
            <dt className="font-semibold mt-2"><code>filter_term</code> : <em>str, default &quot;&quot;</em></dt>
            <dd className="ml-6">Substring filter on the term column.</dd>
            <dt className="font-semibold mt-2"><code>filter_fda</code> : <em>bool, default False</em></dt>
            <dd className="ml-6">Keep only FDA-approved drugs.</dd>
            <dt className="font-semibold mt-2"><code>filter_ko</code> : <em>bool, default False</em></dt>
            <dd className="ml-6">Keep only gene knockouts.</dd>
            <dt className="font-semibold mt-2"><code>top_n</code> : <em>int, default 1000</em></dt>
            <dd className="ml-6">Max library size considered.</dd>
            <dt className="font-semibold mt-2"><code>pvalue_le</code> : <em>float, default 0.05</em></dt>
            <dd className="ml-6">Keep only rows with p ≤ this.</dd>
          </dl>

          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-3 p-3 rounded-lg">
            <pre><code>{`ps.term_search(
    query,
    *,
    libraries=None,
    top=10,
)`}</code></pre>
          </div>
          <p className="text-sm mt-2">Search gene set terms by substring.</p>
          <dl className="text-sm ml-4 mt-1 mb-4">
            <dt className="font-semibold mt-2"><code>query</code> : <em>str | list[str]</em></dt>
            <dd className="ml-6">Substring(s) to match.</dd>
            <dt className="font-semibold mt-2"><code>libraries</code> : <em>list[str], optional</em></dt>
            <dd className="ml-6">Restrict to these library names.</dd>
            <dt className="font-semibold mt-2"><code>top</code> : <em>int, default 10</em></dt>
            <dd className="ml-6">Max rows returned.</dd>
          </dl>
          <p className="text-sm font-semibold mt-6 mb-2">Realistic example</p>
          <p className="text-sm mb-2">Putting the three functions together against the Perturb-Seqr endpoint:</p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-2 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <pre>
              <code>{`import perturbseqr as ps

# Single gene set enrichment
df = ps.enrich(["RASD1", "S100P", "TRIM51", "PDK4", "TIPARP", "TUBA3E", ...])

# Restrict libraries and result count
df = ps.enrich(genes, libraries=["LINCS L1000 CP"], top=25)

# Up/down (paired) enrichment
df = ps.enrich_pair(up=[...], down=[...])

# Search gene set terms by substring
df = ps.term_search("STAT3")`}</code>
            </pre>
          </div>

          <h3 className="text-lg font-semibold mb-2 mt-6">Calling the GraphQL endpoint directly</h3>
          <p>
            The GraphQL endpoint can also be queried directly. The examples
            below use Python&apos;s <code>requests</code> library. Single
            gene set enrichment, with the optional <code>library_names</code>
            parameter restricting results to specific datasets:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(singleGeneEnrich)}><FaCopy/></button>
            <pre>
              <code>
                {singleGeneEnrich}
              </code>
            </pre>
          </div>
          <br />
          <p>Paired up and down gene set enrichment:</p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(upDownGeneSetEnrich)}><FaCopy/></button>
            <pre>
              <code>
                {upDownGeneSetEnrich}
              </code>
            </pre>
          </div>
          <br />
          <p>
            Overlapping genes can be retrieved using the gene set ids
            returned by either enrichment query above:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(overlap)}><FaCopy/></button>
            <pre>
              <code>
                {overlap}
              </code>
            </pre>
          </div>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(upDownOverlap)}><FaCopy/></button>
            <pre>
              <code>
                {upDownOverlap}
              </code>
            </pre>
          </div>
          <br />
          <p>
            To find the overlap between a user gene set and the Perturb-Seqr
            background, returning converted symbols:
          </p>
          <div className="text-gray bg-slate-300 dark:bg-slate-700 text-xs font-mono mt-5 p-5 rounded-lg box-content sm:max-w-xl sm:overflow-scroll md:max-w-xl lg:max-w-3xl xl:max-w-full">
            <button className="float-right" onClick={() => navigator.clipboard.writeText(validGenes)}><FaCopy/></button>
            <pre>
              <code>
                {validGenes}
              </code>
            </pre>
          </div>
          <br />
          <p className="">
            Perturb-Seqr is actively being developed by{" "}
            <Link
              className="underline cursor"
              href="https://labs.icahn.mssm.edu/maayanlab/"
              target="_blank"
            >
              the Ma&apos;ayan Lab
            </Link>
            .
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Back to top"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 btn btn-circle shadow-lg bg-base-100 z-50 print:hidden"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑
      </button>
    </div>
  );
}
