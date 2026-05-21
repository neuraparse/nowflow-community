// Types
export type {
  ChannelType,
  ChannelStatus,
  ChannelConfig,
  ChannelSettings,
  InboundMessage,
  OutboundMessage,
  MessageMedia,
  MessageButton,
  GatewaySession,
  ChannelAdapter,
  GatewayEvent,
} from './types'

// Gateway Service
export { getGatewayService, resetGatewayService, GatewayService } from './gateway-service'

// Session Manager
export {
  createSession,
  getSession,
  updateSession,
  addMessageToHistory,
  deleteSession,
  getActiveSessionCount,
  updateSessionContext,
} from './session-manager'

// Message Router
export { routeMessage, registerRules, unregisterRules, getChannelRules } from './message-router'
export type { RouteResult, RoutingRule } from './message-router'
