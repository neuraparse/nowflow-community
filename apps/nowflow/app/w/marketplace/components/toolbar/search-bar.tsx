import { useRef, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
  initialValue: string
  onSearch: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function SearchBar({
  initialValue = '',
  onSearch,
  disabled = false,
  placeholder = 'Search workflows...',
}: SearchBarProps) {
  const [searchInputValue, setSearchInputValue] = useState(initialValue)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInputValue(value)

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set a new timeout for debounce
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value)
    }, 500) // 500ms debounce
  }

  return (
    <div className="relative w-full mb-4">
      <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchInputValue}
        onChange={handleSearchChange}
        className="pl-8 h-9 text-sm"
        disabled={disabled}
      />
    </div>
  )
}
