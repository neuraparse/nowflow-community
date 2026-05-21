import { RobinhoodIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const RobinhoodBlock = defineBlock({
  type: 'robinhood',
  name: 'Robinhood',
  description: '⚠️ Commission-free stock and crypto trading',
  longDescription:
    'Connect to Robinhood API using OAuth 2.0 for commission-free trading of stocks, ETFs, options, and cryptocurrencies. Access portfolio information, market data, execute trades, and manage watchlists. Designed for retail investors with a user-friendly interface. ⚠️ REGULATORY NOTICE: This integration is for authorized use only. Trading involves risk of financial loss. Users must comply with all applicable securities regulations and pattern day trading rules. Service available only in supported regions (primarily USA).',
  category: 'tools',
  bgColor: '#00C805',
  icon: RobinhoodIcon,
  subBlocks: [
    {
      ...createOAuthSubBlock({
        provider: 'robinhood',
        serviceId: 'robinhood',
        requiredScopes: ['account:read', 'trading', 'portfolio:read'],
        title: 'Robinhood Account',
        placeholder: 'Select Robinhood account',
      }),
      description: '⚠️ Investment carries risk. Trade responsibly.',
    },
    createOperationDropdown({
      operations: [
        { id: 'get_account', label: 'Get Account Info' },
        { id: 'get_portfolio', label: 'Get Portfolio' },
        { id: 'get_positions', label: 'Get Positions' },
        { id: 'get_dividends', label: 'Get Dividends' },
        { id: 'get_quote', label: 'Get Stock Quote' },
        { id: 'get_fundamentals', label: 'Get Stock Fundamentals' },
        { id: 'get_historicals', label: 'Get Historical Prices' },
        { id: 'search_instruments', label: 'Search Stocks' },
        { id: 'get_watchlists', label: 'Get Watchlists' },
        { id: 'get_orders', label: 'Get Orders' },
        { id: 'place_order', label: '⚠️ Place Order' },
        { id: 'cancel_order', label: 'Cancel Order' },
        { id: 'get_crypto_quote', label: 'Get Crypto Quote' },
        { id: 'get_crypto_positions', label: 'Get Crypto Positions' },
        { id: 'place_crypto_order', label: '⚠️ Place Crypto Order' },
        { id: 'get_options_positions', label: 'Get Options Positions' },
        { id: 'get_market_hours', label: 'Get Market Hours' },
      ],
      defaultValue: 'get_portfolio',
    }),
    {
      id: 'symbol',
      title: 'Symbol',
      type: 'short-input',
      layout: 'half',
      placeholder: 'AAPL, TSLA, SPY',
      condition: {
        field: 'operation',
        value: [
          'get_quote',
          'get_fundamentals',
          'get_historicals',
          'search_instruments',
          'place_order',
        ],
      },
    },
    {
      id: 'cryptoSymbol',
      title: 'Crypto Symbol',
      type: 'short-input',
      layout: 'half',
      placeholder: 'BTC, ETH, DOGE',
      condition: {
        field: 'operation',
        value: ['get_crypto_quote', 'place_crypto_order'],
      },
    },
    // Historical data
    {
      id: 'interval',
      title: 'Interval',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: '5minute', label: '5 Minutes' },
        { id: '10minute', label: '10 Minutes' },
        { id: 'hour', label: '1 Hour' },
        { id: 'day', label: '1 Day' },
        { id: 'week', label: '1 Week' },
      ],
      condition: { field: 'operation', value: 'get_historicals' },
    },
    {
      id: 'span',
      title: 'Time Span',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'day', label: '1 Day' },
        { id: 'week', label: '1 Week' },
        { id: 'month', label: '1 Month' },
        { id: '3month', label: '3 Months' },
        { id: 'year', label: '1 Year' },
        { id: '5year', label: '5 Years' },
      ],
      condition: { field: 'operation', value: 'get_historicals' },
    },
    // Order fields
    {
      id: 'side',
      title: 'Order Side',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'buy', label: '🟢 Buy' },
        { id: 'sell', label: '🔴 Sell' },
      ],
      condition: { field: 'operation', value: ['place_order', 'place_crypto_order'] },
    },
    {
      id: 'orderType',
      title: 'Order Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'market', label: 'Market' },
        { id: 'limit', label: 'Limit' },
      ],
      condition: { field: 'operation', value: ['place_order', 'place_crypto_order'] },
    },
    {
      id: 'quantity',
      title: 'Quantity',
      type: 'short-input',
      layout: 'half',
      placeholder: '10',
      condition: { field: 'operation', value: 'place_order' },
    },
    {
      id: 'amount',
      title: 'Amount (USD)',
      type: 'short-input',
      layout: 'half',
      placeholder: '100.00',
      condition: { field: 'operation', value: 'place_crypto_order' },
    },
    {
      id: 'price',
      title: 'Limit Price',
      type: 'short-input',
      layout: 'half',
      placeholder: '150.00',
      condition: {
        field: 'operation',
        value: ['place_order', 'place_crypto_order'],
        and: {
          field: 'orderType',
          value: 'limit',
        },
      },
    },
    {
      id: 'timeInForce',
      title: 'Time In Force',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'gfd', label: 'Good for Day' },
        { id: 'gtc', label: 'Good till Cancelled' },
        { id: 'ioc', label: 'Immediate or Cancel' },
      ],
      condition: { field: 'operation', value: 'place_order' },
    },
    {
      id: 'extendedHours',
      title: 'Extended Hours',
      type: 'switch',
      layout: 'half',
      description: 'Trade in pre/post-market',
      condition: { field: 'operation', value: 'place_order' },
    },
    {
      id: 'orderId',
      title: 'Order ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Order ID to cancel',
      condition: { field: 'operation', value: 'cancel_order' },
    },
  ],
  tools: {
    access: ['robinhood_api'],
    config: {
      tool: () => 'robinhood_api',
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
    cryptoSymbol: { type: 'string', required: false },
    interval: { type: 'string', required: false },
    span: { type: 'string', required: false },
    side: { type: 'string', required: false },
    orderType: { type: 'string', required: false },
    quantity: { type: 'string', required: false },
    amount: { type: 'string', required: false },
    price: { type: 'string', required: false },
    timeInForce: { type: 'string', required: false },
    extendedHours: { type: 'boolean', required: false },
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
    tags: ['financial_trading', 'crypto_trading', 'high_risk', 'regulated', 'region_restricted'],
    disclaimer:
      'REGULATORY NOTICE: Investment and trading carry risk of financial loss. This block is intended for authorized use only. Users must comply with all applicable securities regulations, pattern day trading rules (PDT), and trading laws. Robinhood is a FINRA-registered broker-dealer and operates under SEC oversight. Users are subject to account minimums, margin requirements, and regulatory restrictions. Pattern day traders require $25,000 minimum account balance. Cryptocurrency trading involves additional risk. Users are solely responsible for ensuring compliance with all applicable laws and tax obligations. Service primarily available in the United States.',
    restrictedRegions: ['Outside US (limited availability)'],
    requiresLicense: false,
    riskLevel: 'high',
  },
})
