import React from "react";
import blobTsv from "@/utils/blobTsv";
import clientDownloadBlob from "@/utils/clientDownloadBlob";

export type ContributingSignature = {
  term: string;
  library: string;
  pvalue: number;
  significant: boolean;
};

function SignatureTable({ signatures, emptyMessage }: { signatures: ContributingSignature[]; emptyMessage: string }) {
  if (signatures.length === 0) {
    return <p className="text-center py-4 text-slate-400">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto overflow-y-auto block flex-grow">
      <table className="table table-xs table-pin-rows table-pin-cols">
        <thead className="bg-white dark:bg-slate-800 sticky top-0">
          <tr>
            <th>Term</th>
            <th>Library</th>
            <th>P-Value</th>
          </tr>
        </thead>
        <tbody>
          {signatures.map((sig, i) => (
            <tr key={`${sig.term}-${sig.library}-${i}`}>
              <td>{sig.term}</td>
              <td>{sig.library}</td>
              <td>{sig.significant ? sig.pvalue.toPrecision(3) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SignaturesModal({
  signatures,
  drug,
  showModal,
  setShowModal,
}: {
  signatures?: ContributingSignature[];
  drug: string;
  showModal?: boolean;
  setShowModal: (show: boolean) => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  const { sig, insig } = React.useMemo(() => {
    if (!signatures) return { sig: [], insig: [] };
    const sig = signatures.filter((s) => s.significant).sort((a, b) => a.pvalue - b.pvalue);
    const insig = signatures.filter((s) => !s.significant).sort((a, b) => a.term.localeCompare(b.term));
    return { sig, insig };
  }, [signatures]);

  const all = React.useMemo(() => signatures ? [...signatures].sort((a, b) => {
    if (a.significant !== b.significant) return a.significant ? -1 : 1;
    return a.pvalue - b.pvalue;
  }) : [], [signatures]);

  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.addEventListener("close", () => setShowModal(false));
  }, [ref, setShowModal]);

  React.useEffect(() => {
    if (!ref.current) return;
    if (showModal) ref.current.showModal();
  }, [ref, showModal]);

  return (
    <dialog className="modal" ref={ref}>
      <div className="modal-box w-11/12 max-w-screen-xl h-5/6 overflow-hidden flex flex-col p-0">
        <p className="text-md text-center text-gray-900 dark:text-white flex-shrink-0 py-2">
          Contributing Gene Sets for {drug}
        </p>
        <div className="p-2 text-slate-500 text-sm leading-relaxed overflow-hidden flex flex-grow flex-shrink">
          <div className="flex flex-row w-full gap-2 h-full">
            <div className="flex flex-col w-1/2 h-full overflow-hidden">
              <h3 className="font-semibold text-center text-gray-700 dark:text-gray-300 pb-1 flex-shrink-0">
                Significant ({sig.length})
              </h3>
              <SignatureTable signatures={sig} emptyMessage="No significant gene sets." />
            </div>
            <div className="divider divider-horizontal m-0" />
            <div className="flex flex-col w-1/2 h-full overflow-hidden">
              <h3 className="font-semibold text-center text-gray-700 dark:text-gray-300 pb-1 flex-shrink-0">
                Insignificant ({insig.length})
              </h3>
              <SignatureTable signatures={insig} emptyMessage="No insignificant gene sets." />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
          <button
            className="btn btn-sm btn-outline text-xs"
            type="button"
            onClick={() => {
              if (!all.length) return;
              const blob = blobTsv(
                ["term", "library", "pvalue", "significant"],
                all,
                (item) => ({
                  term: item.term,
                  library: item.library,
                  pvalue: item.pvalue,
                  significant: item.significant ? "yes" : "no",
                })
              );
              clientDownloadBlob(blob, `${drug}_contributing_gene_sets.tsv`);
            }}
          >
            Download Table
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
