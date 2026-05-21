'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Activity, Clock, Eye, Minimize2, Settings, Zap } from 'lucide-react'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('workflow-performance-monitor')

interface PerformanceMetrics {
  fps: number
  nodeCount: number
  edgeCount: number
  visibleNodes: number
  visibleEdges: number
  renderTime: number
  memoryUsage: number
  lastUpdate: number
}

interface PerformanceSettings {
  enableViewportCulling: boolean
  cullingThreshold: number
  enableLOD: boolean
  lodThreshold: number
  enableGPUAcceleration: boolean
  maxFPS: number
  enableAnimations: boolean
  renderQuality: 'low' | 'medium' | 'high'
}

export function WorkflowPerformanceMonitor() {
  const { getNodes, getEdges, getViewport } = useReactFlow()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    nodeCount: 0,
    edgeCount: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    renderTime: 0,
    memoryUsage: 0,
    lastUpdate: Date.now(),
  })
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true) // Start ultra minimized
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<PerformanceSettings>({
    enableViewportCulling: false,
    cullingThreshold: 200,
    enableLOD: false,
    lodThreshold: 0.3,
    enableGPUAcceleration: true,
    maxFPS: 60,
    enableAnimations: true,
    renderQuality: 'high',
  })
  const renderStartTime = useRef(0)

  // Real FPS calculation — only runs when monitor is visible (not in production)
  useEffect(() => {
    if (!isVisible) return

    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number

    const calculateFPS = () => {
      frameCount++
      const now = performance.now()
      const delta = now - lastTime

      if (delta >= 1000) {
        const actualFPS = Math.round((frameCount * 1000) / delta)
        frameCount = 0
        lastTime = now
        setMetrics((prev) => ({ ...prev, fps: actualFPS }))
      }

      animationId = requestAnimationFrame(calculateFPS)
    }

    animationId = requestAnimationFrame(calculateFPS)
    return () => cancelAnimationFrame(animationId)
  }, [isVisible])

  // Performance metrics calculation — only runs when visible
  useEffect(() => {
    if (!isVisible) return

    const updateMetrics = () => {
      renderStartTime.current = performance.now()

      const nodes = getNodes()
      const edges = getEdges()
      const viewport = getViewport()

      // Calculate visible elements (viewport culling simulation)
      const viewportBounds = {
        left: -viewport.x / viewport.zoom,
        right: (-viewport.x + window.innerWidth) / viewport.zoom,
        top: -viewport.y / viewport.zoom,
        bottom: (-viewport.y + window.innerHeight) / viewport.zoom,
      }

      const visibleNodes = nodes.filter((node) => {
        const nodeRight = node.position.x + 200 // Approximate node width
        const nodeBottom = node.position.y + 100 // Approximate node height

        return !(
          node.position.x > viewportBounds.right ||
          nodeRight < viewportBounds.left ||
          node.position.y > viewportBounds.bottom ||
          nodeBottom < viewportBounds.top
        )
      }).length

      const visibleEdges = edges.filter((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.target)

        if (!sourceNode || !targetNode) return false

        const minX = Math.min(sourceNode.position.x, targetNode.position.x)
        const maxX = Math.max(sourceNode.position.x, targetNode.position.x)
        const minY = Math.min(sourceNode.position.y, targetNode.position.y)
        const maxY = Math.max(sourceNode.position.y, targetNode.position.y)

        return !(
          maxX < viewportBounds.left ||
          minX > viewportBounds.right ||
          maxY < viewportBounds.top ||
          minY > viewportBounds.bottom
        )
      }).length

      // Memory usage (approximate)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0

      const renderTime = performance.now() - renderStartTime.current

      setMetrics((prev) => ({
        ...prev,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        visibleNodes,
        visibleEdges,
        renderTime,
        memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
        lastUpdate: Date.now(),
      }))
    }

    const interval = setInterval(updateMetrics, 5000)
    updateMetrics()

    return () => clearInterval(interval)
  }, [isVisible, getNodes, getEdges, getViewport])

  // Performance status
  const getPerformanceStatus = () => {
    if (metrics.fps >= 55) return { status: 'excellent', color: 'text-green-500' }
    if (metrics.fps >= 30) return { status: 'good', color: 'text-yellow-500' }
    return { status: 'poor', color: 'text-red-500' }
  }

  const performanceStatus = getPerformanceStatus()

  // Auto-hide in production and load saved state
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development')

    // Load saved states
    if (typeof window !== 'undefined') {
      const savedMinimized = localStorage.getItem('performance-monitor-minimized')
      const savedSettings = localStorage.getItem('performance-monitor-settings')

      if (savedMinimized) {
        setIsMinimized(savedMinimized === 'true')
      } else {
        setIsMinimized(true)
      }

      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings))
        } catch (e) {
          logger.warn('Failed to load performance settings:', e)
        }
      }
    }
  }, [])

  // Handle minimize toggle
  const toggleMinimize = () => {
    const newMinimized = !isMinimized
    setIsMinimized(newMinimized)

    // Save minimize state to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('performance-monitor-minimized', newMinimized.toString())
    }
  }

  // Handle settings update
  const updateSettings = (newSettings: Partial<PerformanceSettings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)

    // Save settings to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('performance-monitor-settings', JSON.stringify(updatedSettings))
    }

    // Apply settings immediately
    applyPerformanceSettings(updatedSettings)
  }

  // Apply performance settings to the system
  const applyPerformanceSettings = (settings: PerformanceSettings) => {
    logger.debug('Applying performance settings:', settings)

    // Apply CSS-based performance optimizations
    if (typeof document !== 'undefined') {
      const root = document.documentElement

      // Set CSS custom properties for performance
      root.style.setProperty('--max-fps', settings.maxFPS.toString())
      root.style.setProperty('--render-quality', settings.renderQuality)
      root.setAttribute('data-render-quality', settings.renderQuality)

      // Apply animation settings
      if (!settings.enableAnimations) {
        root.style.setProperty('--animation-duration', '0s')
        root.style.setProperty('--transition-duration', '0s')
      } else {
        root.style.removeProperty('--animation-duration')
        root.style.removeProperty('--transition-duration')
      }

      // Apply GPU acceleration (less aggressive)
      if (settings.enableGPUAcceleration) {
        root.style.setProperty('--gpu-acceleration', 'enabled')
      } else {
        root.style.setProperty('--gpu-acceleration', 'disabled')
      }
    }

    // Dispatch custom event to notify other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('performance-settings-changed', {
          detail: settings,
        })
      )
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`bg-black/90 backdrop-blur-sm text-white rounded-lg shadow-xl border border-gray-600 transition-all duration-200 ${
          isMinimized ? 'min-w-[80px]' : 'min-w-[280px] max-w-[320px]'
        }`}
      >
        {/* Header - only show when not minimized */}
        {!isMinimized && (
          <div className="flex items-center justify-between p-3 border-b border-gray-600">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Performance Monitor</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1 hover:bg-gray-700 rounded transition-colors ${
                  showSettings ? 'bg-gray-700' : ''
                }`}
                title="Performance Settings"
              >
                <Settings className="w-3 h-3" />
              </button>
              <button
                onClick={toggleMinimize}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Performance Settings Panel */}
        {!isMinimized && showSettings && (
          <div className="border-b border-gray-600 p-3 bg-gray-800/50">
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-300 dark:text-white mb-2">
                Performance Settings
              </div>

              {/* Render Quality */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Render Quality</span>
                <select
                  value={settings.renderQuality}
                  onChange={(e) =>
                    updateSettings({ renderQuality: e.target.value as 'low' | 'medium' | 'high' })
                  }
                  className="silver-glass-pane smoky-glass-pane glass-field glass-native-select rounded px-2 py-1 text-xs text-zinc-200 dark:text-white"
                >
                  <option value="low">Low (Fast)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Quality)</option>
                </select>
              </div>

              {/* Max FPS */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Max FPS</span>
                <select
                  value={settings.maxFPS}
                  onChange={(e) => updateSettings({ maxFPS: parseInt(e.target.value) })}
                  className="silver-glass-pane smoky-glass-pane glass-field glass-native-select rounded px-2 py-1 text-xs text-zinc-200 dark:text-white"
                >
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                  <option value={120}>120 FPS</option>
                </select>
              </div>

              {/* GPU Acceleration */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">GPU Acceleration</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableGPUAcceleration}
                    onChange={(e) => updateSettings({ enableGPUAcceleration: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Animations */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Animations</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAnimations}
                    onChange={(e) => updateSettings({ enableAnimations: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Viewport Culling */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 dark:text-white/40">Viewport Culling</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableViewportCulling}
                    onChange={(e) => updateSettings({ enableViewportCulling: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Culling Threshold */}
              {settings.enableViewportCulling && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 dark:text-white/40">
                    Culling Threshold
                  </span>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={settings.cullingThreshold}
                    onChange={(e) => updateSettings({ cullingThreshold: parseInt(e.target.value) })}
                    className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 dark:text-white w-8">
                    {settings.cullingThreshold}
                  </span>
                </div>
              )}

              {/* Performance Presets */}
              <div className="pt-2 border-t border-gray-700">
                <div className="text-xs text-zinc-400 dark:text-white/40 mb-2">Quick Presets</div>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      updateSettings({
                        renderQuality: 'low',
                        maxFPS: 30,
                        enableGPUAcceleration: false,
                        enableAnimations: false,
                        enableViewportCulling: true,
                        cullingThreshold: 100,
                      })
                    }
                    className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                  >
                    Battery
                  </button>
                  <button
                    onClick={() =>
                      updateSettings({
                        renderQuality: 'medium',
                        maxFPS: 60,
                        enableGPUAcceleration: true,
                        enableAnimations: true,
                        enableViewportCulling: false,
                        cullingThreshold: 200,
                      })
                    }
                    className="text-xs bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded transition-colors"
                  >
                    Balanced
                  </button>
                  <button
                    onClick={() =>
                      updateSettings({
                        renderQuality: 'high',
                        maxFPS: 60, // Safer default instead of 120
                        enableGPUAcceleration: true,
                        enableAnimations: true,
                        enableViewportCulling: false,
                        cullingThreshold: 500,
                      })
                    }
                    className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors"
                  >
                    Quality
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content - only show when not minimized */}
        {!isMinimized && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs p-3">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>FPS:</span>
                <span className={performanceStatus.color}>
                  {metrics.fps}/{settings.maxFPS}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Render:</span>
                <span>{metrics.renderTime.toFixed(1)}ms</span>
              </div>

              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>Nodes:</span>
                <span>
                  {metrics.visibleNodes}/{metrics.nodeCount}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>Edges:</span>
                <span>
                  {metrics.visibleEdges}/{metrics.edgeCount}
                </span>
              </div>

              {metrics.memoryUsage > 0 && (
                <div className="col-span-2 flex items-center gap-1">
                  <span>Memory:</span>
                  <span>{metrics.memoryUsage}MB</span>
                </div>
              )}
            </div>

            <div className="px-3 pb-3 pt-0 border-t border-gray-600">
              <div className="text-xs text-zinc-400 dark:text-white/40 mt-2">
                Status: <span className={performanceStatus.color}>{performanceStatus.status}</span>
              </div>
            </div>
          </>
        )}

        {/* Ultra minimized view - just FPS number */}
        {isMinimized && (
          <div
            className="p-2 flex items-center justify-center cursor-pointer"
            onClick={toggleMinimize}
            title={`FPS: ${metrics.fps}/${settings.maxFPS} - Click to expand`}
          >
            <span className={`text-sm font-bold ${performanceStatus.color}`}>
              {metrics.fps}/{settings.maxFPS}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Performance optimization recommendations
export function getPerformanceRecommendations(metrics: PerformanceMetrics) {
  const recommendations: string[] = []

  if (metrics.fps < 30) {
    recommendations.push('Consider enabling viewport culling')
    recommendations.push('Reduce node complexity or use virtualization')
  }

  if (metrics.nodeCount > 100) {
    recommendations.push('Implement node virtualization for large datasets')
  }

  if (metrics.edgeCount > 200) {
    recommendations.push('Consider edge batching or LOD (Level of Detail)')
  }

  if (metrics.renderTime > 16) {
    recommendations.push('Optimize render cycle - target <16ms for 60fps')
  }

  if (metrics.memoryUsage > 100) {
    recommendations.push('Monitor memory usage - consider cleanup strategies')
  }

  return recommendations
}
