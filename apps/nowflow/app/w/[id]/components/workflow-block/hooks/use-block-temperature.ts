import { useMemo } from 'react'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks'

/**
 * Hook to get the temperature value for a block with real-time updates
 * @param blockId The ID of the block
 * @returns The temperature value or null if not applicable
 */
export function useBlockTemperature(blockId: string): number | null {
  // Get the temperature value directly from the store
  // This will automatically re-render when the value changes
  const temperatureValue = useSubBlockStore((state) => state.getValue(blockId, 'temperature'))
  const blockType = useWorkflowStore((state) => state.blocks[blockId]?.type)

  // Process the temperature value
  return useMemo(() => {
    if (!blockType) return null

    const blockConfig = getBlock(blockType)
    if (!blockConfig) return null

    if (temperatureValue === null || temperatureValue === undefined) return null

    // Parse temperature
    const parsedTemp = parseFloat(temperatureValue as string)
    if (isNaN(parsedTemp)) return null

    return parsedTemp
  }, [blockType, temperatureValue])
}
