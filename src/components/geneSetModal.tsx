import React from "react";
import classNames from "classnames";
import blobTsv from "@/utils/blobTsv";
import clientDownloadBlob from "@/utils/clientDownloadBlob";
import EnrichrGeneSetSubmissionButton from "./enrichrGeneSetSubmissionButton";
import RummageneGeneSetSubmissionButton from "./rummageneGeneSetSubmissionButton";
import RummageoGeneSetSubmissionButton from "./rummageoGeneSetSubmissionButton";
import GsfmGeneSetSubmissionButton from "./gsfmGeneSetSubmissionButton";
import { PerturbseqrSingleGeneSetSubmissionButton, PerturbseqrPairedGeneSetSubmissionButton } from "./perturbseqrGeneSetSubmissionButtons";

type GeneNode = {
  gene?: string | null;
  symbol?: string | null;
  ncbiGeneId?: number | null;
  description?: string | null;
  summary?: string | null;
};

type GeneList = (GeneNode | null | undefined)[] | undefined;

const geneNodes = (list?: GeneList): GeneNode[] =>
  (list ?? []).filter((g): g is GeneNode => !!(g?.symbol || g?.gene));

const geneSymbols = (list?: GeneList): string[] =>
  geneNodes(list).map((g) => (g.symbol || g.gene) as string);

function downloadTsv<I, K extends string, O extends Record<K, string | number | null | undefined>>(
  filename: string,
  columns: K[],
  rows: I[],
  transform: (item: I) => O
) {
  clientDownloadBlob(blobTsv(columns, rows, transform), filename);
}

function ExpandableText({ text }: { text: string }) {
  const [more, setMore] = React.useState(false);
  const startText = React.useMemo(() => text.split(". ")[0], [text]);
  if (!text) return null;
  return (
    <>
      {more ? text : startText}
      &nbsp;
      <button className="text-blue-500" onClick={() => setMore((m) => !m)}>
        {more ? "Show Less" : "Show More"}
      </button>
    </>
  );
}

function DownloadButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="btn btn-sm btn-outline text-xs" type="button" disabled={disabled} onClick={onClick}>
      Download Table
    </button>
  );
}

/** Copy-to-clipboard button with a green confirmation flash. */
function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  return (
    <button
      className="btn btn-sm btn-outline text-xs transition-colors duration-500"
      type="button"
      onClick={(evt) => {
        const button = evt.currentTarget;
        const prev = button.style.backgroundColor;
        button.style.backgroundColor = "green";
        setTimeout(() => (button.style.backgroundColor = prev), 500);
        navigator.clipboard.writeText(getText());
      }}
    >
      {label}
    </button>
  );
}

function GeneTable({ rows, pinCols = false }: { rows: GeneNode[]; pinCols?: boolean }) {
  return (
    <table className={classNames("table table-xs table-pin-rows", { "table-pin-cols": pinCols })}>
      <thead className="bg-white dark:bg-slate-800 sticky top-0">
        <tr>
          <th>Symbol</th>
          <th>Description</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((gene) => (
          <tr key={gene.symbol ?? gene.gene}>
            <td className="font-bold">
              {gene.symbol ?? gene.gene}
              {gene.ncbiGeneId && (
                <a
                  href={`https://www.ncbi.nlm.nih.gov/gene/${gene.ncbiGeneId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 ml-1 font-normal"
                >
                  (NCBI)
                </a>
              )}
            </td>
            <td>{gene.description ?? ""}</td>
            <td>
              <ExpandableText text={gene.summary ?? ""} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GenePane({ label, data, emptyHint, className }: { label: string; data?: GeneList; emptyHint: string; className?: string }) {
  const rows = geneNodes(data);
  return (
    <div className={classNames("flex-1 flex flex-col overflow-hidden min-w-0", className)}>
      <p className="text-center font-semibold text-gray-700 dark:text-white py-1 flex-shrink-0">
        {label} ({rows.length})
      </p>
      <div className="overflow-auto flex-grow border-t border-slate-200">
        {rows.length === 0 ? (
          <p className="text-center text-gray-400 p-4">{emptyHint}</p>
        ) : (
          <GeneTable rows={rows} />
        )}
      </div>
    </div>
  );
}

function SingleBody({ geneset, genes, term }: { geneset?: GeneList; genes: string[]; term?: string | null }) {
  return (
    <div className="p-2 text-slate-500 text-sm leading-relaxed whitespace-pre-line overflow-hidden flex flex-grow flex-shrink">
      <div className="flex flex-col w-full">
        {geneset ? (
          <div className="overflow-x-auto block">
            <GeneTable rows={geneNodes(geneset)} pinCols />
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="loading loading-ring w-24"></span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
          <DownloadButton
            disabled={!geneset}
            onClick={() =>
              downloadTsv(`${term || "gene_set"}.tsv`, ["symbol", "description", "summary"], geneNodes(geneset), (g) => ({
                symbol: g.symbol ?? g.gene,
                description: g.description,
                summary: g.summary,
              }))
            }
          />
          <CopyButton label="Copy Symbols to Clipboard" getText={() => genes.join("\n")} />
          <EnrichrGeneSetSubmissionButton genes={genes} description={term} />
          <RummageneGeneSetSubmissionButton genes={genes} description={term} />
          <RummageoGeneSetSubmissionButton genes={genes} description={term} />
          <GsfmGeneSetSubmissionButton genes={genes} description={term} />
          <PerturbseqrSingleGeneSetSubmissionButton genes={genes} description={term} />
        </div>
      </div>
    </div>
  );
}

function PairedBody({ upSet, downSet, upGenes, downGenes, baseTerm }: {
  upSet?: GeneList;
  downSet?: GeneList;
  upGenes: string[];
  downGenes: string[];
  baseTerm: string;
}) {
  const dirRows = (list?: GeneList, direction?: string) =>
    geneNodes(list).map((g) => ({ direction, symbol: g.symbol ?? g.gene, description: g.description, summary: g.summary }));
  return (
    <>
      <div className="flex flex-row flex-grow overflow-hidden p-2 gap-2 text-slate-500 text-sm leading-relaxed">
        <GenePane label="Up Genes" data={upSet} emptyHint="No up gene set found." className="border-r border-solid border-slate-200 pr-2" />
        <GenePane label="Down Genes" data={downSet} emptyHint="No paired down gene set found." />
      </div>
      <div className="flex flex-wrap items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
        <DownloadButton
          onClick={() =>
            downloadTsv(
              `${baseTerm || "gene_set"}_paired.tsv`,
              ["direction", "symbol", "description", "summary"],
              [...dirRows(upSet, "up"), ...dirRows(downSet, "down")],
              (r) => r
            )
          }
        />
        <CopyButton label="Copy Up Symbols" getText={() => upGenes.join("\n")} />
        <CopyButton label="Copy Down Symbols" getText={() => downGenes.join("\n")} />
        <PerturbseqrPairedGeneSetSubmissionButton
          genesUp={upGenes}
          genesDown={downGenes}
          descriptionUp={baseTerm ? `${baseTerm} up` : undefined}
          descriptionDown={baseTerm ? `${baseTerm} down` : undefined}
        />
      </div>
    </>
  );
}

export default function GeneSetModal({
  geneset,
  geneset2,
  term,
  dataset,
  showModal,
  setShowModal,
  tabbed = false,
}: {
  geneset?: GeneList;
  geneset2?: GeneList;
  term: string | null | undefined;
  dataset?: string | null | undefined;
  showModal?: boolean;
  setShowModal: (show: boolean) => void;
  /** Term-search mode: render SINGLE / PAIRED tabs. `geneset` is the viewed set, `geneset2` its pair. */
  tabbed?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = React.useState<"single" | "paired">("single");

  const genes = geneSymbols(geneset);
  const genesDown = geneSymbols(geneset2);
  const baseTerm = (term ?? "").replace(/ (up|down|dn)$/i, "").trim();

  // In tabbed mode geneset2 is the opposite-direction pair, so order up/down by the viewed term's
  // direction. In classic paired mode (enrichpair) geneset is already the up set.
  const viewedIsDown = tabbed && / (down|dn)$/i.test(term ?? "");
  const upSet = viewedIsDown ? geneset2 : geneset;
  const downSet = viewedIsDown ? geneset : geneset2;
  const upGenes = viewedIsDown ? genesDown : genes;
  const downGenes = viewedIsDown ? genes : genesDown;

  const pairAvailable = genesDown.length > 0;
  const showingPaired = tabbed ? activeTab === "paired" && pairAvailable : geneset2 !== undefined;

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.addEventListener("close", () => setShowModal(false));
  }, [ref, setShowModal]);
  React.useEffect(() => {
    if (showModal) ref.current?.showModal();
  }, [ref, showModal]);
  React.useEffect(() => setActiveTab("single"), [term]);

  return (
    <dialog className="modal" ref={ref}>
      <div className="modal-box w-11/12 max-w-screen-xl h-5/6 overflow-hidden flex flex-col p-0">
        <p className="text-lg text-center text-gray-900 dark:text-white flex-shrink-0 py-2">
          {!tabbed && showingPaired ? "Paired Gene Sets" : `Gene Set (${geneset ? geneset.length : "n"})`}
        </p>
        {dataset && <p className="text-sm text-center text-gray-500 dark:text-gray-400">{dataset}</p>}
        <p className="text-base text-center text-gray-600 dark:text-white">
          {!tabbed && showingPaired ? baseTerm : term}
        </p>

        {tabbed && (
          <div className="flex justify-center gap-2 py-2 flex-shrink-0">
            <button
              type="button"
              className={classNames("btn btn-sm", activeTab === "single" ? "btn-neutral" : "btn-outline")}
              onClick={() => setActiveTab("single")}
            >
              SINGLE GENE SET
            </button>
            <button
              type="button"
              disabled={!pairAvailable}
              title={pairAvailable ? undefined : "No paired gene set found for this term"}
              className={classNames("btn btn-sm", showingPaired ? "btn-neutral" : "btn-outline")}
              onClick={() => setActiveTab("paired")}
            >
              PAIRED GENE SET
            </button>
          </div>
        )}

        {showingPaired ? (
          <PairedBody upSet={upSet} downSet={downSet} upGenes={upGenes} downGenes={downGenes} baseTerm={baseTerm} />
        ) : (
          <SingleBody geneset={geneset} genes={genes} term={term} />
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
