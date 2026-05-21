'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronRight, Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { generateUUID } from '@/lib/utils'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getAllBlocks, getBlock } from '@/blocks'
import type { BlockConfig, SubBlockConfig } from '@/blocks/types'

const UTILITY_BLOCKS: BlockConfig[] = getAllBlocks().filter((b) => b.isUtility)

// ─── Output field catalog ────────────────────────────────────────────────────

export type UtilityOutputField = {
  path: string
  label: string
  type: 'json' | 'string' | 'number' | 'boolean'
  desc: string
  primary?: true
}

export const UTILITY_OUTPUT_FIELDS: Record<string, UtilityOutputField[]> = {
  data_table: [
    // ── Read operations (query_rows, list_tables) ──
    {
      path: 'response.rows',
      label: 'Rows',
      type: 'json',
      desc: '📖 Sorgu sonucu satırlar — query_rows',
      primary: true,
    },
    {
      path: 'response.totalRows',
      label: 'Total Rows',
      type: 'number',
      desc: '📖 Toplam satır sayısı — query_rows / auto_save',
    },
    {
      path: 'response.tables',
      label: 'Tables',
      type: 'json',
      desc: '📖 Tablo listesi — list_tables',
    },
    {
      path: 'response.row',
      label: 'Row',
      type: 'json',
      desc: '📖 Eklenen / güncellenen satır — insert_row / update_row',
    },
    // ── Write operations (smart_insert, auto_save) ──
    {
      path: 'response.insertedRows',
      label: 'Inserted Rows',
      type: 'number',
      desc: '✍️ Eklenen satır sayısı — smart_insert / auto_save',
    },
    {
      path: 'response.skippedRows',
      label: 'Skipped Rows',
      type: 'number',
      desc: '✍️ Atlanan (duplicate) satır sayısı — smart_insert / auto_save',
    },
    {
      path: 'response.isNewTable',
      label: 'Is New Table',
      type: 'boolean',
      desc: '✍️ Yeni tablo mu oluşturuldu — auto_save',
    },
    {
      path: 'response.tableId',
      label: 'Table ID',
      type: 'string',
      desc: "✍️ Tablonun ID'si — smart_insert / auto_save",
    },
    {
      path: 'response.tableName',
      label: 'Table Name',
      type: 'string',
      desc: '✍️ Tablonun adı — auto_save',
    },
  ],
  variable: [
    {
      path: 'response.variableValue',
      label: 'Value',
      type: 'json',
      desc: 'Değişkenin mevcut değeri',
      primary: true,
    },
    { path: 'response.content', label: 'Summary', type: 'string', desc: 'İşlem özeti' },
    { path: 'response.variableName', label: 'Variable Name', type: 'string', desc: 'Değişken adı' },
    { path: 'response.previousValue', label: 'Previous Value', type: 'json', desc: 'Önceki değer' },
  ],
  math: [
    {
      path: 'response.result',
      label: 'Result',
      type: 'number',
      desc: 'Hesaplama sonucu',
      primary: true,
    },
    { path: 'response.content', label: 'Summary', type: 'string', desc: 'İşlem özeti' },
    {
      path: 'response.expression',
      label: 'Expression',
      type: 'string',
      desc: 'Matematiksel ifade',
    },
    { path: 'response.inputs', label: 'Inputs', type: 'json', desc: 'Giriş değerleri' },
    { path: 'response.operation', label: 'Operation', type: 'string', desc: 'Yapılan işlem türü' },
    { path: 'response.unit', label: 'Unit', type: 'string', desc: 'Birim (trigonometri)' },
    { path: 'response.precision', label: 'Precision', type: 'number', desc: 'Ondalık hassasiyet' },
  ],
  json_processor: [
    {
      path: 'response.processedData',
      label: 'Processed Data',
      type: 'json',
      desc: 'Dönüştürülmüş JSON',
      primary: true,
    },
    { path: 'response.originalData', label: 'Original Data', type: 'json', desc: 'Orijinal giriş' },
    { path: 'response.size', label: 'Size', type: 'number', desc: 'Veri boyutu' },
    { path: 'response.metadata', label: 'Metadata', type: 'json', desc: 'İşlem meta bilgisi' },
  ],
  text_processor: [
    {
      path: 'response.processedText',
      label: 'Processed Text',
      type: 'string',
      desc: 'İşlenmiş metin',
      primary: true,
    },
    {
      path: 'response.originalText',
      label: 'Original Text',
      type: 'string',
      desc: 'Orijinal metin',
    },
    {
      path: 'response.metadata',
      label: 'Metadata',
      type: 'json',
      desc: "Çıkartılan e-postalar, URL'ler, vb.",
    },
    { path: 'response.wordCount', label: 'Word Count', type: 'number', desc: 'Kelime sayısı' },
    {
      path: 'response.characterCount',
      label: 'Character Count',
      type: 'number',
      desc: 'Karakter sayısı',
    },
  ],
  csv_processor: [
    {
      path: 'response.data',
      label: 'Data',
      type: 'json',
      desc: "CSV'den parse edilmiş veri",
      primary: true,
    },
    { path: 'response.csv', label: 'CSV', type: 'string', desc: 'CSV string çıktısı (stringify)' },
    { path: 'response.stats', label: 'Stats', type: 'json', desc: 'Satır/sütun istatistikleri' },
    { path: 'response.success', label: 'Success', type: 'boolean', desc: 'İşlem başarılı mı?' },
  ],
  translate: [
    {
      path: 'response.content',
      label: 'Translated Text',
      type: 'string',
      desc: 'Çevrilen metin',
      primary: true,
    },
    { path: 'response.tokens', label: 'Tokens', type: 'json', desc: 'Token kullanımı' },
    { path: 'response.model', label: 'Model', type: 'string', desc: 'Kullanılan model' },
  ],
  pii_mask: [
    {
      path: 'response.maskedText',
      label: 'Masked Text',
      type: 'string',
      desc: 'PII maskelenmiş metin',
      primary: true,
    },
    { path: 'response.hasPII', label: 'Has PII', type: 'boolean', desc: 'PII tespit edildi mi?' },
    {
      path: 'response.matchCount',
      label: 'Match Count',
      type: 'number',
      desc: 'Bulunan PII sayısı',
    },
    { path: 'response.matches', label: 'Matches', type: 'json', desc: 'Tespit edilen PII listesi' },
  ],
  shared_memory: [
    { path: 'response.value', label: 'Value', type: 'json', desc: 'Saklanan değer', primary: true },
    { path: 'response.success', label: 'Success', type: 'boolean', desc: 'İşlem başarılı mı?' },
    { path: 'response.key', label: 'Key', type: 'string', desc: 'Bellek anahtarı' },
    { path: 'response.previousValue', label: 'Previous Value', type: 'json', desc: 'Önceki değer' },
    {
      path: 'response.version',
      label: 'Version',
      type: 'number',
      desc: 'Veri versiyonu (CAS için)',
    },
    {
      path: 'response.scope',
      label: 'Scope',
      type: 'string',
      desc: 'Kapsam: execution / workflow / global',
    },
    {
      path: 'response.expiresAt',
      label: 'Expires At',
      type: 'string',
      desc: 'TTL son kullanma zamanı',
    },
  ],
  mistral_parse: [
    {
      path: 'response.content',
      label: 'Content',
      type: 'string',
      desc: "PDF'den çıkartılan metin",
      primary: true,
    },
    {
      path: 'response.metadata',
      label: 'Metadata',
      type: 'json',
      desc: 'Sayfa sayısı, güven skoru, vb.',
    },
  ],
  ai_guardrails: [
    {
      path: 'response.passed',
      label: 'Passed',
      type: 'boolean',
      desc: 'Güvenlik kontrolünden geçti mi?',
      primary: true,
    },
    {
      path: 'response.filteredText',
      label: 'Filtered Text',
      type: 'string',
      desc: 'Filtrelenmiş / temizlenmiş metin',
    },
    {
      path: 'response.violations',
      label: 'Violations',
      type: 'json',
      desc: 'İhlal listesi (engellenmiş içerik)',
    },
    {
      path: 'response.warnings',
      label: 'Warnings',
      type: 'json',
      desc: 'Uyarılar (riskli ama geçen içerik)',
    },
    { path: 'response.metadata', label: 'Metadata', type: 'json', desc: 'Kontrol meta bilgisi' },
  ],
}

// ─── Host block primary output — used to pre-fill rawData for write mode ────

const BLOCK_PRIMARY_OUTPUT: Record<string, string> = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function normalizeBlockName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function findBestInputField(config: BlockConfig): string | null {
  for (const preferredType of ['long-input', 'short-input']) {
    for (const sb of config.subBlocks as SubBlockConfig[]) {
      if (
        sb.type === preferredType &&
        !sb.hidden &&
        !(sb as any).password &&
        sb.connectionDroppable !== false
      ) {
        return sb.id
      }
    }
  }
  return null
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  json: 'bg-blue-100   text-blue-700   dark:bg-blue-900/40  dark:text-blue-300',
  string: 'bg-green-100  text-green-700  dark:bg-green-900/40 dark:text-green-300',
  number: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40 dark:text-amber-300',
  boolean: 'bg-rose-100   text-rose-700   dark:bg-rose-900/40  dark:text-rose-300',
}

// ─── Read-only fields shown in field-select for data_table ──────────────────

const DATA_TABLE_READ_PATHS = new Set([
  'response.rows',
  'response.totalRows',
  'response.tables',
  'response.row',
])

// ─── Component ───────────────────────────────────────────────────────────────

interface QuickAddUtilityProps {
  hostBlockId: string
  hostBlockPosition: { x: number; y: number }
}

export function QuickAddUtility({ hostBlockId, hostBlockPosition }: QuickAddUtilityProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'type-select' | 'mode-select' | 'field-select'>('type-select')
  const [pendingUtility, setPendingUtility] = useState<BlockConfig | null>(null)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())

  // Granular selector: only re-render when the utility edge count for this host changes
  const attachedCount = useWorkflowStore(
    (s) =>
      s.edges.filter((e) => e.target === hostBlockId && e.targetHandle === 'utility-target').length
  )
  const addBlock = useWorkflowStore((s) => s.addBlock)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const removeBlock = useWorkflowStore((s) => s.removeBlock)

  const newPosition = {
    x: hostBlockPosition.x - 40 + attachedCount * 240,
    y: hostBlockPosition.y + 210,
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setStep('type-select')
      setPendingUtility(null)
      setSelectedFields(new Set())
    }
  }

  function createAttachedUtility(utilityConfig: BlockConfig) {
    const newId = generateUUID()
    const { blocks } = useWorkflowStore.getState()
    const count = Object.values(blocks).filter((b) => b.type === utilityConfig.type).length
    const blockName = `${utilityConfig.name} ${count + 1}`

    addBlock(newId, utilityConfig.type, blockName, newPosition)

    const createdBlock = useWorkflowStore.getState().blocks[newId]
    if (!createdBlock) {
      toast.error('Utility block eklenemedi')
      return null
    }

    const edge = addEdge({
      id: generateUUID(),
      source: newId,
      target: hostBlockId,
      sourceHandle: 'utility-source',
      targetHandle: 'utility-target',
      type: 'heroEdge',
    })

    if (!edge) {
      removeBlock(newId)
      toast.error('Utility bağlantısı kurulamadı')
      return null
    }

    return {
      id: newId,
      blockName,
      normalizedName: normalizeBlockName(blockName),
      previousBlocks: blocks,
    }
  }

  function handleTypeClick(utilityConfig: BlockConfig) {
    const fields = UTILITY_OUTPUT_FIELDS[utilityConfig.type] ?? []
    const primary = utilityConfig.type === 'data_table' ? undefined : fields.find((f) => f.primary)
    setSelectedFields(new Set(primary ? [primary.path] : []))
    setPendingUtility(utilityConfig)
    // data_table gets a special mode-select step; all others go directly to field-select
    setStep(utilityConfig.type === 'data_table' ? 'mode-select' : 'field-select')
  }

  function toggleField(path: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // ── Write mode: utility edge + pre-configured block values ──────────────────
  function handleWriteMode() {
    if (!pendingUtility) return
    handleOpenChange(false)

    const utility = createAttachedUtility(pendingUtility)
    if (!utility) return

    // Determine host block's primary output for rawData pre-fill
    const hostBlock = utility.previousBlocks[hostBlockId]
    const normalizedHostName = hostBlock ? normalizeBlockName(hostBlock.name) : 'block'
    const hostType = hostBlock?.type ?? ''
    const primaryOutput = BLOCK_PRIMARY_OUTPUT[hostType] ?? 'response.result'
    const rawDataRef = `<${normalizedHostName}.${primaryOutput}>`
    const autoTableName = normalizedHostName

    // Pre-configure the new data table block
    const sub = useSubBlockStore.getState()
    sub.setValue(utility.id, 'operation', 'auto_save')
    sub.setValue(utility.id, 'tableName', autoTableName)
    sub.setValue(utility.id, 'rawData', rawDataRef)

    toast.success('Data Table eklendi', {
      description: `"${autoTableName}" tablosuna ${rawDataRef} yazılacak.`,
      duration: 4000,
    })
  }

  // ── Read mode: utility edge + field injection into host ───────────────────
  function handleReadMode() {
    if (!pendingUtility) return
    // Pre-select response.rows as default for read mode
    setSelectedFields(new Set(['response.rows']))
    setStep('field-select')
  }

  // ── Confirm for read/field-select path ────────────────────────────────────
  function handleConfirm() {
    if (!pendingUtility) return
    handleOpenChange(false)

    const utility = createAttachedUtility(pendingUtility)
    if (!utility) return

    // For data_table in read mode, pre-configure operation
    if (pendingUtility.type === 'data_table') {
      useSubBlockStore.getState().setValue(utility.id, 'operation', 'query_rows')
    }

    const hostBlock = utility.previousBlocks[hostBlockId]
    const hostConfig = hostBlock ? getBlock(hostBlock.type) : null
    const targetFieldId = hostConfig ? findBestInputField(hostConfig) : null

    if (targetFieldId && selectedFields.size > 0) {
      const refs = [...selectedFields]
        .map((path) => `<${utility.normalizedName}.${path}>`)
        .join('\n')
      const current = useSubBlockStore.getState().getValue(hostBlockId, targetFieldId)
      const currentStr = current != null ? String(current).trim() : ''
      useSubBlockStore
        .getState()
        .setValue(hostBlockId, targetFieldId, currentStr ? `${currentStr}\n${refs}` : refs)

      const fieldTitle =
        (hostConfig!.subBlocks as SubBlockConfig[]).find((sb) => sb.id === targetFieldId)?.title ??
        targetFieldId
      toast.success(`${pendingUtility.name} bağlandı`, {
        description: `${selectedFields.size} referans "${fieldTitle}" alanına eklendi.`,
        duration: 4000,
      })
    }
  }

  function handleSkip() {
    if (!pendingUtility) return
    const primary = UTILITY_OUTPUT_FIELDS[pendingUtility.type]?.find((f) => f.primary)
    if (primary) setSelectedFields(new Set([primary.path]))
    else setSelectedFields(new Set())
    setTimeout(() => handleConfirmWithFields(primary ? new Set([primary.path]) : new Set()), 0)
    handleOpenChange(false)
  }

  function handleConfirmWithFields(fields: Set<string>) {
    if (!pendingUtility) return
    const utility = createAttachedUtility(pendingUtility)
    if (!utility) return

    if (pendingUtility.type === 'data_table') {
      useSubBlockStore.getState().setValue(utility.id, 'operation', 'query_rows')
    }

    const { blocks: allBlocks } = useWorkflowStore.getState()
    const hostBlock = allBlocks[hostBlockId]
    const hostConfig = hostBlock ? getBlock(hostBlock.type) : null
    const targetFieldId = hostConfig ? findBestInputField(hostConfig) : null

    if (targetFieldId && fields.size > 0) {
      const refs = [...fields].map((path) => `<${utility.normalizedName}.${path}>`).join('\n')
      const current = useSubBlockStore.getState().getValue(hostBlockId, targetFieldId)
      const currentStr = current != null ? String(current).trim() : ''
      useSubBlockStore
        .getState()
        .setValue(hostBlockId, targetFieldId, currentStr ? `${currentStr}\n${refs}` : refs)
    }
  }

  const PendingIcon = pendingUtility?.icon

  // For data_table read mode, only show read-relevant fields
  const fieldsToShow =
    pendingUtility?.type === 'data_table'
      ? (UTILITY_OUTPUT_FIELDS['data_table'] ?? []).filter((f) => DATA_TABLE_READ_PATHS.has(f.path))
      : (UTILITY_OUTPUT_FIELDS[pendingUtility?.type ?? ''] ?? [])

  return (
    <div
      className={cn(
        'nodrag nopan absolute bottom-[-24px] left-1/2 -translate-x-1/2 z-50',
        'transition-opacity duration-200',
        open
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
      )}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenChange(true)
                }}
                className={cn(
                  'relative flex h-5 w-5 items-center justify-center rounded-full',
                  'smoky-glass-chip border border-purple-500/18 dark:border-purple-300/16',
                  'shadow-[0_6px_14px_rgba(168,85,247,0.10)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.24)]',
                  'transition-transform duration-200 cursor-pointer hover:scale-[1.06]'
                )}
                aria-label="Add utility block"
              >
                <span className="pointer-events-none absolute -top-[5px] left-1/2 h-[5px] w-px -translate-x-1/2 rounded-full bg-gradient-to-t from-purple-500/45 to-transparent dark:from-purple-300/42" />
                <Plus
                  className="relative z-10 h-3 w-3 text-purple-600 dark:text-purple-200"
                  strokeWidth={2.3}
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none"
          >
            Add utility block
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions={true}
          className={cn(
            'p-2.5 z-[9999]',
            'backdrop-blur-xl',
            'border border-white/20 dark:border-white/[0.08]',
            'shadow-[0_8px_32px_rgba(0,0,0,0.10),0_0_0_1px_rgba(255,255,255,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.40),0_0_0_1px_rgba(255,255,255,0.04)]',
            'rounded-xl'
          )}
          style={{
            background:
              'linear-gradient(155deg, rgba(255,255,255,0.82) 0%, rgba(243,245,248,0.72) 42%, rgba(229,232,237,0.60) 100%)',
            width: 'auto',
            maxWidth: 'min(320px, calc(100vw - 32px))',
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Dark mode glass override */}
          <style>{`.dark [data-radix-popper-content-wrapper] > [data-side] { background: linear-gradient(155deg, rgba(70,70,77,0.78) 0%, rgba(42,42,48,0.72) 44%, rgba(25,25,30,0.66) 100%) !important; }`}</style>

          {/* ── Step 1: Type selection — compact icon grid ── */}
          {step === 'type-select' && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {UTILITY_BLOCKS.map((utilityConfig) => {
                const Icon = utilityConfig.icon
                return (
                  <Tooltip key={utilityConfig.type}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTypeClick(utilityConfig)
                        }}
                        className={cn(
                          'relative w-10 h-10 rounded-lg flex items-center justify-center',
                          'backdrop-blur-sm',
                          'border border-black/[0.04] dark:border-white/[0.06]',
                          'hover:border-black/[0.10] dark:hover:border-white/[0.14]',
                          'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
                          'hover:scale-110 active:scale-95',
                          'transition-all duration-150 cursor-pointer',
                          'bg-white/40 dark:bg-white/[0.04]',
                          'hover:bg-white/70 dark:hover:bg-white/[0.08]'
                        )}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${utilityConfig.bgColor} 0%, ${utilityConfig.bgColor}BB 100%)`,
                          }}
                        >
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={4}
                      className="bg-[#1b1b1b] text-white border-none px-2 py-1"
                    >
                      <span className="text-[10px] font-logo font-semibold">
                        {utilityConfig.name}
                      </span>
                      {utilityConfig.description && (
                        <span className="text-[9px] font-logo text-white/50 block">
                          {utilityConfig.description}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )}

          {/* ── Step 1.5: Data Table mode selection (Read vs Write) ── */}
          {step === 'mode-select' && pendingUtility && (
            <div style={{ width: '220px' }}>
              <div className="flex items-center gap-2 px-0.5 pb-2 mb-2 border-b border-black/[0.05] dark:border-white/[0.05]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setStep('type-select')
                  }}
                  className="p-0.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <ArrowLeft
                    className="w-3.5 h-3.5 text-black/40 dark:text-white/50"
                    strokeWidth={1.5}
                  />
                </button>
                {PendingIcon && (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${pendingUtility.bgColor} 0%, ${pendingUtility.bgColor}BB 100%)`,
                    }}
                  >
                    <PendingIcon className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-[11px] font-logo font-semibold text-black/70 dark:text-white/80 truncate">
                  Data Table
                </span>
              </div>

              <div className="flex gap-2">
                {/* Write */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleWriteMode()
                  }}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg',
                    'border border-emerald-300/40 dark:border-emerald-700/30',
                    'bg-emerald-50/20 dark:bg-emerald-950/10',
                    'hover:bg-emerald-100/40 dark:hover:bg-emerald-900/20',
                    'hover:border-emerald-400/50 dark:hover:border-emerald-600/40',
                    'transition-all duration-150 cursor-pointer'
                  )}
                >
                  <span className="text-lg leading-none">✍️</span>
                  <span className="text-[10px] font-logo font-bold text-emerald-700 dark:text-emerald-300">
                    Kaydet
                  </span>
                </button>

                {/* Read */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReadMode()
                  }}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg',
                    'border border-blue-300/40 dark:border-blue-700/30',
                    'bg-blue-50/20 dark:bg-blue-950/10',
                    'hover:bg-blue-100/40 dark:hover:bg-blue-900/20',
                    'hover:border-blue-400/50 dark:hover:border-blue-600/40',
                    'transition-all duration-150 cursor-pointer'
                  )}
                >
                  <span className="text-lg leading-none">📖</span>
                  <span className="text-[10px] font-logo font-bold text-blue-700 dark:text-blue-300">
                    Oku
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Field selection — toggle chips ── */}
          {step === 'field-select' && pendingUtility && (
            <div style={{ width: '260px' }}>
              {/* Header */}
              <div className="flex items-center gap-2 px-0.5 pb-2 mb-2 border-b border-black/[0.05] dark:border-white/[0.05]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setStep(pendingUtility.type === 'data_table' ? 'mode-select' : 'type-select')
                  }}
                  className="p-0.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <ArrowLeft
                    className="w-3.5 h-3.5 text-black/40 dark:text-white/50"
                    strokeWidth={1.5}
                  />
                </button>
                {PendingIcon && (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${pendingUtility.bgColor} 0%, ${pendingUtility.bgColor}BB 100%)`,
                    }}
                  >
                    <PendingIcon className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-[11px] font-logo font-semibold text-black/70 dark:text-white/80 truncate">
                  {pendingUtility.name}
                </span>
              </div>

              {/* Field chips */}
              <div className="flex flex-wrap gap-1.5">
                {fieldsToShow.map((field) => {
                  const checked = selectedFields.has(field.path)
                  return (
                    <Tooltip key={field.path}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleField(field.path)
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-logo font-medium',
                            'border transition-all duration-150 cursor-pointer',
                            checked
                              ? 'bg-[#4A7A68]/10 dark:bg-[#94B8A6]/10 border-[#4A7A68]/30 dark:border-[#94B8A6]/30 text-[#4A7A68] dark:text-[#94B8A6]'
                              : 'bg-white/30 dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06] text-black/50 dark:text-white/50 hover:border-black/[0.12] dark:hover:border-white/[0.12]'
                          )}
                        >
                          {field.primary && (
                            <Star className="w-2 h-2 text-amber-400 fill-amber-400 flex-shrink-0" />
                          )}
                          {field.label}
                          <span
                            className={cn(
                              'text-[7px] font-bold uppercase tracking-wide opacity-60'
                            )}
                          >
                            {field.type}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        sideOffset={4}
                        className="bg-[#1b1b1b] text-white border-none px-2 py-1 max-w-[200px]"
                      >
                        <span className="text-[9px] font-logo">{field.desc}</span>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 pt-2 mt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleConfirm()
                  }}
                  disabled={selectedFields.size === 0}
                  className={cn(
                    'flex-1 text-[10px] font-logo font-semibold py-1.5 rounded-md transition-colors duration-150',
                    selectedFields.size > 0
                      ? 'bg-[#4A7A68] hover:bg-[#3d6557] dark:bg-[#94B8A6] dark:hover:bg-[#b0d0c0] text-white dark:text-black/90'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-black/30 dark:text-white/35 cursor-not-allowed'
                  )}
                >
                  Ekle{selectedFields.size > 0 ? ` (${selectedFields.size})` : ''}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSkip()
                  }}
                  className="text-[9px] font-logo text-black/30 dark:text-white/40 hover:text-black/55 dark:hover:text-white/65 transition-colors px-1"
                >
                  Atla
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
