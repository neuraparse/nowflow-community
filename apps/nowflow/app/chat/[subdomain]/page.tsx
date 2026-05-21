import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ENTERPRISE_REQUEST_LABEL, ENTERPRISE_URL } from '@/lib/community/enterprise'
import { createLogger } from '@/lib/logs/console-logger'
import type { AppSurface } from '@/types/deployment'
import { db } from '@/db'
import { chat, workflow } from '@/db/schema'
import ChatClient from './components/chat-client'
import WidgetChatClient from './components/widget-chat-client'

const logger = createLogger('ChatPage')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ChatPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params
  logger.info(`[ChatPage] subdomain: ${subdomain}`)

  try {
    // Fetch chat deployment from database
    const deploymentResult = await db
      .select({
        id: chat.id,
        workflowId: chat.workflowId,
        title: chat.title,
        description: chat.description,
        surface: chat.surface,
        customizations: chat.customizations,
        responseConfig: chat.responseConfig,
        authType: chat.authType,
        isActive: chat.isActive,
        workflowName: workflow.name,
        workflowDescription: workflow.description,
      })
      .from(chat)
      .innerJoin(workflow, eq(chat.workflowId, workflow.id))
      .where(eq(chat.subdomain, subdomain))
      .limit(1)

    if (deploymentResult.length === 0) {
      logger.warn(`Chat not found for subdomain: ${subdomain}`)
      notFound()
    }

    const chatDeployment = deploymentResult[0]

    if (!chatDeployment.isActive) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-950 font-logo">
          <div className="max-w-md mx-auto text-center p-8">
            <h1 className="text-2xl font-light tracking-tight font-logo text-zinc-800 dark:text-white mb-2">
              Chat Unavailable
            </h1>
            <p className="text-zinc-400 dark:text-white/40">
              This chat interface is currently unavailable.
            </p>
          </div>
        </div>
      )
    }

    const rawSurface = chatDeployment.surface || 'chat'
    const surface = rawSurface as AppSurface
    logger.info(`[ChatPage] Surface: ${surface}`, {
      chatDeploymentId: chatDeployment.id,
    })

    // For chat surface with widget position, use legacy chat clients
    if (surface === 'chat') {
      const chatPosition = (chatDeployment.customizations as any)?.chatPosition || 'full-screen'
      const useWidget = chatPosition !== 'full-screen'

      logger.info(`[ChatPage] Using ${useWidget ? 'widget' : 'full-screen'} mode for chat surface`)
      return useWidget ? (
        <WidgetChatClient subdomain={subdomain} />
      ) : (
        <ChatClient subdomain={subdomain} />
      )
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6 py-16 font-logo dark:bg-slate-950">
        <section className="max-w-md text-center">
          <div className="mx-auto mb-4 inline-flex rounded-[8px] border border-black/[0.08] bg-black/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/55">
            Enterprise
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-800 dark:text-white">
            Application surface unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-white/55">
            Managed {surface} surfaces are available in NowFlow Enterprise.
          </p>
          <a
            href={ENTERPRISE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-[6px] bg-[#4A7A68] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3d6556]"
          >
            {ENTERPRISE_REQUEST_LABEL}
          </a>
        </section>
      </main>
    )
  } catch (error) {
    logger.error('Error loading chat page:', error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-950 font-logo">
        <div className="max-w-md mx-auto text-center p-8">
          <h1 className="text-2xl font-light tracking-tight font-logo text-zinc-800 dark:text-white mb-2">
            Error Loading Chat
          </h1>
          <p className="text-zinc-400 dark:text-white/40">
            An error occurred while loading this chat. Please try again later.
          </p>
        </div>
      </div>
    )
  }
}
