// ---------------------------------------------------------------------------
// Workflow action handler — processes AI-generated actions against the store
// ---------------------------------------------------------------------------

export function handleWorkflowActions(rawActions: Array<{ name: string; parameters: any }>) {
  try {
    // Dynamically import stores to avoid circular deps
    const { useWorkflowStore } = require('@/stores/workflows/workflow/store')
    const { useSubBlockStore } = require('@/stores/workflows/subblock/store')

    // ── Guard: filter out starter block operations ──
    // The starter block is sacred — never add or remove it.
    const actions = rawActions.filter((a) => {
      if (a.name === 'addBlock' && a.parameters?.type === 'starter') {
        console.warn('[Copilot] Blocked: attempted to add a starter block')
        return false
      }
      if (a.name === 'removeBlock') {
        const blocks = useWorkflowStore.getState().blocks || {}
        const targetId = a.parameters?.id
        if (targetId && blocks[targetId] && (blocks[targetId] as any).type === 'starter') {
          console.warn('[Copilot] Blocked: attempted to remove the starter block')
          return false
        }
        if (targetId === 'starter' || targetId?.startsWith('starter_')) {
          console.warn('[Copilot] Blocked: attempted to remove a starter block by type')
          return false
        }
      }
      return true
    })

    console.log(
      '[Copilot] Processing actions:',
      JSON.stringify(
        actions.map((a) => ({ name: a.name, params: a.parameters })),
        null,
        2
      )
    )

    // Map AI-assigned reference IDs → real UUIDs
    const refIdToRealId = new Map<string, string>()
    // Track newly created block real IDs in order for auto-connect
    const newBlockRealIds: string[] = []

    // Helper: resolve an ID (always reads FRESH state)
    // The AI may send: exact UUID, a ref ID from addBlock, or a type-based pattern like "agent_1"
    const resolveId = (id: string): string => {
      // 1. AI-assigned reference ID from addBlock in this batch
      if (refIdToRealId.has(id)) return refIdToRealId.get(id)!

      // 2. Exact block UUID in the store
      const freshBlocks = useWorkflowStore.getState().blocks
      if (freshBlocks[id]) return id

      // 3. Pattern matching: AI often sends "agent_1", "whatsapp_2", "slack", etc.
      //    Try to match by block type — collect all known types and find the best match
      const allBlockTypes = new Set(Object.values(freshBlocks).map((b: any) => b.type as string))

      // Try longest match first: "function_calling_agent_1" → "function_calling_agent" + "1"
      let bestType: string | null = null
      let bestIndex = 0
      for (const bType of allBlockTypes) {
        // Check "type_N" pattern (e.g., "agent_1", "whatsapp_2")
        const numSuffix = id.startsWith(bType + '_') ? id.slice(bType.length + 1) : null
        if (numSuffix && /^\d+$/.test(numSuffix)) {
          if (!bestType || bType.length > bestType.length) {
            bestType = bType
            bestIndex = parseInt(numSuffix, 10) - 1 // 1-based → 0-based
          }
        }
        // Check exact type match (e.g., "agent", "slack")
        if (id === bType) {
          bestType = bType
          bestIndex = 0
        }
      }

      if (bestType) {
        const matchingBlocks = Object.values(freshBlocks).filter((b: any) => b.type === bestType)
        if (matchingBlocks.length > 0) {
          const block = matchingBlocks[Math.min(bestIndex, matchingBlocks.length - 1)] as any
          console.log(
            `[Copilot] Resolved "${id}" → ${block.id} (type match: ${bestType}[${bestIndex}])`
          )
          return block.id
        }
      }

      // 4. Fuzzy: try matching block name (case-insensitive contains)
      const lowerName = id.toLowerCase().replace(/[_-]/g, ' ')
      for (const [blockId, block] of Object.entries(freshBlocks)) {
        const b = block as any
        const blockName = (b.name || '').toLowerCase()
        const blockType = (b.type || '').toLowerCase()
        if (blockName === lowerName || blockType === lowerName || blockName.includes(lowerName)) {
          console.log(`[Copilot] Resolved "${id}" → ${blockId} (name match: "${b.name || b.type}")`)
          return blockId
        }
      }

      console.warn(`[Copilot] Could not resolve block ID: "${id}" — no matching block found`)
      return id
    }

    // ─── Phase 1: Add blocks ───────────────────────────────────────────
    const blockActions = actions.filter((a) => a.name === 'addBlock')
    const initialBlocks = useWorkflowStore.getState().blocks || {}

    blockActions.forEach((action, index) => {
      const { id: refId, type, name } = action.parameters
      const realId = crypto.randomUUID()

      // Calculate position: place to the right of existing + previously added blocks
      const currentBlocks = useWorkflowStore.getState().blocks || {}
      const blockPositions = Object.values(currentBlocks).map((b: any) => b.position)
      const maxX =
        blockPositions.length > 0 ? Math.max(...blockPositions.map((p: any) => p.x)) : -200
      const avgY =
        blockPositions.length > 0
          ? blockPositions.reduce((sum: number, p: any) => sum + p.y, 0) / blockPositions.length
          : 100
      const position = { x: maxX + 350, y: avgY }

      const blockName = name || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')

      useWorkflowStore.getState().addBlock(realId, type, blockName, position)
      console.log(`[Copilot] Added block: ${type} → ${realId} (ref: ${refId || 'none'})`)

      // Store all possible reference mappings
      if (refId) refIdToRealId.set(refId, realId)
      refIdToRealId.set(type, realId)
      refIdToRealId.set(`${type}_${index}`, realId)
      newBlockRealIds.push(realId)
    })

    // ─── Phase 1b: Insert blocks between/after existing blocks ─────────
    const insertBlockActions = actions.filter((a) => a.name === 'insertBlock')
    const insertedBlockRealIds = new Set<string>() // Track inserted blocks — they already have edges
    insertBlockActions.forEach((action, index) => {
      const { id: refId, type, name, afterBlockId, beforeBlockId } = action.parameters
      if (!type || !afterBlockId) {
        console.warn('[Copilot] insertBlock: missing required params', action.parameters)
        return
      }

      const resolvedAfterId = resolveId(afterBlockId)
      const resolvedBeforeId = beforeBlockId ? resolveId(beforeBlockId) : null

      // Get positions for placement calculation
      const currentBlocks = useWorkflowStore.getState().blocks || {}
      const afterBlock = currentBlocks[resolvedAfterId]
      const beforeBlock = resolvedBeforeId ? currentBlocks[resolvedBeforeId] : null

      // Calculate position: midpoint between after and before, or offset from after
      let position: { x: number; y: number }
      if (afterBlock?.position && beforeBlock?.position) {
        position = {
          x: (afterBlock.position.x + beforeBlock.position.x) / 2,
          y: (afterBlock.position.y + beforeBlock.position.y) / 2,
        }
      } else if (afterBlock?.position) {
        position = {
          x: afterBlock.position.x + 300,
          y: afterBlock.position.y,
        }
      } else {
        const allPositions = Object.values(currentBlocks).map((b: any) => b.position)
        const maxX = allPositions.length > 0 ? Math.max(...allPositions.map((p: any) => p.x)) : 0
        const avgY =
          allPositions.length > 0
            ? allPositions.reduce((s: number, p: any) => s + p.y, 0) / allPositions.length
            : 200
        position = { x: maxX + 350, y: avgY }
      }

      // Create the block
      const realId = crypto.randomUUID()
      const blockName = name || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
      useWorkflowStore.getState().addBlock(realId, type, blockName, position)

      // Store reference mappings
      if (refId) refIdToRealId.set(refId, realId)
      refIdToRealId.set(`insert_${type}_${index}`, realId)
      newBlockRealIds.push(realId)
      insertedBlockRealIds.add(realId)

      console.log(
        `[Copilot] Inserted block: ${type} → ${realId} (ref: ${refId || 'none'}, after: ${resolvedAfterId}, before: ${resolvedBeforeId || 'none'})`
      )

      // Remove the existing edge between after→before and preserve its handles
      let originalSourceHandle: string | null = null
      let originalTargetHandle: string | null = null

      if (resolvedBeforeId) {
        const currentEdges = useWorkflowStore.getState().edges || []
        const existingEdge = currentEdges.find(
          (e: any) => e.source === resolvedAfterId && e.target === resolvedBeforeId
        )
        if (existingEdge) {
          // Preserve the original edge's handles for rewiring
          originalSourceHandle = existingEdge.sourceHandle || null
          originalTargetHandle = existingEdge.targetHandle || null
          console.log(
            `[Copilot] Removing edge for insertion: ${resolvedAfterId} → ${resolvedBeforeId} (handles: ${originalSourceHandle}→${originalTargetHandle})`
          )
          useWorkflowStore.getState().removeEdge(existingEdge.id)
        }
      }

      // Create edge: after → new block (preserve original source handle from after block)
      useWorkflowStore.getState().addEdge({
        id: crypto.randomUUID(),
        source: resolvedAfterId,
        target: realId,
        sourceHandle: originalSourceHandle || 'source',
        targetHandle: 'target',
        type: 'heroEdge',
      })
      console.log(
        `[Copilot] Edge: ${resolvedAfterId} → ${realId} (sourceHandle: ${originalSourceHandle || 'source'})`
      )

      // Create edge: new block → before (preserve original target handle from before block)
      if (resolvedBeforeId) {
        useWorkflowStore.getState().addEdge({
          id: crypto.randomUUID(),
          source: realId,
          target: resolvedBeforeId,
          sourceHandle: 'source',
          targetHandle: originalTargetHandle || 'target',
          type: 'heroEdge',
        })
        console.log(
          `[Copilot] Edge: ${realId} → ${resolvedBeforeId} (targetHandle: ${originalTargetHandle || 'target'})`
        )
      } else {
        // If no beforeBlockId, steal the after block's outgoing edges (preserve their handles)
        const currentEdges = useWorkflowStore.getState().edges || []
        const outgoing = currentEdges.filter(
          (e: any) => e.source === resolvedAfterId && e.target !== realId
        )
        for (const edge of outgoing) {
          // Rewire: remove after→X, add new→X — preserve original target handle
          useWorkflowStore.getState().removeEdge(edge.id)
          useWorkflowStore.getState().addEdge({
            id: crypto.randomUUID(),
            source: realId,
            target: edge.target,
            sourceHandle: 'source',
            targetHandle: edge.targetHandle || 'target',
            type: 'heroEdge',
          })
          console.log(
            `[Copilot] Rewired: ${resolvedAfterId}→${edge.target} becomes ${realId}→${edge.target} (targetHandle: ${edge.targetHandle || 'target'})`
          )
        }
      }

      // Shift downstream blocks to make room
      if (beforeBlock?.position && afterBlock?.position) {
        const gap = beforeBlock.position.x - afterBlock.position.x
        if (gap < 350) {
          // Not enough room — push before block and all downstream blocks right
          const shiftAmount = 350 - gap + 50
          const edgesForGraph = useWorkflowStore.getState().edges || []
          const visited = new Set<string>()
          const queue = [resolvedBeforeId!]
          while (queue.length > 0) {
            const current = queue.shift()!
            if (visited.has(current) || current === realId) continue
            visited.add(current)
            const block = useWorkflowStore.getState().blocks[current]
            if (block?.position) {
              useWorkflowStore.getState().updateBlockPosition(current, {
                x: block.position.x + shiftAmount,
                y: block.position.y,
              })
            }
            // Add successors
            edgesForGraph
              .filter((e: any) => e.source === current)
              .forEach((e: any) => queue.push(e.target))
          }
        }
      }
    })

    // ─── Phase 1c: Utility blocks (helper chips attached to host blocks) ──
    const utilityBlockActions = actions.filter((a) => a.name === 'addUtilityBlock')
    const utilityBlockRealIds = new Set<string>()

    utilityBlockActions.forEach((action, index) => {
      const {
        id: refId,
        type,
        name,
        hostBlockId,
        mode,
        outputFields,
        injectIntoHost,
      } = action.parameters
      if (!type || !hostBlockId) {
        console.warn('[Copilot] addUtilityBlock: missing required params', action.parameters)
        return
      }

      const resolvedHostId = resolveId(hostBlockId)
      const currentBlocks = useWorkflowStore.getState().blocks || {}
      const hostBlock = currentBlocks[resolvedHostId]
      if (!hostBlock) {
        console.warn(`[Copilot] addUtilityBlock: host block ${resolvedHostId} not found`)
        return
      }

      // Count existing utility blocks attached to this host for positioning
      const currentEdges = useWorkflowStore.getState().edges || []
      const attachedCount = currentEdges.filter(
        (e: any) => e.target === resolvedHostId && e.targetHandle === 'utility-target'
      ).length

      // Position below the host block, offset by attached count
      const position = {
        x: (hostBlock.position?.x ?? 0) - 40 + attachedCount * 240,
        y: (hostBlock.position?.y ?? 0) + 210,
      }

      // Create the utility block
      const realId = crypto.randomUUID()
      const blockName = name || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
      useWorkflowStore.getState().addBlock(realId, type, blockName, position)

      // Store reference mappings
      if (refId) refIdToRealId.set(refId, realId)
      refIdToRealId.set(`utility_${type}_${index}`, realId)
      utilityBlockRealIds.add(realId)

      console.log(
        `[Copilot] Added utility block: ${type} → ${realId} (ref: ${refId || 'none'}, host: ${resolvedHostId})`
      )

      // Create utility edge: utility-source → utility-target
      useWorkflowStore.getState().addEdge({
        id: crypto.randomUUID(),
        source: realId,
        target: resolvedHostId,
        sourceHandle: 'utility-source',
        targetHandle: 'utility-target',
        type: 'heroEdge',
      })
      console.log(
        `[Copilot] Utility edge: ${realId} → ${resolvedHostId} (utility-source → utility-target)`
      )

      // Pre-configure based on type and mode
      const sub = useSubBlockStore.getState()

      if (type === 'data_table') {
        const normalizedHostName = (hostBlock.name || '')
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '')
        if (mode === 'write') {
          // Write mode: save host output to table
          sub.setValue(realId, 'operation', 'auto_save')
          sub.setValue(realId, 'tableName', normalizedHostName || 'output')
          // Determine host block primary output for rawData reference
          const hostType = (hostBlock as any).type ?? ''
          const PRIMARY_OUTPUTS: Record<string, string> = {
            agent: 'response.content',
            evaluator: 'response.content',
            function: 'response.result',
            api: 'response.data',
            router: 'response.content',
            condition: 'response.content',
            vision: 'response.content',
            translate: 'response.content',
            anthropic: 'response.content',
            openai: 'response.content',
            gemini: 'response.content',
            text_processor: 'response.processedText',
            json_processor: 'response.processedData',
            csv_processor: 'response.data',
            math: 'response.result',
            file: 'response.combinedContent',
            mistral_parse: 'response.content',
          }
          const primaryOutput = PRIMARY_OUTPUTS[hostType] ?? 'response.result'
          sub.setValue(realId, 'rawData', `<${normalizedHostName}.${primaryOutput}>`)
          console.log(
            `[Copilot] Configured data_table in write mode for host "${normalizedHostName}"`
          )
        } else {
          // Read mode (default)
          sub.setValue(realId, 'operation', 'query_rows')
          console.log(`[Copilot] Configured data_table in read mode`)
        }
      }

      // Inject output references into host block's best input field
      const shouldInject = injectIntoHost !== false // default true
      if (shouldInject) {
        const normalizedName = blockName
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/g, '')

        // Determine which output fields to inject
        let fieldsToInject: string[] = []
        if (outputFields && Array.isArray(outputFields) && outputFields.length > 0) {
          fieldsToInject = outputFields
        } else {
          // Use primary output field based on block type
          const PRIMARY_FIELD_MAP: Record<string, string> = {
            data_table: 'response.rows',
            variable: 'response.variableValue',
            math: 'response.result',
            json_processor: 'response.processedData',
            text_processor: 'response.processedText',
            csv_processor: 'response.data',
            translate: 'response.content',
            pii_mask: 'response.maskedText',
            shared_memory: 'response.value',
            mistral_parse: 'response.content',
          }
          const primaryField = PRIMARY_FIELD_MAP[type]
          if (primaryField) fieldsToInject = [primaryField]
        }

        // Skip injection for write-mode data_table (it writes FROM host, not TO host)
        if (type === 'data_table' && mode === 'write') {
          fieldsToInject = []
        }

        if (fieldsToInject.length > 0) {
          // Find best input field on host block
          const hostConfig = (() => {
            try {
              const { getBlock } = require('@/blocks')
              return getBlock((hostBlock as any).type)
            } catch {
              return null
            }
          })()

          if (hostConfig) {
            let targetFieldId: string | null = null
            for (const preferredType of ['long-input', 'short-input']) {
              for (const sb of hostConfig.subBlocks || []) {
                if (
                  sb.type === preferredType &&
                  !sb.hidden &&
                  !sb.password &&
                  sb.connectionDroppable !== false
                ) {
                  targetFieldId = sb.id
                  break
                }
              }
              if (targetFieldId) break
            }

            if (targetFieldId) {
              const refs = fieldsToInject
                .map((path: string) => `<${normalizedName}.${path}>`)
                .join('\n')
              const current = sub.getValue(resolvedHostId, targetFieldId)
              const currentStr = current != null ? String(current).trim() : ''
              sub.setValue(
                resolvedHostId,
                targetFieldId,
                currentStr ? `${currentStr}\n${refs}` : refs
              )
              console.log(
                `[Copilot] Injected ${fieldsToInject.length} output ref(s) into host "${targetFieldId}": ${refs}`
              )
            }
          }
        }
      }
    })

    // ─── Phase 2: Removals with smart chain healing ────────────────────
    const removeBlockActions = actions.filter((a) => a.name === 'removeBlock')
    const removeEdgeActions = actions.filter((a) => a.name === 'removeEdge')
    const addEdgeActions = actions.filter((a) => a.name === 'addEdge')
    const configActions = actions.filter(
      (a) => a.name === 'updateSubBlock' || a.name === 'repositionBlock'
    )

    // Track which edges the AI explicitly creates (so we don't duplicate during auto-heal)
    const aiCreatedEdgeKeys = new Set(
      addEdgeActions.map((a) => {
        const s = resolveId(a.parameters.sourceId)
        const t = resolveId(a.parameters.targetId)
        return `${s}→${t}`
      })
    )

    // Remove edges first
    removeEdgeActions.forEach((action) => {
      console.log(`[Copilot] Removing edge: ${action.parameters.id}`)
      useWorkflowStore.getState().removeEdge(action.parameters.id)
    })

    // Remove blocks with smart chain healing
    removeBlockActions.forEach((action) => {
      const blockId = resolveId(action.parameters.id)
      const currentEdges = useWorkflowStore.getState().edges || []

      // Find predecessors and successors BEFORE removing
      const incomingEdges = currentEdges.filter((e: any) => e.target === blockId)
      const outgoingEdges = currentEdges.filter((e: any) => e.source === blockId)

      console.log(
        `[Copilot] Removing block: ${blockId} (${incomingEdges.length} in, ${outgoingEdges.length} out)`
      )

      useWorkflowStore.getState().removeBlock(blockId)

      // Smart chain healing: reconnect predecessors → successors
      // Only if the AI didn't already explicitly add replacement edges
      if (incomingEdges.length > 0 && outgoingEdges.length > 0) {
        for (const inEdge of incomingEdges) {
          for (const outEdge of outgoingEdges) {
            const healKey = `${inEdge.source}→${outEdge.target}`
            if (!aiCreatedEdgeKeys.has(healKey)) {
              console.log(`[Copilot] Auto-healing chain: ${inEdge.source} → ${outEdge.target}`)
              useWorkflowStore.getState().addEdge({
                id: crypto.randomUUID(),
                source: inEdge.source,
                target: outEdge.target,
                sourceHandle: 'source',
                targetHandle: 'target',
                type: 'heroEdge',
              })
              aiCreatedEdgeKeys.add(healKey) // Prevent duplicates
            }
          }
        }
      }
    })

    // ─── Phase 2b: Add edges ────────────────────────────────────────────
    let edgesCreated = 0
    addEdgeActions.forEach((action) => {
      const { sourceId, targetId, sourceHandle, targetHandle } = action.parameters
      const resolvedSource = resolveId(sourceId)
      const resolvedTarget = resolveId(targetId)

      // Skip if this edge already exists (from auto-heal)
      const existingEdges = useWorkflowStore.getState().edges || []
      const alreadyExists = existingEdges.some(
        (e: any) => e.source === resolvedSource && e.target === resolvedTarget
      )
      if (alreadyExists) {
        console.log(
          `[Copilot] Edge already exists: ${sourceId}(${resolvedSource}) → ${targetId}(${resolvedTarget}), skipping`
        )
        edgesCreated++
        return
      }

      console.log(
        `[Copilot] Adding edge: ${sourceId}(${resolvedSource}) → ${targetId}(${resolvedTarget})`
      )

      useWorkflowStore.getState().addEdge({
        id: crypto.randomUUID(),
        source: resolvedSource,
        target: resolvedTarget,
        sourceHandle: sourceHandle || 'source',
        targetHandle: targetHandle || 'target',
        type: 'heroEdge',
      })
      edgesCreated++
    })

    // ─── Phase 2c: Config + reposition ──────────────────────────────────
    configActions.forEach((action) => {
      switch (action.name) {
        case 'updateSubBlock': {
          const { blockId, subBlockId, value } = action.parameters
          if (!blockId || !subBlockId || value === undefined) {
            console.warn('[Copilot] updateSubBlock: missing required params', action.parameters)
            break
          }
          const resolvedBlockId = resolveId(blockId)

          // Verify block exists before trying to set value
          const targetBlock = useWorkflowStore.getState().blocks[resolvedBlockId]
          if (!targetBlock) {
            console.warn(`[Copilot] updateSubBlock: block ${resolvedBlockId} not found in store`)
            break
          }

          console.log(
            `[Copilot] Updating sub-block: ${blockId}(${resolvedBlockId}).${subBlockId} = ${typeof value === 'string' && value.length > 50 ? value.slice(0, 50) + '...' : value}`
          )

          try {
            useSubBlockStore.getState().setValue(resolvedBlockId, subBlockId, value)
          } catch (err) {
            console.error(`[Copilot] Failed to set ${subBlockId} on ${resolvedBlockId}:`, err)
          }
          break
        }
        case 'repositionBlock': {
          const { id: repoId, x, y } = action.parameters
          const resolvedRepoId = resolveId(repoId)
          console.log(`[Copilot] Repositioning block: ${repoId}(${resolvedRepoId}) → (${x}, ${y})`)
          useWorkflowStore.getState().updateBlockPosition(resolvedRepoId, { x, y })
          break
        }
      }
    })

    // ─── Phase 3: Auto-connect fallback ────────────────────────────────
    // Only auto-connect blocks that were added via addBlock (NOT insertBlock,
    // since insertBlock already creates proper edges during Phase 1b)
    const unconnectedNewBlocks = newBlockRealIds.filter((id) => !insertedBlockRealIds.has(id))

    if (unconnectedNewBlocks.length > 0 && edgesCreated === 0) {
      console.log(
        `[Copilot] AI created ${unconnectedNewBlocks.length} blocks (${insertedBlockRealIds.size} inserted) but 0 explicit edges — auto-connecting unconnected blocks`
      )

      const existingBlockIds = Object.keys(initialBlocks)
      let connectFromId: string | null = null

      if (existingBlockIds.length > 0) {
        const starterBlock = Object.values(initialBlocks).find((b: any) => b.type === 'starter')
        if (starterBlock) {
          const freshEdges = useWorkflowStore.getState().edges || []
          const starterHasEdge = freshEdges.some((e: any) => e.source === (starterBlock as any).id)
          if (!starterHasEdge) {
            connectFromId = (starterBlock as any).id
          }
        }
        if (!connectFromId) {
          const freshEdges = useWorkflowStore.getState().edges || []
          const blocksWithOutgoing = new Set(freshEdges.map((e: any) => e.source))
          const terminalBlocks = existingBlockIds.filter((id) => !blocksWithOutgoing.has(id))
          if (terminalBlocks.length > 0) {
            connectFromId = terminalBlocks[terminalBlocks.length - 1]
          }
        }
      }

      const chain = connectFromId ? [connectFromId, ...unconnectedNewBlocks] : unconnectedNewBlocks

      for (let i = 0; i < chain.length - 1; i++) {
        const sourceId = chain[i]
        const targetId = chain[i + 1]
        // Skip if edge already exists (from insertBlock rewiring or other)
        const existingEdges = useWorkflowStore.getState().edges || []
        if (existingEdges.some((e: any) => e.source === sourceId && e.target === targetId)) {
          console.log(`[Copilot] Auto-connect: ${sourceId} → ${targetId} already exists, skipping`)
          continue
        }
        console.log(`[Copilot] Auto-connect: ${sourceId} → ${targetId}`)
        useWorkflowStore.getState().addEdge({
          id: crypto.randomUUID(),
          source: sourceId,
          target: targetId,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'heroEdge',
        })
      }
    }

    // ─── Phase 4: Auto-layout for new blocks without explicit positioning ──
    // Only layout addBlock blocks — insertBlock blocks already have correct positions
    // calculated in Phase 1b (midpoint between after/before blocks)
    const hasRepositionActions = actions.some((a) => a.name === 'repositionBlock')
    const layoutBlocks = newBlockRealIds.filter((id) => !insertedBlockRealIds.has(id))

    if (layoutBlocks.length > 0 && !hasRepositionActions) {
      console.log(
        `[Copilot] Auto-laying out ${layoutBlocks.length} new blocks (${insertedBlockRealIds.size} inserted blocks skipped — already positioned)`
      )
      const freshBlocks = useWorkflowStore.getState().blocks || {}
      const freshEdges = useWorkflowStore.getState().edges || []

      // Build a simple left-to-right flow based on edge topology
      // Find the topological order of new blocks
      const visited = new Set<string>()
      const order: string[] = []

      // Start from blocks with no incoming edges from other new blocks
      const layoutBlockSet = new Set(layoutBlocks)
      const hasIncomingFromNew = new Set(
        freshEdges
          .filter((e: any) => layoutBlockSet.has(e.source) && layoutBlockSet.has(e.target))
          .map((e: any) => e.target)
      )

      // Find starting blocks (no incoming from new blocks)
      const startBlocks = layoutBlocks.filter((id) => !hasIncomingFromNew.has(id))
      const queue = startBlocks.length > 0 ? [...startBlocks] : [layoutBlocks[0]]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        order.push(current)

        // Find successors within new blocks
        const successors = freshEdges
          .filter((e: any) => e.source === current && layoutBlockSet.has(e.target))
          .map((e: any) => e.target)
        queue.push(...successors)
      }

      // Add any unvisited new blocks
      for (const id of layoutBlocks) {
        if (!visited.has(id)) order.push(id)
      }

      // Find the rightmost existing block to position after
      const existingPositions = Object.entries(freshBlocks)
        .filter(([id]) => !layoutBlockSet.has(id))
        .map(([, b]: [string, any]) => b.position)
      const startX =
        existingPositions.length > 0
          ? Math.max(...existingPositions.map((p: any) => p.x)) + 350
          : 100
      const avgY =
        existingPositions.length > 0
          ? existingPositions.reduce((sum: number, p: any) => sum + p.y, 0) /
            existingPositions.length
          : 200

      // Position blocks in a horizontal flow
      order.forEach((id, i) => {
        const x = startX + i * 300
        const y = avgY
        useWorkflowStore.getState().updateBlockPosition(id, { x, y })
      })
    }

    // ─── Phase 5: Post-action diagnostics & auto-repair ────────────────
    autoRepairWorkflow(useWorkflowStore)

    const finalBlocks = useWorkflowStore.getState().blocks || {}
    const finalEdges = useWorkflowStore.getState().edges || []
    console.log(
      `[Copilot] Final: ${Object.keys(finalBlocks).length} blocks, ${finalEdges.length} edges`
    )
  } catch (error) {
    console.error('[Copilot] Failed to handle workflow actions:', error)
  }
}

// ---------------------------------------------------------------------------
// Post-action auto-repair: detect & fix common workflow issues
// ---------------------------------------------------------------------------

function autoRepairWorkflow(useWorkflowStore: any) {
  const blocks = useWorkflowStore.getState().blocks || {}
  const edges = useWorkflowStore.getState().edges || []
  const blockIds = new Set(Object.keys(blocks))
  let repairCount = 0

  // 1. Remove dangling edges (pointing to/from non-existent blocks)
  const danglingEdges = edges.filter((e: any) => !blockIds.has(e.source) || !blockIds.has(e.target))
  for (const edge of danglingEdges) {
    console.log(`[Copilot:Repair] Removing dangling edge: ${edge.source} → ${edge.target}`)
    useWorkflowStore.getState().removeEdge(edge.id)
    repairCount++
  }

  // 2. Remove duplicate edges (same source+target)
  const freshEdges = useWorkflowStore.getState().edges || []
  const edgeKeys = new Set<string>()
  for (const edge of freshEdges) {
    const key = `${edge.source}→${edge.target}`
    if (edgeKeys.has(key)) {
      console.log(`[Copilot:Repair] Removing duplicate edge: ${key}`)
      useWorkflowStore.getState().removeEdge(edge.id)
      repairCount++
    } else {
      edgeKeys.add(key)
    }
  }

  // 3. Remove self-referencing edges
  const edgesAfterDedup = useWorkflowStore.getState().edges || []
  for (const edge of edgesAfterDedup) {
    if (edge.source === edge.target) {
      console.log(`[Copilot:Repair] Removing self-edge: ${edge.source}`)
      useWorkflowStore.getState().removeEdge(edge.id)
      repairCount++
    }
  }

  // 4. Fix overlapping blocks (blocks within 50px of each other)
  const blockList = Object.values(blocks) as any[]
  for (let i = 0; i < blockList.length; i++) {
    for (let j = i + 1; j < blockList.length; j++) {
      const a = blockList[i]
      const b = blockList[j]
      if (!a.position || !b.position) continue
      const dx = Math.abs(a.position.x - b.position.x)
      const dy = Math.abs(a.position.y - b.position.y)
      if (dx < 50 && dy < 50) {
        // Push the second block to the right
        const newX = a.position.x + 300
        const newY = b.position.y
        console.log(`[Copilot:Repair] Fixing overlap: ${b.id} moved to (${newX}, ${newY})`)
        useWorkflowStore.getState().updateBlockPosition(b.id, { x: newX, y: newY })
        // Update local reference so subsequent checks use new position
        blockList[j] = { ...b, position: { x: newX, y: newY } }
        repairCount++
      }
    }
  }

  if (repairCount > 0) {
    console.log(`[Copilot:Repair] Fixed ${repairCount} issue(s)`)
  }
}
