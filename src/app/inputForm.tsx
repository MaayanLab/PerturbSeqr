'use client'
import React from 'react'
import example from './example.json'
import uniqueArray from '@/utils/uniqueArray'
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
 * Output: Renders gene input textarea, file upload, and submit button
 */
export default function InputForm({setInputSingle, selectedLibraries = [], initialDatasetId} : {setInputSingle:  React.Dispatch<React.SetStateAction<boolean>>, selectedLibraries?: string[], initialDatasetId?: string}) {
  const router = useRouter()
  const [rawGenes, setRawGenes] = React.useState('')

  // Fetch initial gene set when returning from results page
  const { data: initialGeneSet } = useFetchUserGeneSetQuery({
    skip: !initialDatasetId,
    variables: { id: initialDatasetId || '' },
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
  const genes = React.useMemo(() =>
    uniqueArray(
      rawGenes
        .split(/[;,\t\r\n\s]+/) // Split on common delimiters
        .filter(v => /^[A-Za-z0-9-]+$/.test(v) && v.length > 1) // Allow letters, numbers, and hyphens (e.g. MT-ATP6 has hyphen, C7orf50 has lowercase 'orf' - both appear in ginkgo-cd dataset)
    ),
    [rawGenes]
  );
  
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
  var fileReader = React.useRef<FileReader | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [description, setDescription] = React.useState('User Gene Set')

  const handleFileRead = React.useCallback(() => {
      const content = fileReader!.current!.result as string;
      setRawGenes(content!.split(/[;,\t\r\n\s]+/) // Split on common delimiters
      .filter(v => /^[A-Za-z0-9-]+$/.test(v) && v.length > 1).join('\n')); // Must match the genes useMemo filter on line 17
  }, [setRawGenes])


  const handleFileChosen = React.useCallback((file: File | null) => {
      fileReader.current = new FileReader();
      fileReader.current.onloadend = handleFileRead;
      console.log(file)
      fileReader.current.readAsText(file!);
      
  
  }, [handleFileRead]);

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
        <button className="btn mx-auto" type="submit" disabled={genes.length < 1 || genes.length > 3000}  data-tooltip-target="tooltip">Submit</button>
        <button className="btn btn-outline btn-sm mx-auto mt-1" type="button" disabled={genes.length < 1} onClick={() => { setRawGenes(''); if (fileInputRef.current) fileInputRef.current.value = '' }}>Clear</button>
        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
        {genes.length > 3000 && <div className="alert alert-error">Gene set is too large. Please enter a gene set with less than 3000 genes.</div>}
      </form>
      <p className='font-semibold text-sm text-center my-2'>Or search for mimickers and reversers:</p>
      <button className='btn btn-outline text-xs p-2 m-2' onClick={() => setInputSingle(false)}>SWITCH TO UP/DOWN SETS INPUT</button>
    </>
  )
}
