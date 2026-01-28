'use server'
import { GeneSetDetailsByTermDocument, GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables } from "@/graphql"
import { getClient } from "@/lib/apollo/client"
import React from "react"

const getItem = React.cache(async (term: string) => {
  const client = getClient()
  const geneSet = await client.query<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>({
    query: GeneSetDetailsByTermDocument,
    variables: { term },
  })
  return geneSet
})
export default getItem
