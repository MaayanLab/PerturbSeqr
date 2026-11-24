import { Fragment } from 'react'
import { citation } from '@/constants/citation'

export default function PaperCitation() {
  return (
    <>
      <h3 className="text-lg font-semibold mt-4">{citation.title}</h3>
      <p className="text-sm mt-1">
        {citation.authors.map((author, index) => (
          <Fragment key={author}>{index > 0 && ', '}{author}<sup>1</sup></Fragment>
        ))}
      </p>
      <p className="text-xs text-gray-500 mt-1"><sup>1</sup>{citation.affiliation}</p>
      <p className="text-sm mt-1">
        {citation.venue}. <a className="underline" href={citation.url}>doi:{citation.doi}</a>
      </p>
    </>
  )
}
