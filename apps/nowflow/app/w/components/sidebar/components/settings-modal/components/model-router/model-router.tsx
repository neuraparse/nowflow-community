'use client'

import { useState } from 'react'
import { BarChart3, Brain, Cpu, DollarSign, Info, RefreshCw, Settings2, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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

interface ModelTierConfig {
  brain: string
  muscle: string
  micro: string
}

interface RoutingSettings {
  smartRouting: boolean
  costBudget: string
  preferredProvider: string
}

const MODEL_OPTIONS: Record<string, string[]> = {
  anthropic: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
  ollama: ['llama3', 'mistral', 'phi3'],
}

export function ModelRouter() {
  const [tierConfig, setTierConfig] = useState<ModelTierConfig>({
    brain: 'claude-opus-4-20250514',
    muscle: 'claude-sonnet-4-20250514',
    micro: 'claude-haiku-3-5-20241022',
  })

  const [routingSettings, setRoutingSettings] = useState<RoutingSettings>({
    smartRouting: true,
    costBudget: '5.00',
    preferredProvider: 'anthropic',
  })

  const [isDetectingOllama, setIsDetectingOllama] = useState(false)

  const availableModels = MODEL_OPTIONS[routingSettings.preferredProvider] || []

  const handleDetectOllama = async () => {
    setIsDetectingOllama(true)
    // Simulate detection delay
    setTimeout(() => {
      setIsDetectingOllama(false)
    }, 1500)
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-logo font-semibold mb-1 text-zinc-800 dark:text-white flex items-center gap-2.5">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <Brain className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
          </span>
          AI Model Routing
        </h2>
        <p className="text-[12px] font-logo text-black/50 dark:text-white/60 mb-3 ml-9">
          Route tasks to the right model tier. Use powerful models for complex reasoning and lighter
          models for simple tasks to optimize cost and speed.
        </p>
      </div>

      {/* Model Tier Configuration */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4" strokeWidth={1.5} />
          Model Tier Configuration
        </h3>
        <div className="space-y-2">
          {/* Brain Tier */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/[0.08] dark:bg-purple-400/[0.10] p-1.5 rounded-lg">
                <Brain className="h-4 w-4 text-purple-500 dark:text-purple-400" strokeWidth={1.5} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                    Brain Tier
                  </Label>
                  <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] px-1.5 py-0">
                    Brain
                  </Badge>
                </div>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Complex reasoning, orchestration, code generation
                </p>
              </div>
            </div>
            <Select
              value={tierConfig.brain}
              onValueChange={(v) => setTierConfig((prev) => ({ ...prev, brain: v }))}
            >
              <SelectTrigger className="w-[200px] h-8 text-[13px] font-logo focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Muscle Tier */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-blue-500/[0.08] dark:bg-blue-400/[0.10] p-1.5 rounded-lg">
                <Zap className="h-4 w-4 text-blue-500 dark:text-blue-400" strokeWidth={1.5} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                    Muscle Tier
                  </Label>
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0">
                    Muscle
                  </Badge>
                </div>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Text generation, summarization, extraction
                </p>
              </div>
            </div>
            <Select
              value={tierConfig.muscle}
              onValueChange={(v) => setTierConfig((prev) => ({ ...prev, muscle: v }))}
            >
              <SelectTrigger className="w-[200px] h-8 text-[13px] font-logo focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Micro Tier */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/[0.08] dark:bg-emerald-400/[0.10] p-1.5 rounded-lg">
                <Cpu className="h-4 w-4 text-emerald-500 dark:text-emerald-400" strokeWidth={1.5} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                    Micro Tier
                  </Label>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">
                    Micro
                  </Badge>
                </div>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Simple Q&A, validation, formatting
                </p>
              </div>
            </div>
            <Select
              value={tierConfig.micro}
              onValueChange={(v) => setTierConfig((prev) => ({ ...prev, micro: v }))}
            >
              <SelectTrigger className="w-[200px] h-8 text-[13px] font-logo focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Routing Settings */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
          Routing Settings
        </h3>
        <div className="space-y-2">
          {/* Smart Routing Toggle */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Brain className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </span>
              <div>
                <Label
                  htmlFor="smart-routing"
                  className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white"
                >
                  Enable Smart Routing
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Automatically select the best model tier based on task complexity.
                </p>
              </div>
            </div>
            <Switch
              id="smart-routing"
              checked={routingSettings.smartRouting}
              onCheckedChange={(checked) =>
                setRoutingSettings((prev) => ({ ...prev, smartRouting: checked }))
              }
              className="data-[state=checked]:bg-[#4A7A68] dark:data-[state=checked]:bg-[#94B8A6]"
            />
          </div>

          {/* Cost Budget */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <DollarSign
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Cost Budget
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Maximum USD spend per workflow execution.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40">$</span>
              <Input
                type="number"
                step="0.50"
                min="0"
                value={routingSettings.costBudget}
                onChange={(e) =>
                  setRoutingSettings((prev) => ({ ...prev, costBudget: e.target.value }))
                }
                className="w-[90px] h-8 text-[13px] font-logo"
                placeholder="5.00"
              />
            </div>
          </div>

          {/* Preferred Provider */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Settings2
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Preferred Provider
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Default AI provider for model tier assignments.
                </p>
              </div>
            </div>
            <Select
              value={routingSettings.preferredProvider}
              onValueChange={(v) =>
                setRoutingSettings((prev) => ({ ...prev, preferredProvider: v }))
              }
            >
              <SelectTrigger className="w-[140px] h-8 text-[13px] font-logo focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto-detect Ollama */}
          <div className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-1.5 px-2.5 transition-all duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <Cpu className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Auto-detect Ollama Models
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Scan for locally running Ollama models to use in tiers.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectOllama}
              disabled={isDetectingOllama}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isDetectingOllama ? 'animate-spin' : ''}`} />
              {isDetectingOllama ? 'Detecting...' : 'Detect'}
            </Button>
          </div>
        </div>
      </div>

      {/* Cost Analytics */}
      <div>
        <h3 className="text-[12px] font-logo font-semibold text-zinc-800 dark:text-white mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
          Cost Analytics
        </h3>
        <div className="space-y-2">
          {/* Savings Summary */}
          <div className="flex items-center gap-2.5 p-3 bg-[#4A7A68]/[0.04] dark:bg-[#94B8A6]/[0.06] border border-[#4A7A68]/15 dark:border-[#94B8A6]/12 rounded-lg">
            <span className="bg-[#4A7A68]/[0.10] dark:bg-[#94B8A6]/[0.12] p-1.5 rounded-lg shrink-0">
              <DollarSign
                className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                strokeWidth={1.5}
              />
            </span>
            <div>
              <p className="text-[12px] font-logo font-medium text-[#4A7A68] dark:text-[#94B8A6]">
                Estimated Savings
              </p>
              <p className="text-[11px] font-logo text-[#4A7A68]/70 dark:text-[#94B8A6]/70 mt-0.5">
                Smart routing can reduce costs by up to 60% by directing simple tasks to lighter
                models while preserving quality for complex reasoning.
              </p>
            </div>
          </div>

          {/* Tier Distribution */}
          <div className="silver-glass-pane rounded-lg bg-transparent py-2 px-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                <BarChart3
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
              </span>
              <div>
                <Label className="font-logo font-medium text-[12px] text-zinc-800 dark:text-white">
                  Model Tier Distribution
                </Label>
                <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-0.5">
                  Estimated task routing across tiers.
                </p>
              </div>
            </div>
            <div className="space-y-1.5 ml-9">
              {/* Brain bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-logo font-medium text-purple-500 dark:text-purple-400 w-12">
                  Brain
                </span>
                <div className="flex-1 h-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full w-[20%] bg-purple-500/60 dark:bg-purple-400/60 rounded-full" />
                </div>
                <span className="text-[10px] font-logo text-zinc-400 dark:text-white/40 w-8 text-right">
                  20%
                </span>
              </div>
              {/* Muscle bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-logo font-medium text-blue-500 dark:text-blue-400 w-12">
                  Muscle
                </span>
                <div className="flex-1 h-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full w-[45%] bg-blue-500/60 dark:bg-blue-400/60 rounded-full" />
                </div>
                <span className="text-[10px] font-logo text-zinc-400 dark:text-white/40 w-8 text-right">
                  45%
                </span>
              </div>
              {/* Micro bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-logo font-medium text-emerald-500 dark:text-emerald-400 w-12">
                  Micro
                </span>
                <div className="flex-1 h-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full w-[35%] bg-emerald-500/60 dark:bg-emerald-400/60 rounded-full" />
                </div>
                <span className="text-[10px] font-logo text-zinc-400 dark:text-white/40 w-8 text-right">
                  35%
                </span>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 px-2.5 py-1.5">
            <Info
              className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30 mt-0.5 shrink-0"
              strokeWidth={1.5}
            />
            <p className="text-[10px] font-logo text-zinc-400 dark:text-white/30">
              Analytics will populate once workflows begin executing with model routing enabled.
              Distribution percentages shown above are estimates based on typical usage patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
