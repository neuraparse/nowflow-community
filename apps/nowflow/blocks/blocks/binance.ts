import { BinanceIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const BinanceBlock = defineBlock({
  type: 'binance',
  name: 'Binance',
  description: '⚠️ Crypto trading, market data, and wallet management',
  longDescription:
    'Connect to Binance API to access cryptocurrency trading, market data, wallet management, and order execution. Supports spot trading, futures, and savings. OAuth 2.0 authentication provides secure access to your Binance account. ⚠️ REGULATORY NOTICE: This integration is for authorized use only. Users are responsible for compliance with all applicable financial regulations, KYC/AML requirements, and trading laws in their jurisdiction. Not available in restricted regions.',
  category: 'tools',
  bgColor: '#F3BA2F',
  icon: BinanceIcon,
  subBlocks: [
    {
      ...createOAuthSubBlock({
        provider: 'binance',
        serviceId: 'binance',
        requiredScopes: ['spot', 'wallet'],
        title: 'Binance Account',
        placeholder: 'Select Binance account',
      }),
      description: '⚠️ Trading carries financial risk. Ensure regulatory compliance.',
    },
    createOperationDropdown({
      operations: [
        { id: 'get_account', label: 'Get Account Info' },
        { id: 'get_balance', label: 'Get Wallet Balance' },
        { id: 'get_price', label: 'Get Current Price' },
        { id: 'get_ticker', label: 'Get 24hr Ticker' },
        { id: 'get_orderbook', label: 'Get Order Book' },
        { id: 'get_trades', label: 'Get Recent Trades' },
        { id: 'get_klines', label: 'Get Candlestick Data' },
        { id: 'create_order', label: '⚠️ Create Order' },
        { id: 'cancel_order', label: 'Cancel Order' },
        { id: 'get_order', label: 'Get Order Status' },
        { id: 'get_open_orders', label: 'Get Open Orders' },
        { id: 'get_all_orders', label: 'Get All Orders' },
        { id: 'get_deposit_history', label: 'Get Deposit History' },
        { id: 'get_withdraw_history', label: 'Get Withdrawal History' },
      ],
      defaultValue: 'get_price',
    }),
    {
      id: 'symbol',
      title: 'Trading Pair',
      type: 'short-input',
      layout: 'half',
      placeholder: 'BTCUSDT',
      condition: {
        field: 'operation',
        value: [
          'get_price',
          'get_ticker',
          'get_orderbook',
          'get_trades',
          'get_klines',
          'create_order',
          'cancel_order',
          'get_order',
          'get_open_orders',
          'get_all_orders',
        ],
      },
    },
    {
      id: 'interval',
      title: 'Interval',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: '1m', label: '1 Minute' },
        { id: '5m', label: '5 Minutes' },
        { id: '15m', label: '15 Minutes' },
        { id: '1h', label: '1 Hour' },
        { id: '4h', label: '4 Hours' },
        { id: '1d', label: '1 Day' },
        { id: '1w', label: '1 Week' },
      ],
      condition: { field: 'operation', value: 'get_klines' },
    },
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '100',
      condition: {
        field: 'operation',
        value: ['get_orderbook', 'get_trades', 'get_klines', 'get_all_orders'],
      },
    },
    // Order creation fields
    {
      id: 'side',
      title: 'Order Side',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'BUY', label: '🟢 BUY' },
        { id: 'SELL', label: '🔴 SELL' },
      ],
      condition: { field: 'operation', value: 'create_order' },
    },
    {
      id: 'orderType',
      title: 'Order Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'MARKET', label: 'Market Order' },
        { id: 'LIMIT', label: 'Limit Order' },
        { id: 'STOP_LOSS', label: 'Stop Loss' },
        { id: 'STOP_LOSS_LIMIT', label: 'Stop Loss Limit' },
        { id: 'TAKE_PROFIT', label: 'Take Profit' },
        { id: 'TAKE_PROFIT_LIMIT', label: 'Take Profit Limit' },
      ],
      condition: { field: 'operation', value: 'create_order' },
    },
    {
      id: 'quantity',
      title: 'Quantity',
      type: 'short-input',
      layout: 'half',
      placeholder: '0.001',
      condition: { field: 'operation', value: 'create_order' },
    },
    {
      id: 'price',
      title: 'Price (for limit orders)',
      type: 'short-input',
      layout: 'half',
      placeholder: '50000.00',
      condition: {
        field: 'operation',
        value: 'create_order',
        and: {
          field: 'orderType',
          value: ['LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'],
        },
      },
    },
    {
      id: 'stopPrice',
      title: 'Stop Price',
      type: 'short-input',
      layout: 'half',
      placeholder: '49000.00',
      condition: {
        field: 'operation',
        value: 'create_order',
        and: {
          field: 'orderType',
          value: ['STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT'],
        },
      },
    },
    {
      id: 'orderId',
      title: 'Order ID',
      type: 'short-input',
      layout: 'full',
      placeholder: '123456789',
      condition: { field: 'operation', value: ['cancel_order', 'get_order'] },
    },
    {
      id: 'asset',
      title: 'Asset',
      type: 'short-input',
      layout: 'half',
      placeholder: 'BTC',
      condition: { field: 'operation', value: ['get_deposit_history', 'get_withdraw_history'] },
    },
  ],
  tools: {
    access: ['binance_api'],
    config: {
      tool: () => 'binance_api',
      params: (params) => {
        const { credential, ...rest } = params as Record<string, any>
        return {
          credential,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    symbol: { type: 'string', required: false },
    interval: { type: 'string', required: false },
    limit: { type: 'number', required: false },
    side: { type: 'string', required: false },
    orderType: { type: 'string', required: false },
    quantity: { type: 'string', required: false },
    price: { type: 'string', required: false },
    stopPrice: { type: 'string', required: false },
    orderId: { type: 'string', required: false },
    asset: { type: 'string', required: false },
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
      'REGULATORY NOTICE: Cryptocurrency trading carries extreme financial risk and may result in total loss of capital. This block is intended for authorized use only. Users must comply with all applicable financial regulations, KYC/AML requirements, and cryptocurrency laws in their jurisdiction. Binance services are restricted or unavailable in certain regions including but not limited to the United States (for certain products), China, and other jurisdictions. Users are solely responsible for ensuring compliance with local laws and regulations.',
    restrictedRegions: ['US (certain products)', 'CN', 'Consult local regulations'],
    requiresLicense: true,
    riskLevel: 'extreme',
  },
})
