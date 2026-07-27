'use client'
import React from 'react'
import example from './example.json'
import parseGenes from '@/utils/parseGenes'
import { useAddUserGeneSetMutation, useFetchUserGeneSetQuery } from '@/graphql'
import classNames from 'classnames'
import { useRouter } from 'next/navigation'
import libraryConfig from '@/config/libraries.json'

// Get total library count to check if all are selected
const allLibraryCount = Object.keys(libraryConfig.libraries).length


/**
 * InputForm component - Gene set input form for single gene set enrichment
 * Input props:
 *   - setInputSingle: Function to toggle between single and up/down input modes
 *   - selectedLibraries: Array of selected library names for filtering (passed to enrich page)
 *   - initialGeneSetId: Saved gene set to restore when returning from results; undefined for a new search
 * Internal state:
 *   - expansionGene: Single gene symbol entered for ARCHS4 expansion
 * Output: Renders gene set input and ARCHS4 single-gene expansion forms
 */
export default function InputForm({setInputSingle, selectedLibraries = [], initialGeneSetId} : {setInputSingle:  React.Dispatch<React.SetStateAction<boolean>>, selectedLibraries?: string[], initialGeneSetId?: string}) {
  const router = useRouter()
  const [rawGenes, setRawGenes] = React.useState('')

  // Fetch initial gene set when returning from results page
  const { data: initialGeneSet } = useFetchUserGeneSetQuery({
    skip: !initialGeneSetId,
    variables: { id: initialGeneSetId || '' },
  })
  const appliedInitial = React.useRef(false)
  React.useEffect(() => {
    if (!appliedInitial.current && initialGeneSet?.userGeneSet?.genes) {
      const genes = initialGeneSet.userGeneSet.genes.filter((g): g is string => !!g)
      if (genes.length > 0) {
        setRawGenes(genes.join('\n'))
        appliedInitial.current = true
      }
    }
  }, [initialGeneSet])
  const genes = React.useMemo(() => parseGenes(rawGenes), [rawGenes]);
  
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
  var fileReader = React.useRef<FileReader | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [description, setDescription] = React.useState('User Gene Set')
  const [expansionGene, setExpansionGene] = React.useState('')
  const [expansionLoading, setExpansionLoading] = React.useState(false)
  const [expansionError, setExpansionError] = React.useState<string | null>(null)
  const [expandedGene, setExpandedGene] = React.useState<string | null>(null)

  const handleFileRead = React.useCallback(() => {
      const content = fileReader!.current!.result as string;
      setRawGenes(parseGenes(content!).join('\n'));
  }, [setRawGenes])


  const handleFileChosen = React.useCallback((file: File | null) => {
      fileReader.current = new FileReader();
      fileReader.current.onloadend = handleFileRead;
      fileReader.current.readAsText(file!);
      
  
  }, [handleFileRead]);

  const expandGene = async (gene: string) => {
    const query = gene.trim()
    if (!query || expansionLoading) return

    setExpansionLoading(true)
    setExpansionError(null)
    setExpandedGene(null)
    try {
      const response = await fetch(`/archs4/correlated-genes?gene=${encodeURIComponent(query)}`)
      const data = await response.json() as { queryGene?: string, genes?: string[], error?: string }
      if (!response.ok || !Array.isArray(data.genes)) {
        throw new Error(data.error || 'Could not expand this gene with ARCHS4.')
      }

      setRawGenes(data.genes.join('\n'))
      setDescription(`ARCHS4 genes co-expressed with ${data.queryGene || query}`)
      setExpandedGene(data.queryGene || query)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      setExpansionError(error instanceof Error ? error.message : 'Could not expand this gene with ARCHS4.')
    } finally {
      setExpansionLoading(false)
    }
  }

  return (
    <>
      <h1 className="text-xl">Input gene set</h1>
      <p className="prose">
        Try a gene set <a
          className="font-bold cursor-pointer"
          onClick={() => {
            setRawGenes(example.genes.join('\n'))
            setDescription("GSE48328 Dexamethasone Up")
          }}
        >example</a>.
      </p>
      <form
        className="flex flex-col place-items-end"
        onSubmit={async (evt) => {
          evt.preventDefault()
          if (genes.length < 1 || genes.length > 3000) return
          const result = await addUserGeneSetMutation({
            variables: {
              genes,
              description: description,
            }
          })
          const id = result.data?.addUserGeneSet?.userGeneSet?.id
          if (id) {
            // Build URL with dataset ID and optional library filter
            const params = new URLSearchParams({ dataset: id })
            // Pass selected libraries only if NOT all are selected (all selected = no filter)
            if (selectedLibraries.length > 0 && selectedLibraries.length < allLibraryCount) {
              params.set('libraries', selectedLibraries.join(','))
            }
            router.push(`/enrich?${params.toString()}`)
          }
        }}
      >
        <textarea
          value={rawGenes}
          onChange={evt => {
            setRawGenes(evt.currentTarget.value)
          }}
          rows={8}
          className="textarea textarea-bordered w-full"
          placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
        />
        <input
            className="block w-full mb-5 text-xs border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
            ref={fileInputRef}
            id="fileUpload"
            type="file"
            onChange={(e) => {handleFileChosen(e.target.files?.[0] || null)}}/>
        <span className='mx-auto'>{genes.length} gene(s) entered</span>
        <button className="btn btn-neutral mx-auto" type="submit" disabled={genes.length < 1 || genes.length > 3000}  data-tooltip-target="tooltip">Submit</button>
        <button className="btn btn-outline btn-sm mx-auto mt-1" type="button" disabled={genes.length < 1} onClick={() => { setRawGenes(''); if (fileInputRef.current) fileInputRef.current.value = '' }}>Clear</button>
        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
        {genes.length > 3000 && <div className="alert alert-error">Gene set is too large. Please enter a gene set with less than 3000 genes.</div>}
      </form>
      <div className="divider my-3 text-xs font-semibold uppercase tracking-wide">or expand a single gene</div>
      <h1 className="text-xl">Expand a single gene into a gene set</h1>
      <form className="mt-2" onSubmit={(event) => { event.preventDefault(); void expandGene(expansionGene) }}>
        <div className="join w-full">
          <input
            className="input input-bordered join-item min-w-0 flex-1"
            value={expansionGene}
            onChange={(event) => setExpansionGene(event.currentTarget.value)}
            placeholder="e.g. STAT3"
            aria-label="Single gene to expand"
          />
          <button className="btn btn-neutral join-item" type="submit" disabled={!expansionGene.trim() || expansionLoading}>
            {expansionLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Expand'}
          </button>
        </div>
        <p className="mt-2 text-sm">Try an example <button className="font-semibold underline" type="button" onClick={() => setExpansionGene('STAT3')}>STAT3</button></p>
        {expansionLoading && <p className="mt-2 text-sm" role="status">Finding genes co-expressed with <b>{expansionGene.trim()}</b> in ARCHS4...</p>}
        {expandedGene && <p className="mt-2 text-sm" role="status"><b>{expandedGene} is a gene.</b><br />Expanded {expandedGene} with the ARCHS4 RNA-seq gene-gene co-expression matrix to create a 100-gene set.</p>}
        {expansionError && <div className="alert alert-error mt-2 py-2 text-sm" role="alert">{expansionError}</div>}
      </form>
      <p className='font-semibold text-sm text-center my-2'>Or search for mimickers and reversers:</p>
      <button className='btn btn-outline text-xs p-2 m-2' onClick={() => setInputSingle(false)}>SWITCH TO UP/DOWN SETS INPUT</button>
    </>
  )
}
