'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Globe,
  Hash,
  Link2,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  Unlink2,
  XCircle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const logger = createLogger('GatewaySettings')

interface ChannelConfig {
  id: string
  type: string
  name: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  settings: {
    autoReply?: boolean
    triggerWorkflowId?: string
    welcomeMessage?: string
  }
  createdAt: string
  updatedAt: string
}

const CHANNEL_TYPES = [
  { value: 'telegram', label: 'Telegram', icon: Send, description: 'Connect a Telegram bot' },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone, description: 'WhatsApp Business API' },
  { value: 'slack', label: 'Slack', icon: Hash, description: 'Slack workspace bot' },
  { value: 'discord', label: 'Discord', icon: Bot, description: 'Discord server bot' },
  { value: 'webchat', label: 'WebChat', icon: Globe, description: 'Embeddable web chat' },
]

const CREDENTIAL_FIELDS: Record<
  string,
  Array<{ key: string; label: string; placeholder: string; type?: string }>
> = {
  telegram: [
    {
      key: 'botToken',
      label: 'Bot Token',
      placeholder: 'Enter your Telegram bot token from @BotFather',
      type: 'password',
    },
    {
      key: 'webhookUrl',
      label: 'Webhook URL (optional)',
      placeholder: 'https://your-domain.com/api/gateway/telegram/webhook',
    },
  ],
  whatsapp: [
    {
      key: 'accessToken',
      label: 'Access Token',
      placeholder: 'WhatsApp Business API access token',
      type: 'password',
    },
    {
      key: 'phoneNumberId',
      label: 'Phone Number ID',
      placeholder: 'Your WhatsApp phone number ID',
    },
    { key: 'verifyToken', label: 'Verify Token', placeholder: 'Webhook verification token' },
  ],
  slack: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Slack bot token', type: 'password' },
    {
      key: 'signingSecret',
      label: 'Signing Secret',
      placeholder: 'Slack app signing secret',
      type: 'password',
    },
    { key: 'appId', label: 'App ID', placeholder: 'Your Slack app ID' },
  ],
  discord: [
    { key: 'botToken', label: 'Bot Token', placeholder: 'Discord bot token', type: 'password' },
    { key: 'applicationId', label: 'Application ID', placeholder: 'Discord application ID' },
    { key: 'publicKey', label: 'Public Key', placeholder: 'Discord interaction public key' },
  ],
  webchat: [{ key: 'apiKey', label: 'API Key', placeholder: 'Auto-generated', type: 'password' }],
}

export function Gateway() {
  const [channels, setChannels] = useState<ChannelConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<ChannelConfig | null>(null)
  const [newChannel, setNewChannel] = useState({
    type: 'telegram',
    name: '',
    credentials: {} as Record<string, string>,
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchChannels()
  }, [])

  const fetchChannels = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/gateway/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      }
    } catch (error) {
      logger.error('Failed to fetch channels', { error })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddChannel = async () => {
    if (!newChannel.name || !newChannel.type) return
    setIsConnecting(true)
    try {
      const res = await fetch('/api/gateway/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setNewChannel({ type: 'telegram', name: '', credentials: {} })
        await fetchChannels()
      }
    } catch (error) {
      logger.error('Failed to add channel', { error })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDeleteChannel = async () => {
    if (!selectedChannel) return
    setIsDeleting(true)
    try {
      await fetch(`/api/gateway/channels/${selectedChannel.id}`, { method: 'DELETE' })
      setShowDeleteDialog(false)
      setSelectedChannel(null)
      await fetchChannels()
    } catch (error) {
      logger.error('Failed to delete channel', { error })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleAutoReply = async (channel: ChannelConfig) => {
    try {
      await fetch(`/api/gateway/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { ...channel.settings, autoReply: !channel.settings?.autoReply },
        }),
      })
      await fetchChannels()
    } catch (error) {
      logger.error('Failed to toggle auto-reply', { error })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge
            variant="outline"
            className="whitespace-nowrap text-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-logo"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case 'error':
        return (
          <Badge
            variant="outline"
            className="whitespace-nowrap text-red-500 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-[10px] font-logo"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
      case 'connecting':
        return (
          <Badge
            variant="outline"
            className="whitespace-nowrap text-amber-500 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-[10px] font-logo"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="whitespace-nowrap text-zinc-400 border-zinc-200 dark:border-zinc-700 text-[10px] font-logo"
          >
            <Unlink2 className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        )
    }
  }

  const getChannelIcon = (type: string) => {
    const ct = CHANNEL_TYPES.find((c) => c.value === type)
    if (ct) {
      const Icon = ct.icon
      return <Icon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
    }
    return <MessageSquare className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2.5">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <MessageSquare className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Messaging Channels
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-7 text-[12px] font-logo gap-1.5 bg-[#4A7A68] hover:bg-[#3d6656] text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Channel
        </Button>
      </div>

      <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 -mt-3">
        Connect messaging platforms to trigger workflows and send notifications from any channel.
      </p>

      {/* Channel List */}
      <div className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-2.5 px-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                <div>
                  <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800 rounded mt-1.5" />
                </div>
              </div>
              <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
            </div>
          ))
        ) : channels.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-black/[0.08] dark:border-white/[0.08] rounded-lg">
            <MessageSquare className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-[13px] font-logo font-medium text-zinc-500 dark:text-white/50">
              No channels connected
            </p>
            <p className="text-[11px] font-logo text-zinc-400 dark:text-white/30 mt-1">
              Connect Telegram, WhatsApp, Slack, or Discord to get started
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="mt-4 text-[12px] font-logo"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add your first channel
            </Button>
          </div>
        ) : (
          channels.map((channel) => (
            <div
              key={channel.id}
              className="silver-glass-pane flex items-center justify-between rounded-lg bg-transparent py-2.5 px-3 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
                  {getChannelIcon(channel.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-logo font-medium text-zinc-800 dark:text-white">
                      {channel.name}
                    </span>
                    {getStatusBadge(channel.status)}
                  </div>
                  <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40 capitalize">
                    {channel.type}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5 mr-2">
                  <Label className="text-[10px] font-logo text-zinc-400">Auto-reply</Label>
                  <Switch
                    checked={channel.settings?.autoReply || false}
                    onCheckedChange={() => handleToggleAutoReply(channel)}
                    className="h-4 w-7"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-400 hover:text-red-500"
                  onClick={() => {
                    setSelectedChannel(channel)
                    setShowDeleteDialog(true)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Gateway Status */}
      {channels.length > 0 && (
        <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-zinc-400" />
              <span className="text-[12px] font-logo text-zinc-500 dark:text-white/50">
                {channels.filter((c) => c.status === 'connected').length} of {channels.length}{' '}
                channels active
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchChannels}
              className="h-7 text-[11px] font-logo text-zinc-400"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Add Channel Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[480px] rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-logo font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
              Connect Channel
            </DialogTitle>
            <DialogDescription className="text-[12px] font-logo text-zinc-400">
              Connect a messaging platform to trigger workflows and receive messages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Channel Type */}
            <div>
              <Label className="text-[12px] font-logo font-medium">Channel Type</Label>
              <Select
                value={newChannel.type}
                onValueChange={(v) => setNewChannel({ ...newChannel, type: v, credentials: {} })}
              >
                <SelectTrigger className="mt-1.5 h-9 text-[13px] font-logo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value} className="text-[13px] font-logo">
                      <div className="flex items-center gap-2">
                        <ct.icon className="h-4 w-4" />
                        {ct.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Name */}
            <div>
              <Label className="text-[12px] font-logo font-medium">Display Name</Label>
              <Input
                value={newChannel.name}
                onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                placeholder="e.g., My Telegram Bot"
                className="mt-1.5 h-9 text-[13px] font-logo"
              />
            </div>

            {/* Credential Fields */}
            {CREDENTIAL_FIELDS[newChannel.type]?.map((field) => (
              <div key={field.key}>
                <Label className="text-[12px] font-logo font-medium">{field.label}</Label>
                <Input
                  type={field.type || 'text'}
                  value={newChannel.credentials[field.key] || ''}
                  onChange={(e) =>
                    setNewChannel({
                      ...newChannel,
                      credentials: { ...newChannel.credentials, [field.key]: e.target.value },
                    })
                  }
                  placeholder={field.placeholder}
                  className="mt-1.5 h-9 text-[13px] font-logo"
                />
              </div>
            ))}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="text-[12px] font-logo"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddChannel}
              disabled={isConnecting || !newChannel.name}
              className="text-[12px] font-logo bg-[#4A7A68] hover:bg-[#3d6656] text-white"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-logo font-semibold">
              Disconnect Channel?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] font-logo text-zinc-400">
              This will disconnect &quot;{selectedChannel?.name}&quot; and remove all associated
              sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px] font-logo">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              className="workflow-editor-settings-danger-action smoky-glass-chip rounded-[10px] border border-rose-500/[0.18] bg-rose-500/[0.08] text-[12px] font-logo text-rose-700 transition-all duration-200 hover:bg-rose-500/[0.12] dark:border-rose-400/[0.16] dark:bg-rose-400/[0.1] dark:text-rose-100"
              disabled={isDeleting}
            >
              {isDeleting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
