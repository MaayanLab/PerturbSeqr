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
 * InputFormUpDown component - Gene set input form for up/down gene set enrichment
 * Input props:
 *   - setInputSingle: Function to toggle between single and up/down input modes
 *   - selectedLibraries: Array of selected library names for filtering (passed to enrichpair page)
 * Output: Renders two gene input textareas (up and down), file uploads, and submit button
 */
export default function InputFormUpDown({setInputSingle, selectedLibraries = [], initialDatasetUpId, initialDatasetDownId} : {setInputSingle:  React.Dispatch<React.SetStateAction<boolean>>, selectedLibraries?: string[], initialDatasetUpId?: string, initialDatasetDownId?: string}) {
  const router = useRouter()
  const [rawGenesUp, setRawGenesUp] = React.useState('')
  const [rawGenesDown, setRawGenesDown] = React.useState('')

  // Fetch initial gene sets when returning from results page
  const { data: initialGeneSetUp } = useFetchUserGeneSetQuery({
    skip: !initialDatasetUpId,
    variables: { id: initialDatasetUpId || '' },
  })
  const { data: initialGeneSetDown } = useFetchUserGeneSetQuery({
    skip: !initialDatasetDownId,
    variables: { id: initialDatasetDownId || '' },
  })
  const appliedInitialUp = React.useRef(false)
  const appliedInitialDown = React.useRef(false)
  React.useEffect(() => {
    if (!appliedInitialUp.current && initialGeneSetUp?.userGeneSet?.genes) {
      const genes = initialGeneSetUp.userGeneSet.genes.filter((g): g is string => !!g)
      if (genes.length > 0) {
        setRawGenesUp(genes.join('\n'))
        appliedInitialUp.current = true
      }
    }
  }, [initialGeneSetUp])
  React.useEffect(() => {
    if (!appliedInitialDown.current && initialGeneSetDown?.userGeneSet?.genes) {
      const genes = initialGeneSetDown.userGeneSet.genes.filter((g): g is string => !!g)
      if (genes.length > 0) {
        setRawGenesDown(genes.join('\n'))
        appliedInitialDown.current = true
      }
    }
  }, [initialGeneSetDown])
  const genesUp = React.useMemo(() => parseGenes(rawGenesUp), [rawGenesUp])
  const genesDown = React.useMemo(() => parseGenes(rawGenesDown), [rawGenesDown])
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
  var fileReader = React.useRef<FileReader | null>(null);
  const fileInputUpRef = React.useRef<HTMLInputElement>(null);
  const fileInputDownRef = React.useRef<HTMLInputElement>(null);
  const [upDescription, setUpDescription] = React.useState('User Up Gene Set')
  const [downDescription, setDownDescription] = React.useState('User Down Gene Set') 

  const handleFileReadUp = React.useCallback(() => {
      const content = fileReader!.current!.result as string;
      setRawGenesUp(parseGenes(content!).join('\n'));
  }, [setRawGenesUp])

  const handleFileReadDown = React.useCallback(() => {
    const content = fileReader!.current!.result as string;
    setRawGenesDown(parseGenes(content!).join('\n'));
  }, [setRawGenesDown])

  const handleFileChosenUp = React.useCallback((file: File | null) => {
      fileReader.current = new FileReader();
      fileReader.current.onloadend = handleFileReadUp;
      fileReader.current.readAsText(file!);
  }, [handleFileReadUp]);

  const handleFileChosenDown = React.useCallback((file: File | null) => {
    fileReader.current = new FileReader();
    fileReader.current.onloadend = handleFileReadDown;
    fileReader.current.readAsText(file!);
}, [handleFileReadDown]);

  return (
    <>
     
      <h1 className="text-xl">Input up and down gene sets</h1>
      <p className="prose">
        Try a gene set signature <a
          className="font-bold cursor-pointer"
          onClick={() => {
            setRawGenesUp(example.genes.join('\n'))
            setRawGenesDown(example.downGenes.join('\n'))
            setUpDescription('GSE48328 Dexamethasone Up')
            setDownDescription('GSE48328 Dexamethasone Down')
          }}
        >example</a>.
      </p>
      <form
        className="flex flex-col place-items-end"
        onSubmit={async (evt) => {
          evt.preventDefault()
          if (genesUp.length < 1 || genesDown.length < 1 || genesUp.length > 3000 || genesDown.length > 3000) return
          
          const resultUp = await addUserGeneSetMutation({
            variables: {
              genes: genesUp,
              description: upDescription,
            }
          })
          const resultDown = await addUserGeneSetMutation({
            variables: {
              genes: genesDown,
              description: downDescription,
            }
          })
          const idUp = resultUp.data?.addUserGeneSet?.userGeneSet?.id
          const idDown = resultDown.data?.addUserGeneSet?.userGeneSet?.id
          if (idUp && idDown) {
            // Build URL with dataset IDs and optional library filter
            const params = new URLSearchParams()
            params.append('dataset', idUp)
            params.append('dataset', idDown)
            // Pass selected libraries only if NOT all are selected (all selected = no filter)
            if (selectedLibraries.length > 0 && selectedLibraries.length < allLibraryCount) {
              params.set('libraries', selectedLibraries.join(','))
            }
            router.push(`/enrichpair?${params.toString()}`)
          }
        }}
      >
        <div className='flex flex-row gap-3'>
          <div className='flex-col text-center'>
            <textarea
              value={rawGenesUp}
              onChange={evt => {
                setRawGenesUp(evt.currentTarget.value)
              }}
              rows={8}
              className="textarea textarea-bordered w-full"
              placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
            />
            <input
                className="block w-full mb-5 text-xs border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                ref={fileInputUpRef}
                id="fileUploadUp"
                type="file"
                onChange={(e) => {handleFileChosenUp(e.target.files?.[0] || null)}}/>
            {genesUp.length} up gene(s) entered
          </div>
          <div className='flex-col text-center'>
          <textarea
            value={rawGenesDown}
            onChange={evt => {
              setRawGenesDown(evt.currentTarget.value)
            }}
            rows={8}
            className="textarea textarea-bordered w-full"
            placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
          />
          <input
              className="block w-full text-xs mb-5 border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
              ref={fileInputDownRef}
              id="fileUploadDown"
              type="file"
              onChange={(e) => {handleFileChosenDown(e.target.files?.[0] || null)}}/>
          {genesDown.length} down gene(s) entered
          </div>
        </div>
        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
        <button className="btn btn-neutral mx-auto" type="submit" disabled={(genesUp.length < 1 || genesDown.length < 1 || genesUp.length > 3000 || genesDown.length > 3000)}>Submit</button>
        {(genesUp.length > 3000 || genesDown.length > 3000) && <div className="alert alert-error">Gene set is too large. Please enter a gene set with less than 3000 genes.</div>}
        <button className="btn btn-outline btn-sm mx-auto mt-1" type="button" disabled={genesUp.length < 1 && genesDown.length < 1} onClick={() => { setRawGenesUp(''); setRawGenesDown(''); if (fileInputUpRef.current) fileInputUpRef.current.value = ''; if (fileInputDownRef.current) fileInputDownRef.current.value = '' }}>Clear</button>
      </form>
      <button className='btn btn-outline text-xs p-2' onClick={() => setInputSingle(true)}>SWITCH TO SINGLE SET INPUT</button>
    </>
  )
}
