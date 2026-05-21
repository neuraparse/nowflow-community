import { CoinbaseIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const CoinbaseBlock = defineBlock({
  type: 'coinbase',
  name: 'Coinbase',
  description: '⚠️ Crypto wallet, trading, and payment integration',
  longDescription:
    'Connect to Coinbase API using OAuth 2.0 to manage cryptocurrency wallets, execute trades, process payments, and access market data. Supports account management, buying/selling crypto, sending/receiving funds, and transaction history. ⚠️ REGULATORY NOTICE: This integration is for authorized use only. Users must comply with all applicable financial regulations, KYC/AML requirements, and cryptocurrency laws in their jurisdiction. Service availability varies by region.',
  category: 'tools',
  bgColor: '#0052FF',
  icon: CoinbaseIcon,
  subBlocks: [
    {
      ...createOAuthSubBlock({
        provider: 'coinbase',
        serviceId: 'coinbase',
        requiredScopes: [
          'wallet:accounts:read',
          'wallet:transactions:read',
          'wallet:buys:read',
          'wallet:sells:read',
        ],
        title: 'Coinbase Account',
        placeholder: 'Select Coinbase account',
      }),
      description: '⚠️ Cryptocurrency trading carries financial risk. Ensure compliance.',
    },
    createOperationDropdown({
      operations: [
        { id: 'get_user', label: 'Get User Info' },
        { id: 'list_accounts', label: 'List Accounts' },
        { id: 'get_account', label: 'Get Account Details' },
        { id: 'list_transactions', label: 'List Transactions' },
        { id: 'get_transaction', label: 'Get Transaction' },
        { id: 'get_spot_price', label: 'Get Spot Price' },
        { id: 'get_buy_price', label: 'Get Buy Price' },
        { id: 'get_sell_price', label: 'Get Sell Price' },
        { id: 'list_buys', label: 'List Buy Orders' },
        { id: 'list_sells', label: 'List Sell Orders' },
        { id: 'place_buy_order', label: '⚠️ Place Buy Order' },
        { id: 'place_sell_order', label: '⚠️ Place Sell Order' },
        { id: 'send_money', label: '⚠️ Send Cryptocurrency' },
        { id: 'request_money', label: 'Request Money' },
        { id: 'list_payment_methods', label: 'List Payment Methods' },
        { id: 'get_exchange_rates', label: 'Get Exchange Rates' },
      ],
      defaultValue: 'list_accounts',
    }),
    {
      id: 'accountId',
      title: 'Account ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Account ID from list_accounts',
      condition: {
        field: 'operation',
        value: [
          'get_account',
          'list_transactions',
          'list_buys',
          'list_sells',
          'place_buy_order',
          'place_sell_order',
          'send_money',
          'request_money',
        ],
      },
    },
    {
      id: 'transactionId',
      title: 'Transaction ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Transaction ID',
      condition: { field: 'operation', value: 'get_transaction' },
    },
    {
      id: 'currencyPair',
      title: 'Currency Pair',
      type: 'short-input',
      layout: 'half',
      placeholder: 'BTC-USD',
      condition: {
        field: 'operation',
        value: ['get_spot_price', 'get_buy_price', 'get_sell_price'],
      },
    },
    {
      id: 'currency',
      title: 'Currency',
      type: 'short-input',
      layout: 'half',
      placeholder: 'USD',
      condition: { field: 'operation', value: 'get_exchange_rates' },
    },
    // Buy/Sell order fields
    {
      id: 'amount',
      title: 'Amount',
      type: 'short-input',
      layout: 'half',
      placeholder: '100',
      condition: {
        field: 'operation',
        value: ['place_buy_order', 'place_sell_order', 'send_money', 'request_money'],
      },
    },
    {
      id: 'amountCurrency',
      title: 'Amount Currency',
      type: 'short-input',
      layout: 'half',
      placeholder: 'USD or BTC',
      condition: {
        field: 'operation',
        value: ['place_buy_order', 'place_sell_order', 'send_money', 'request_money'],
      },
    },
    {
      id: 'paymentMethod',
      title: 'Payment Method ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Payment method from list_payment_methods',
      condition: {
        field: 'operation',
        value: ['place_buy_order', 'place_sell_order'],
      },
    },
    {
      id: 'toAddress',
      title: 'Recipient Address',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Cryptocurrency address or email',
      condition: { field: 'operation', value: ['send_money', 'request_money'] },
    },
    {
      id: 'description',
      title: 'Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Optional description',
      condition: {
        field: 'operation',
        value: ['send_money', 'request_money'],
      },
    },
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '25',
      condition: {
        field: 'operation',
        value: ['list_accounts', 'list_transactions', 'list_buys', 'list_sells'],
      },
    },
  ],
  tools: {
    access: ['coinbase_api'],
    config: {
      tool: () => 'coinbase_api',
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
    accountId: { type: 'string', required: false },
    transactionId: { type: 'string', required: false },
    currencyPair: { type: 'string', required: false },
    currency: { type: 'string', required: false },
    amount: { type: 'string', required: false },
    amountCurrency: { type: 'string', required: false },
    paymentMethod: { type: 'string', required: false },
    toAddress: { type: 'string', required: false },
    description: { type: 'string', required: false },
    limit: { type: 'number', required: false },
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
      'REGULATORY NOTICE: Cryptocurrency trading and transactions carry significant financial risk. This block is intended for authorized use only. Users must comply with all applicable financial regulations, KYC/AML requirements, and cryptocurrency laws in their jurisdiction. Coinbase operates under regulatory oversight and requires identity verification. Service availability varies by region. Users are solely responsible for ensuring compliance with local laws and tax obligations.',
    restrictedRegions: ['Service availability varies by country'],
    requiresLicense: false,
    riskLevel: 'high',
  },
})
