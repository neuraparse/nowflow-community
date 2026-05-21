'use client'

import { useState } from 'react'
import { Globe, HelpCircle, List, Mic, Play, Send, Square, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Voice')

interface VoiceSettings {
  enabled: boolean
  language: string
  wakeWord: string
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: false,
  language: 'en',
  wakeWord: 'Hey NowFlow',
}

const VOICE_COMMANDS = [
  { command: 'Run [workflow]', description: 'Starts a workflow', icon: Play },
  { command: 'Check status', description: 'Shows workflow status', icon: Terminal },
  { command: 'List workflows', description: 'Lists your workflows', icon: List },
  { command: 'Stop [workflow]', description: 'Stops execution', icon: Square },
  { command: 'Help', description: 'Shows available commands', icon: HelpCircle },
]

export function Voice() {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS)
  const [testCommand, setTestCommand] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const updateSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleTestCommand = async () => {
    if (!testCommand.trim()) return

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCommand }),
      })

      if (response.ok) {
        const data = await response.json()
        setTestResult(data.text || 'Command processed successfully.')
      } else {
        setTestResult('Failed to process command.')
      }
    } catch (error) {
      logger.error('Failed to test voice command:', error)
      setTestResult('Error: Could not reach the voice command service.')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <Mic className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
          </span>
          Voice Commands
        </h2>
        <p className="text-[12px] font-logo text-black/50 dark:text-white/60 mb-3 ml-9">
          Control your workflows with voice commands.
        </p>
      </div>

      {/* Voice Settings */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <Mic className="h-4 w-4" strokeWidth={1.5} />
          Voice Settings
        </h3>
        <div className="space-y-2.5">
          {/* Enable Voice Commands */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Mic className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </span>
              <div>
                <Label
                  htmlFor="voice-enabled"
                  className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium"
                >
                  Enable Voice Commands
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Allow voice input to control workflows and navigation.
                </p>
              </div>
            </div>
            <Switch
              id="voice-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSetting('enabled', checked)}
              className="data-[state=checked]:bg-[#4A7A68] dark:data-[state=checked]:bg-[#94B8A6]"
            />
          </div>

          {/* Language */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Globe className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Language
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Select the language for voice recognition.
                </p>
              </div>
            </div>
            <Select
              value={settings.language}
              onValueChange={(value) => updateSetting('language', value)}
            >
              <SelectTrigger className="w-[140px] h-8 text-[13px] font-logo focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tr">Turkish</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Wake Word */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Mic className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Wake Word
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  The phrase that activates voice listening.
                </p>
              </div>
            </div>
            <Input
              value={settings.wakeWord}
              onChange={(e) => updateSetting('wakeWord', e.target.value)}
              className="w-[160px] h-8 text-[13px] font-logo"
              placeholder="Hey NowFlow"
            />
          </div>
        </div>
      </div>

      {/* Available Commands */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4" strokeWidth={1.5} />
          Available Commands
        </h3>
        <div className="space-y-1">
          {VOICE_COMMANDS.map(({ command, description, icon: Icon }) => (
            <div
              key={command}
              className="silver-glass-pane flex items-center gap-2 rounded-md bg-transparent py-1 px-2 transition-all duration-200"
            >
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1 rounded-md">
                <Icon
                  className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <div className="flex items-center gap-2">
                <code className="px-2 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/[0.08] text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {command}
                </code>
                <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                  {description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Voice */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <Send className="h-4 w-4" strokeWidth={1.5} />
          Test Voice
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="silver-glass-pane flex-1 flex items-center gap-2 rounded-lg bg-transparent py-1 px-2.5">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1 rounded-md">
                <Terminal
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <Input
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTestCommand()
                }}
                className="border-0 shadow-none focus-visible:ring-0 text-[13px] font-logo px-0"
                placeholder="Type a test command..."
              />
            </div>
            <Button
              onClick={handleTestCommand}
              disabled={isTesting || !testCommand.trim()}
              size="sm"
              className="bg-[#4A7A68] hover:bg-[#4A7A68]/90 dark:bg-[#94B8A6] dark:hover:bg-[#94B8A6]/90 text-white dark:text-zinc-900 transition-all duration-200"
            >
              <Send className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
              {isTesting ? 'Sending...' : 'Send'}
            </Button>
          </div>

          {testResult && (
            <div className="flex items-center gap-2 p-2 bg-[#4A7A68]/[0.04] dark:bg-[#94B8A6]/[0.06] border border-[#4A7A68]/15 dark:border-[#94B8A6]/12 rounded-lg">
              <span className="bg-[#4A7A68]/[0.10] dark:bg-[#94B8A6]/[0.12] p-1 rounded-md shrink-0">
                <Terminal
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <p className="text-[11px] font-logo text-[#4A7A68]/80 dark:text-[#94B8A6]/80">
                {testResult}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
