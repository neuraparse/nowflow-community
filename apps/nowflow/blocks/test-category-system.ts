/**
 * Test script for Enhanced Category System
 * Run with: npx tsx blocks/test-category-system.ts
 */
import {
  CAPABILITY_TAGS,
  filterBlocks,
  getBlocksByCapability,
  getBlocksByIndustryCategory,
  getEnrichedBlock,
  INDUSTRY_CATEGORIES,
  PRIMARY_CATEGORIES,
  searchBlocks,
} from './index'

console.log('🧪 Testing Enhanced Category System\n')
console.log('━'.repeat(80))

// Test 1: Get Trading Platforms
console.log('\n✅ Test 1: Get Trading Platforms')
console.log('━'.repeat(80))
const tradingBlocks = getBlocksByIndustryCategory(INDUSTRY_CATEGORIES.TRADING)
console.log(`Found ${tradingBlocks.length} trading platforms:`)
tradingBlocks.forEach((enriched) => {
  console.log(`  📊 ${enriched.block.name}`)
  console.log(`     Risk: ${enriched.riskLevel || 'N/A'}`)
  console.log(`     Compliance: ${enriched.requiresCompliance ? 'Required' : 'Not Required'}`)
})

// Test 2: Get Crypto Exchanges
console.log('\n✅ Test 2: Get Crypto Exchanges')
console.log('━'.repeat(80))
const cryptoBlocks = getBlocksByIndustryCategory(INDUSTRY_CATEGORIES.CRYPTO)
console.log(`Found ${cryptoBlocks.length} crypto exchanges:`)
cryptoBlocks.forEach((enriched) => {
  console.log(`  ₿ ${enriched.block.name}`)
})

// Test 3: Search for "trading"
console.log('\n✅ Test 3: Search for "trading"')
console.log('━'.repeat(80))
const searchResults = searchBlocks('trading')
console.log(`Found ${searchResults.length} results (showing top 5):`)
searchResults.slice(0, 5).forEach((enriched, index) => {
  console.log(`  ${index + 1}. ${enriched.block.name} (Score: ${enriched.searchScore})`)
})

// Test 4: Get OAuth-enabled blocks
console.log('\n✅ Test 4: Get OAuth-enabled blocks')
console.log('━'.repeat(80))
const oauthBlocks = getBlocksByCapability(CAPABILITY_TAGS.OAUTH)
console.log(`Found ${oauthBlocks.length} blocks with OAuth (showing first 10):`)
oauthBlocks.slice(0, 10).forEach((enriched) => {
  console.log(`  🔐 ${enriched.block.name}`)
})

// Test 5: Get Financial Trading blocks
console.log('\n✅ Test 5: Get Financial Trading blocks')
console.log('━'.repeat(80))
const financialBlocks = getBlocksByCapability(CAPABILITY_TAGS.FINANCIAL_TRADING)
console.log(`Found ${financialBlocks.length} financial trading blocks:`)
financialBlocks.forEach((enriched) => {
  console.log(`  💰 ${enriched.block.name}`)
})

// Test 6: Get Enriched Block (Robinhood)
console.log('\n✅ Test 6: Get Enriched Block (Robinhood)')
console.log('━'.repeat(80))
const robinhood = getEnrichedBlock('robinhood')
if (robinhood) {
  console.log(`Block: ${robinhood.block.name}`)
  console.log(`Primary Categories: ${robinhood.primaryCategories.join(', ')}`)
  console.log(`Industry Categories: ${robinhood.industryCategories.join(', ')}`)
  console.log(`Capability Tags: ${robinhood.capabilityTags.slice(0, 5).join(', ')}`)
  console.log(`Risk Level: ${robinhood.riskLevel}`)
  console.log(`Compliance Required: ${robinhood.requiresCompliance}`)
  console.log(`Compliance Tags: ${robinhood.complianceTags.join(', ')}`)
}

// Test 7: Filter high-risk blocks
console.log('\n✅ Test 7: Filter high-risk financial blocks')
console.log('━'.repeat(80))
const highRiskBlocks = filterBlocks({
  riskLevels: ['high', 'extreme'],
  includeCompliance: true,
})
console.log(`Found ${highRiskBlocks.length} high-risk blocks:`)
highRiskBlocks.forEach((enriched) => {
  console.log(`  ⚠️  ${enriched.block.name} (${enriched.riskLevel})`)
})

// Test 8: Get CRM Tools
console.log('\n✅ Test 8: Get CRM Tools')
console.log('━'.repeat(80))
const crmTools = getBlocksByIndustryCategory(INDUSTRY_CATEGORIES.CRM_SALES)
console.log(`Found ${crmTools.length} CRM tools:`)
crmTools.forEach((enriched) => {
  console.log(`  📇 ${enriched.block.name}`)
})

// Test 9: Get Payment Processing
console.log('\n✅ Test 9: Get Payment Processing')
console.log('━'.repeat(80))
const paymentBlocks = getBlocksByIndustryCategory(INDUSTRY_CATEGORIES.PAYMENTS)
console.log(`Found ${paymentBlocks.length} payment processors:`)
paymentBlocks.forEach((enriched) => {
  console.log(`  💳 ${enriched.block.name}`)
})

// Test 10: Multi-filter
console.log('\n✅ Test 10: Multi-filter (Integrations + OAuth + Trading)')
console.log('━'.repeat(80))
const multiFiltered = filterBlocks({
  primaryCategories: [PRIMARY_CATEGORIES.INTEGRATIONS],
  industryCategories: [INDUSTRY_CATEGORIES.TRADING],
  capabilityTags: [CAPABILITY_TAGS.OAUTH],
  excludeHidden: true,
})
console.log(`Found ${multiFiltered.length} blocks matching all criteria:`)
multiFiltered.forEach((enriched) => {
  console.log(`  🔍 ${enriched.block.name}`)
  console.log(`     Categories: ${enriched.allCategories.join(', ')}`)
})

console.log('\n' + '━'.repeat(80))
console.log('✅ All tests completed successfully!\n')
