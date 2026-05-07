import React from "react";
import blobTsv from "@/utils/blobTsv";
import clientDownloadBlob from "@/utils/clientDownloadBlob";

export type ContributingSignature = {
  term: string;
  library: string;
  pvalue: number;
};

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

  const sorted = signatures ?? [];

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
        <p className="text-lg text-center text-gray-900 dark:text-white flex-shrink-0 py-2">
          Contributing Gene Sets for {drug}
        </p>
        <div className="p-2 text-slate-500 text-sm leading-relaxed overflow-hidden flex flex-grow flex-shrink">
          <div className="flex flex-col w-full">
            {sorted.length > 0 ? (
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
                    {sorted.map((sig, i) => (
                      <tr key={`${sig.term}-${sig.library}-${i}`}>
                        <td>{sig.term}</td>
                        <td>{sig.library}</td>
                        <td>{sig.pvalue.toPrecision(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center">No contributing gene sets found.</p>
            )}
            <div className="flex items-center justify-end border-t border-solid border-slate-200 flex-shrink-0 gap-2 p-3">
              <button
                className="btn btn-sm btn-outline text-xs"
                type="button"
                onClick={() => {
                  if (!sorted.length) return;
                  const blob = blobTsv(
                    ["term", "library", "pvalue"],
                    sorted,
                    (item) => ({
                      term: item.term,
                      library: item.library,
                      pvalue: item.pvalue,
                    })
                  );
                  clientDownloadBlob(blob, `${drug}_contributing_gene_sets.tsv`);
                }}
              >
                Download Table
              </button>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
