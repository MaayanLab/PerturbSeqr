export default async function fetchAllNodes<T>(
  fetchPage: (offset: number) => Promise<{ nodes: T[]; totalCount: number } | null | undefined>,
  isActive: () => boolean,
): Promise<T[]> {
  const nodes: T[] = []
  while (isActive()) {
    const page = await fetchPage(nodes.length)
    if (!isActive()) return []
    if (!page || (!page.nodes.length && nodes.length < page.totalCount)) {
      throw new Error('Incomplete paginated response')
    }
    nodes.push(...page.nodes)
    if (nodes.length >= page.totalCount) return nodes
  }
  return []
}
