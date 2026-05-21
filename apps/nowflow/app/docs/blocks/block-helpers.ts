export const categoryLabels: Record<string, string> = {
  agents: 'Agents',
  tools: 'Tools',
  integrations: 'Integrations',
  data: 'Data',
  blocks: 'Core Blocks',
}

export const categoryOrder = ['agents', 'tools', 'integrations', 'data', 'blocks']

export const getCategoryLabel = (category?: string) => {
  if (!category) return 'Core Blocks'
  return categoryLabels[category] ?? category
}
