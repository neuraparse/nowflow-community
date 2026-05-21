/** @vitest-environment jsdom */
/**
 * UI tests for the Settings → AI Providers screen.
 *
 * Covers the full user-visible flow:
 *   - empty-state rendering (no keys saved yet)
 *   - adding a labeled key via the inline form
 *   - editing the key value (typing into the input writes to the store)
 *   - toggling password visibility (eye / eye-off)
 *   - promoting an additional key to the default slot
 *   - deleting a key
 *   - default-model preference (provider radio + model select)
 *   - cross-block guarantee — a key set here is visible to `resolveApiKey`
 *
 * The store is the same singleton used by every block in the app, so these
 * tests double as a regression suite for "the key I set in one block isn't
 * visible to another" bugs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useModelSettingsStore } from '@/stores/model-settings/store'
import { AIProviders } from '@/app/w/components/sidebar/components/settings-modal/components/ai-providers/ai-providers'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('@/stores/safe-storage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// We don't care about ollama models in these tests — return an empty list
vi.mock('@/stores/ollama/store', () => ({
  useOllamaStore: {
    getState: () => ({
      models: [],
      isLoading: false,
      refreshModels: vi.fn(),
      refreshIfNeeded: vi.fn(),
    }),
  },
}))

// Stub provider icons so we don't pull in the entire SVG library
vi.mock('@/components/icons/model-icons', () => ({
  ProviderIcon: ({ providerId, className }: { providerId: string; className?: string }) => (
    <span data-testid={`provider-icon-${providerId}`} className={className} />
  ),
  ModelIcon: () => null,
  PROVIDER_COLORS: {},
}))

// ─── Helpers ──────────────────────────────────────────────────────────

function resetStore() {
  useModelSettingsStore.setState(
    (prev) => ({
      ...prev,
      apiKeys: {},
      additionalApiKeys: {},
      defaultPreference: null,
      recentModels: [],
      providerTemperatures: {},
    }),
    true
  )
}

/** Find the rendered card section for a given provider label (e.g. 'OpenAI'). */
function getProviderCard(providerLabel: string) {
  // The expandable trigger button contains the provider's name
  const trigger = screen.getAllByRole('button').find((b) => within(b).queryByText(providerLabel))
  if (!trigger) throw new Error(`No card found for ${providerLabel}`)
  // The card body sits as the trigger's next sibling
  return trigger.parentElement as HTMLElement
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('AIProviders settings page', () => {
  beforeEach(() => {
    resetStore()
    // Reset global fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    ) as any
  })

  it('renders the header with key count of 0 when nothing is saved', () => {
    render(<AIProviders />)
    expect(screen.getByText('AI Providers')).toBeInTheDocument()
    expect(screen.getByText(/0 keys configured/i)).toBeInTheDocument()
  })

  it('renders a card for every provider that requires an API key', () => {
    render(<AIProviders />)
    // OpenAI / Anthropic / Google / xAI / DeepSeek / Cerebras / Groq are required
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getByText('xAI (Grok)')).toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
    // Ollama doesn't require a key — should NOT show a key-management card
    expect(screen.queryByText('Local (Ollama)')).not.toBeInTheDocument()
  })

  it('shows the default-key empty input when no keys exist for a provider', () => {
    render(<AIProviders />)
    const card = getProviderCard('OpenAI')
    // "Default" label visible
    expect(within(card).getByText('Default')).toBeInTheDocument()
    // The default input is rendered with the API-key placeholder
    expect(within(card).getByPlaceholderText('API key')).toBeInTheDocument()
  })

  describe('Add key flow', () => {
    it('opens the add-key form, fills both inputs, saves to the store', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      // Empty initially
      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toBeUndefined()

      await user.click(within(card).getByRole('button', { name: /add another key/i }))

      const labelInput = within(card).getByPlaceholderText(/Label \(e\.g\. Personal/i)
      // After clicking "Add another key" the empty default row + the new add form
      // both contain an API-key placeholder input. Target the last one (inside the
      // add form) by index.
      const allKeyInputs = within(card).getAllByPlaceholderText('API key')
      const newKeyInput = allKeyInputs[allKeyInputs.length - 1]

      await user.type(labelInput, 'Personal')
      await user.type(newKeyInput, 'personal-key-123')
      await user.click(within(card).getByRole('button', { name: /save key/i }))

      const list = useModelSettingsStore.getState().additionalApiKeys.openai
      expect(list).toHaveLength(1)
      expect(list?.[0].label).toBe('Personal')
      expect(list?.[0].apiKey).toBe('personal-key-123')
    })

    it('disables the "Save key" button while the value is empty', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      await user.click(within(card).getByRole('button', { name: /add another key/i }))
      const saveBtn = within(card).getByRole('button', { name: /save key/i })
      expect(saveBtn).toBeDisabled()

      const allInputs = within(card).getAllByPlaceholderText('API key')
      await user.type(allInputs[allInputs.length - 1], 'temporary-key')
      expect(saveBtn).not.toBeDisabled()
    })

    it('cancels the add-key form without saving anything', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      await user.click(within(card).getByRole('button', { name: /add another key/i }))
      const allInputs = within(card).getAllByPlaceholderText('API key')
      await user.type(allInputs[allInputs.length - 1], 'uncommitted-key')
      await user.click(within(card).getByRole('button', { name: /cancel/i }))

      expect(useModelSettingsStore.getState().additionalApiKeys.openai).toBeUndefined()
    })
  })

  describe('Default-slot editing', () => {
    it('typing in the default input writes to the store', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      const defaultInput = within(card).getByPlaceholderText('API key')
      await user.type(defaultInput, 'direct-key')
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('direct-key')
    })

    it('clearing the default input PRESERVES the key entry (no auto-delete)', async () => {
      // Empty value mid-edit must not destroy the saved entry — the user might
      // be select-all-deleting before retyping. Removal happens via the trash
      // button, not via blanking the input.
      useModelSettingsStore.getState().setApiKey('openai', 'existing-key')
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      const defaultInput = within(card).getByDisplayValue('existing-key')
      await user.clear(defaultInput)
      // Entry still exists, just with empty apiKey
      expect(useModelSettingsStore.getState().apiKeys.openai).toBeDefined()
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('')
    })

    it('clearing then retyping preserves the slot (no transient delete)', async () => {
      useModelSettingsStore.getState().setApiKey('openai', 'old-key')
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      const input = within(card).getByDisplayValue('old-key') as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'new-key')
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('new-key')
    })
  })

  describe('Show / hide key', () => {
    it('toggles the input type between password and text', async () => {
      useModelSettingsStore.getState().setApiKey('openai', 'secret-key')
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      const input = within(card).getByDisplayValue('secret-key') as HTMLInputElement
      expect(input.type).toBe('password')

      // The eye toggle is the right-aligned button inside the input wrapper
      const toggles = within(card)
        .getAllByRole('button')
        .filter((b) => b.querySelector('svg.lucide-eye, svg.lucide-eye-off'))
      await user.click(toggles[0])
      expect(input.type).toBe('text')
      await user.click(toggles[0])
      expect(input.type).toBe('password')
    })
  })

  describe('Promote to default', () => {
    it('moves a labeled key into the default slot and demotes the previous default', async () => {
      useModelSettingsStore.getState().setApiKey('openai', 'old-default-key')
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'Work', 'work-key')
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      // The promote button has title="Make default" — find by aria/title attribute
      const promoteBtns = within(card)
        .getAllByRole('button')
        .filter((b) => b.getAttribute('title') === 'Make default')
      expect(promoteBtns).toHaveLength(1)
      await user.click(promoteBtns[0])

      // After promote: 'work-key' is now default, 'old-default-key' is in additional list
      expect(useModelSettingsStore.getState().apiKeys.openai?.apiKey).toBe('work-key')
      const list = useModelSettingsStore.getState().additionalApiKeys.openai!
      expect(list.some((k) => k.apiKey === 'old-default-key')).toBe(true)
      // The originally-promoted id is gone (was moved into default)
      expect(list.some((k) => k.id === id)).toBe(false)
    })
  })

  describe('Delete key', () => {
    it('removes the targeted labeled key from the store', async () => {
      const id = useModelSettingsStore.getState().addAdditionalKey('openai', 'A', 'key-a')
      useModelSettingsStore.getState().addAdditionalKey('openai', 'B', 'key-b')
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      // Two trash buttons (one per key). Click the first.
      const trashBtns = within(card)
        .getAllByRole('button')
        .filter((b) => b.querySelector('svg.lucide-trash, svg.lucide-trash-2'))
      expect(trashBtns.length).toBeGreaterThanOrEqual(2)
      await user.click(trashBtns[0])

      const remaining = useModelSettingsStore.getState().additionalApiKeys.openai!
      expect(remaining).toHaveLength(1)
      // The first key (id from the const above) was deleted
      expect(remaining.some((k) => k.id === id)).toBe(false)
    })
  })

  describe('Default-model preference', () => {
    it('shows the default-model section', () => {
      render(<AIProviders />)
      expect(screen.getByText('Default Model')).toBeInTheDocument()
      expect(
        screen.getByText(/Newly added blocks open with this provider\/model selected/i)
      ).toBeInTheDocument()
    })

    it('reflects an existing default preference in the UI state', () => {
      useModelSettingsStore.getState().setDefaultPreference({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      })
      render(<AIProviders />)
      // The Radix Select trigger renders the value as plain text — assert it's there
      expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
    })
  })

  describe('Header key count', () => {
    it('updates total key count when keys are added', async () => {
      render(<AIProviders />)
      expect(screen.getByText(/0 keys configured/i)).toBeInTheDocument()

      // Add one programmatically; render again to reflect new state
      useModelSettingsStore.getState().setApiKey('openai', 'key-1')
      useModelSettingsStore.getState().addAdditionalKey('openai', 'B', 'key-2')
      useModelSettingsStore.getState().setApiKey('anthropic', 'key-3')

      // Re-render with the updated state
      const { container } = render(<AIProviders />)
      // Use container scope to disambiguate from the first render's stale text
      expect(within(container).getByText(/3 keys configured/i)).toBeInTheDocument()
    })
  })

  describe('Cross-block consistency', () => {
    it('a key added through this UI is resolvable via the same store', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')

      await user.click(within(card).getByRole('button', { name: /add another key/i }))
      await user.type(within(card).getByPlaceholderText(/Label \(e\.g\. Personal/i), 'Cross')
      const inputs = within(card).getAllByPlaceholderText('API key')
      await user.type(inputs[inputs.length - 1], 'cross-key')
      await user.click(within(card).getByRole('button', { name: /save key/i }))

      // The same store any other block reads from
      const all = useModelSettingsStore.getState().listAllKeys('openai')
      expect(all.some((k) => k.apiKey === 'cross-key' && k.label === 'Cross')).toBe(true)
    })
  })

  describe('Verify key', () => {
    it('calls /api/ai/test-key and marks the key valid on success', async () => {
      useModelSettingsStore.getState().setApiKey('openai', 'verify-key')
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as any)

      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      const verifyBtn = within(card).getByRole('button', { name: /verify/i })
      await user.click(verifyBtn)

      // Wait a microtask for the async test handler to complete
      await new Promise((r) => setTimeout(r, 0))

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/ai/test-key',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ provider: 'openai', apiKey: 'verify-key' }),
        })
      )
      expect(useModelSettingsStore.getState().apiKeys.openai?.isValid).toBe(true)
    })

    it('marks the key invalid when the endpoint returns success=false', async () => {
      useModelSettingsStore.getState().setApiKey('openai', 'key-bad')
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      } as any)

      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      await user.click(within(card).getByRole('button', { name: /verify/i }))
      await new Promise((r) => setTimeout(r, 0))

      expect(useModelSettingsStore.getState().apiKeys.openai?.isValid).toBe(false)
    })
  })

  describe('Collapse / expand provider card', () => {
    it('collapses the body when the header is clicked', async () => {
      const user = userEvent.setup()
      render(<AIProviders />)
      const card = getProviderCard('OpenAI')
      // body visible
      expect(within(card).getByText('Default')).toBeInTheDocument()

      // Click the header trigger (the one containing "OpenAI")
      const trigger = within(card)
        .getAllByRole('button')
        .find((b) => within(b).queryByText('OpenAI'))!
      await user.click(trigger)
      // body gone after collapse
      expect(within(card).queryByText('Default')).not.toBeInTheDocument()
    })
  })

  // Suppress unused-import warning — imported for future tests
  it('test-runtime smoke: fireEvent is available', () => {
    expect(typeof fireEvent.click).toBe('function')
  })
})
