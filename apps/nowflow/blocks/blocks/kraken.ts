import { KrakenIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const KrakenBlock = defineBlock({
  type: 'kraken',
  name: 'Kraken',
  description: '⚠️ Crypto exchange trading and market data',
  longDescription:
    'Connect to Kraken cryptocurrency exchange API for trading, market data, account management, and order execution. Access real-time prices, order books, trading history, and execute trades. Uses API key authentication for secure access. ⚠️ REGULATORY NOTICE: This integration is for authorized use only. Users are responsible for compliance with all applicable financial regulations, KYC/AML requirements, and trading laws in their jurisdiction. Trading carries significant financial risk.',
  category: 'tools',
  bgColor: '#5741D9',
  icon: KrakenIcon,
  subBlocks: [
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Your Kraken API Key',
      password: true,
      description: '⚠️ Keep your API keys secure. Never share them.',
    },
    {
      id: 'apiSecret',
      title: 'API Secret',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Your Kraken API Secret',
      password: true,
    },
    createOperationDropdown({
      operations: [
        { id: 'get_server_time', label: 'Get Server Time' },
        { id: 'get_asset_info', label: 'Get Asset Info' },
        { id: 'get_ticker', label: 'Get Ticker Information' },
        { id: 'get_ohlc', label: 'Get OHLC Data' },
        { id: 'get_orderbook', label: 'Get Order Book' },
        { id: 'get_recent_trades', label: 'Get Recent Trades' },
        { id: 'get_balance', label: 'Get Account Balance' },
        { id: 'get_trade_balance', label: 'Get Trade Balance' },
        { id: 'get_open_orders', label: 'Get Open Orders' },
        { id: 'get_closed_orders', label: 'Get Closed Orders' },
        { id: 'get_trades_history', label: 'Get Trades History' },
        { id: 'add_order', label: '⚠️ Add Order' },
        { id: 'cancel_order', label: 'Cancel Order' },
        { id: 'get_deposit_methods', label: 'Get Deposit Methods' },
        { id: 'get_deposit_addresses', label: 'Get Deposit Addresses' },
        { id: 'get_withdrawal_info', label: 'Get Withdrawal Info' },
      ],
      defaultValue: 'get_ticker',
    }),
    {
      id: 'pair',
      title: 'Trading Pair',
      type: 'short-input',
      layout: 'half',
      placeholder: 'XXBTZUSD (BTC/USD)',
      condition: {
        field: 'operation',
        value: ['get_ticker', 'get_ohlc', 'get_orderbook', 'get_recent_trades', 'add_order'],
      },
    },
    {
      id: 'interval',
      title: 'Interval (minutes)',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: '1', label: '1 Minute' },
        { id: '5', label: '5 Minutes' },
        { id: '15', label: '15 Minutes' },
        { id: '30', label: '30 Minutes' },
        { id: '60', label: '1 Hour' },
        { id: '240', label: '4 Hours' },
        { id: '1440', label: '1 Day' },
      ],
      condition: { field: 'operation', value: 'get_ohlc' },
    },
    {
      id: 'count',
      title: 'Count',
      type: 'short-input',
      layout: 'half',
      placeholder: '100',
      condition: {
        field: 'operation',
        value: ['get_ohlc', 'get_orderbook', 'get_recent_trades'],
      },
    },
    {
      id: 'asset',
      title: 'Asset',
      type: 'short-input',
      layout: 'half',
      placeholder: 'XBT, ETH, USDT',
      condition: {
        field: 'operation',
        value: [
          'get_asset_info',
          'get_deposit_methods',
          'get_deposit_addresses',
          'get_withdrawal_info',
        ],
      },
    },
    // Order fields
    {
      id: 'orderType',
      title: 'Order Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'market', label: 'Market' },
        { id: 'limit', label: 'Limit' },
        { id: 'stop-loss', label: 'Stop Loss' },
        { id: 'take-profit', label: 'Take Profit' },
        { id: 'stop-loss-limit', label: 'Stop Loss Limit' },
        { id: 'take-profit-limit', label: 'Take Profit Limit' },
      ],
      condition: { field: 'operation', value: 'add_order' },
    },
    {
      id: 'side',
      title: 'Order Side',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'buy', label: '🟢 Buy' },
        { id: 'sell', label: '🔴 Sell' },
      ],
      condition: { field: 'operation', value: 'add_order' },
    },
    {
      id: 'volume',
      title: 'Volume',
      type: 'short-input',
      layout: 'half',
      placeholder: '0.01',
      condition: { field: 'operation', value: 'add_order' },
    },
    {
      id: 'price',
      title: 'Price (for limit orders)',
      type: 'short-input',
      layout: 'half',
      placeholder: '50000',
      condition: { field: 'operation', value: 'add_order' },
    },
    {
      id: 'orderId',
      title: 'Order ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Order transaction ID',
      condition: { field: 'operation', value: 'cancel_order' },
    },
  ],
  tools: {
    access: ['kraken_api'],
    config: {
      tool: () => 'kraken_api',
      params: (params) => {
        const { apiKey, apiSecret, ...rest } = params as Record<string, any>
        return {
          apiKey,
          apiSecret,
          ...rest,
        }
      },
    },
  },
  inputs: {
    apiKey: { type: 'string', required: true },
    apiSecret: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    pair: { type: 'string', required: false },
    interval: { type: 'string', required: false },
    count: { type: 'number', required: false },
    asset: { type: 'string', required: false },
    orderType: { type: 'string', required: false },
    side: { type: 'string', required: false },
    volume: { type: 'string', required: false },
    price: { type: 'string', required: false },
    orderId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'any',
      },
    },
  },
  compliance: {
    enabled: true,
    tags: ['crypto_trading', 'high_risk', 'regulated', 'kyc_required', 'region_restricted'],
    disclaimer:
      'REGULATORY NOTICE: Cryptocurrency trading carries extreme financial risk and may result in total loss of capital. This block is intended for authorized use only. Users must comply with all applicable financial regulations, KYC/AML requirements, and cryptocurrency trading laws in their jurisdiction. Kraken is a regulated exchange operating in multiple jurisdictions. Users are solely responsible for ensuring compliance with local laws, tax obligations, and trading regulations.',
    restrictedRegions: ['US (certain states)', 'Consult local regulations'],
    requiresLicense: true,
    riskLevel: 'extreme',
  },
})
