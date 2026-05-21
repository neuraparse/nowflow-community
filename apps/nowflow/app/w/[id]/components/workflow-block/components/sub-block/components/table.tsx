import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkEnvVarTrigger, EnvVarDropdown } from '@/components/ui/env-var-dropdown'
import { formatDisplayText } from '@/components/ui/formatted-text'
import { Input } from '@/components/ui/input'
import { checkTagTrigger, TagDropdown } from '@/components/ui/tag-dropdown'
import { cn } from '@/lib/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface TableProps {
  columns: string[]
  blockId: string
  subBlockId: string
}

interface TableRow {
  id: string
  cells: Record<string, string>
}

export function Table({ columns, blockId, subBlockId }: TableProps) {
  const [value, setValue] = useSubBlockValue(blockId, subBlockId)

  // Create refs for input elements
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Ensure value is properly typed and initialized
  const rows = useMemo(() => {
    if (!Array.isArray(value)) {
      return [
        {
          id: crypto.randomUUID(),
          cells: Object.fromEntries(columns.map((col) => [col, ''])),
        },
      ]
    }
    return value as TableRow[]
  }, [value, columns])

  // Add state for managing dropdowns
  const [activeCell, setActiveCell] = useState<{
    rowIndex: number
    column: string
    showEnvVars: boolean
    showTags: boolean
    cursorPosition: number
    searchTerm: string
    activeSourceBlockId: string | null
    element?: HTMLElement | null
  } | null>(null)

  // Sync overlay scroll with input scroll
  useEffect(() => {
    if (activeCell) {
      const cellKey = `${activeCell.rowIndex}-${activeCell.column}`
      const input = inputRefs.current.get(cellKey)
      const overlay = document.querySelector(`[data-overlay="${cellKey}"]`) as HTMLElement

      if (input && overlay) {
        const handleScroll = () => {
          overlay.scrollLeft = input.scrollLeft
        }

        input.addEventListener('scroll', handleScroll)
        return () => {
          input.removeEventListener('scroll', handleScroll)
        }
      }
    }
  }, [activeCell])

  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    const updatedRows = [...rows].map((row, idx) =>
      idx === rowIndex
        ? {
            ...row,
            cells: { ...row.cells, [column]: value },
          }
        : row
    )

    if (rowIndex === rows.length - 1 && value !== '') {
      updatedRows.push({
        id: crypto.randomUUID(),
        cells: Object.fromEntries(columns.map((col) => [col, ''])),
      })
    }

    setValue(updatedRows)
  }

  const handleDeleteRow = (rowIndex: number) => {
    if (rows.length === 1) return
    setValue(rows.filter((_, index) => index !== rowIndex))
  }

  const handleAddRow = () => {
    const newRow: TableRow = {
      id: crypto.randomUUID(),
      cells: Object.fromEntries(columns.map((col) => [col, ''])),
    }
    setValue([...rows, newRow])
  }

  const renderHeader = () => (
    <thead>
      <tr className="border-b border-border/60 bg-muted/30">
        {columns.map((column, index) => (
          <th
            key={column}
            className={cn(
              'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider',
              'text-muted-foreground',
              index < columns.length - 1 && 'border-r border-border/40'
            )}
          >
            {column}
          </th>
        ))}
        <th className="w-10" />
      </tr>
    </thead>
  )

  const renderCell = (row: TableRow, rowIndex: number, column: string, cellIndex: number) => {
    const cellValue = row.cells[column] || ''
    const cellKey = `${rowIndex}-${column}`
    const isActive = activeCell?.rowIndex === rowIndex && activeCell?.column === column

    return (
      <td
        key={`${row.id}-${column}`}
        className={cn(
          'p-1 relative',
          'transition-colors duration-150',
          cellIndex < columns.length - 1 && 'border-r border-border/40',
          isActive && 'bg-primary/5'
        )}
      >
        <div className="relative w-full">
          <Input
            ref={(el) => {
              if (el) inputRefs.current.set(cellKey, el)
            }}
            value={cellValue}
            placeholder={column}
            onChange={(e) => {
              const newValue = e.target.value
              const cursorPosition = e.target.selectionStart ?? 0

              handleCellChange(rowIndex, column, newValue)

              // Check for triggers
              const envVarTrigger = checkEnvVarTrigger(newValue, cursorPosition)
              const tagTrigger = checkTagTrigger(newValue, cursorPosition)

              setActiveCell({
                rowIndex,
                column,
                showEnvVars: envVarTrigger.show,
                showTags: tagTrigger.show,
                cursorPosition,
                searchTerm: envVarTrigger.show ? envVarTrigger.searchTerm : '',
                activeSourceBlockId: null,
                element: e.target,
              })
            }}
            onFocus={(e) => {
              setActiveCell({
                rowIndex,
                column,
                showEnvVars: false,
                showTags: false,
                cursorPosition: 0,
                searchTerm: '',
                activeSourceBlockId: null,
                element: e.target,
              })
            }}
            onBlur={() => {
              setTimeout(() => {
                setActiveCell(null)
              }, 200)
            }}
            onPaste={(e) => {
              e.preventDefault()
              const plainText = e.clipboardData.getData('text/plain')
              const input = e.currentTarget
              const start = input.selectionStart ?? 0
              const end = input.selectionEnd ?? 0
              const newValue = cellValue.slice(0, start) + plainText + cellValue.slice(end)
              handleCellChange(rowIndex, column, newValue)
              const newCursorPos = start + plainText.length
              requestAnimationFrame(() => {
                input.selectionStart = newCursorPos
                input.selectionEnd = newCursorPos
              })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setActiveCell(null)
              }
            }}
            className={cn(
              'overlay-input border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              'placeholder:text-muted-foreground/40 w-full',
              'h-9 bg-transparent'
            )}
            style={{
              WebkitTextFillColor: 'transparent',
              color: 'var(--color-foreground)',
              caretColor: 'var(--color-foreground)',
              fontSize: '0.875rem',
            }}
          />
          <div
            data-overlay={cellKey}
            className="absolute inset-0 pointer-events-none px-3.5 flex items-center bg-transparent overflow-hidden whitespace-pre overlay-text-container"
            style={{ color: 'var(--color-foreground)', fontSize: '0.875rem' }}
          >
            {formatDisplayText(cellValue)}
          </div>
        </div>
      </td>
    )
  }

  const renderDeleteButton = (rowIndex: number) => (
    <td className="w-10 p-0 text-center">
      {rows.length > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 opacity-0 group-hover:opacity-100',
            'hover:bg-destructive/10 hover:text-destructive',
            'transition-all duration-150'
          )}
          onClick={() => handleDeleteRow(rowIndex)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </td>
  )

  return (
    <div className="relative space-y-2">
      {/* Table Container */}
      <div
        className={cn(
          'border rounded-lg overflow-hidden',
          'border-border/60 shadow-sm',
          'bg-background/50'
        )}
      >
        <table className="w-full">
          {renderHeader()}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-border/40 group',
                  'hover:bg-muted/30 transition-colors duration-150'
                )}
              >
                {columns.map((column, cellIndex) => renderCell(row, rowIndex, column, cellIndex))}
                {renderDeleteButton(rowIndex)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with row count and add button */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddRow}
          className={cn(
            'h-7 px-2 text-xs',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-muted/50'
          )}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Row
        </Button>
      </div>

      {activeCell?.element && (
        <>
          <EnvVarDropdown
            visible={activeCell.showEnvVars}
            onSelect={(newValue) => {
              handleCellChange(activeCell.rowIndex, activeCell.column, newValue)
              setActiveCell(null)
            }}
            searchTerm={activeCell.searchTerm}
            inputValue={rows[activeCell.rowIndex].cells[activeCell.column] || ''}
            cursorPosition={activeCell.cursorPosition}
            onClose={() => {
              setActiveCell((prev) => (prev ? { ...prev, showEnvVars: false } : null))
            }}
            className="w-[200px] absolute"
          />
          <TagDropdown
            visible={activeCell.showTags}
            onSelect={(newValue) => {
              handleCellChange(activeCell.rowIndex, activeCell.column, newValue)
              setActiveCell(null)
            }}
            blockId={blockId}
            activeSourceBlockId={activeCell.activeSourceBlockId}
            inputValue={rows[activeCell.rowIndex].cells[activeCell.column] || ''}
            cursorPosition={activeCell.cursorPosition}
            onClose={() => {
              setActiveCell((prev) =>
                prev ? { ...prev, showTags: false, activeSourceBlockId: null } : null
              )
            }}
            className="absolute"
          />
        </>
      )}
    </div>
  )
}
