export default function JSONLD() {
  return <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': "Ma'ayan Lab",
      'url': 'https://perturbseqr.maayanlab.cloud',
    }) }}
  />
}
