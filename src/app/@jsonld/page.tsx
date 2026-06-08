export default function JSONLD() {
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': "Ma'ayan Lab",
      'url': 'https://perturbseqr.maayanlab.cloud',
      'potentialAction': [
        {
          "@type": "SearchAction",
          "target": "https://perturbseqr.maayanlab.cloud/term-search?q={query}",
          "query-input": "required name=query",
          "name": "Table title search",
          "description": "Query gene set table titles to find matching gene sets",
        }
      ],
    }) }}
  />
}
