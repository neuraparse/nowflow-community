'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Cloud, Database, Globe, ShoppingCart } from 'lucide-react'
// lucide icons removed — badge uses dot indicator instead
import {
  SiAirtable,
  SiAsana,
  SiClickup,
  SiDiscord,
  SiDropbox,
  SiEbay,
  SiFacebook,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGooglecloud,
  SiGoogledrive,
  SiHubspot,
  SiInstagram,
  SiJira,
  SiMongodb,
  SiNotion,
  SiPaypal,
  SiRedis,
  SiSalesforce,
  SiSap,
  SiShopify,
  SiSlack,
  SiStripe,
  SiTelegram,
  SiTiktok,
  SiTrello,
  SiWhatsapp,
  SiWoocommerce,
  SiX,
  SiYoutube,
  SiZendesk,
} from 'react-icons/si'

// Fallback components for removed react-icons
const SiAmazon = ShoppingCart
const SiAmazonwebservices = Cloud
const SiLinkedin = Globe
const SiOracle = Database

// Icon mapping
const iconComponents: Record<string, any> = {
  salesforce: SiSalesforce,
  sap: SiSap,
  amazonwebservices: SiAmazonwebservices,
  googlecloud: SiGooglecloud,
  mongodb: SiMongodb,
  oracle: SiOracle,
  instagram: SiInstagram,
  x: SiX,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  facebook: SiFacebook,
  slack: SiSlack,
  redis: SiRedis,
  whatsapp: SiWhatsapp,
  telegram: SiTelegram,
  discord: SiDiscord,
  gmail: SiGmail,
  googledrive: SiGoogledrive,
  dropbox: SiDropbox,
  hubspot: SiHubspot,
  notion: SiNotion,
  airtable: SiAirtable,
  asana: SiAsana,
  shopify: SiShopify,
  stripe: SiStripe,
  paypal: SiPaypal,
  woocommerce: SiWoocommerce,
  amazon: SiAmazon,
  ebay: SiEbay,
  github: SiGithub,
  gitlab: SiGitlab,
  jira: SiJira,
  trello: SiTrello,
  zendesk: SiZendesk,
  clickup: SiClickup,
}

// Simple Icons kullanarak gerçek logolar (npm paketi)
const integrations = [
  // Row 1 - Business systems & cloud
  { name: 'Salesforce', slug: 'salesforce', color: '#00A1E0' },
  { name: 'SAP', slug: 'sap', color: '#0FAAFF' },
  { name: 'AWS', slug: 'amazonwebservices', color: '#FF9900' },
  { name: 'Google Cloud', slug: 'googlecloud', color: '#4285F4' },
  { name: 'MongoDB', slug: 'mongodb', color: '#47A248' },
  { name: 'Oracle', slug: 'oracle', color: '#F80000' },

  // Row 2 - Social Media
  { name: 'Instagram', slug: 'instagram', color: '#E4405F' },
  { name: 'X', slug: 'x', color: '#000000' },
  { name: 'LinkedIn', slug: 'linkedin', color: '#0A66C2' },
  { name: 'TikTok', slug: 'tiktok', color: '#000000' },
  { name: 'YouTube', slug: 'youtube', color: '#FF0000' },
  { name: 'Facebook', slug: 'facebook', color: '#0866FF' },

  // Row 3 - Communication
  { name: 'Slack', slug: 'slack', color: '#4A154B' },
  { name: 'Redis', slug: 'redis', color: '#DC382D' },
  { name: 'WhatsApp', slug: 'whatsapp', color: '#25D366' },
  { name: 'Telegram', slug: 'telegram', color: '#26A5E4' },
  { name: 'Discord', slug: 'discord', color: '#5865F2' },
  { name: 'Gmail', slug: 'gmail', color: '#EA4335' },

  // Row 4 - Storage & Productivity
  { name: 'Google Drive', slug: 'googledrive', color: '#4285F4' },
  { name: 'Dropbox', slug: 'dropbox', color: '#0061FF' },
  { name: 'HubSpot', slug: 'hubspot', color: '#FF7A59' },
  { name: 'Notion', slug: 'notion', color: '#000000' },
  { name: 'Airtable', slug: 'airtable', color: '#18BFFF' },
  { name: 'Asana', slug: 'asana', color: '#F06A6A' },

  // Row 5 - E-commerce & Payment
  { name: 'Shopify', slug: 'shopify', color: '#7AB55C' },
  { name: 'Stripe', slug: 'stripe', color: '#008CDD' },
  { name: 'PayPal', slug: 'paypal', color: '#00457C' },
  { name: 'WooCommerce', slug: 'woocommerce', color: '#96588A' },
  { name: 'Amazon', slug: 'amazon', color: '#FF9900' },
  { name: 'eBay', slug: 'ebay', color: '#E53238' },

  // Row 6 - Development & Tools
  { name: 'GitHub', slug: 'github', color: '#181717' },
  { name: 'GitLab', slug: 'gitlab', color: '#FC6D26' },
  { name: 'Jira', slug: 'jira', color: '#0052CC' },
  { name: 'Trello', slug: 'trello', color: '#0052CC' },
  { name: 'Zendesk', slug: 'zendesk', color: '#03363D' },
  { name: 'ClickUp', slug: 'clickup', color: '#7B68EE' },
]

function IntegrationCard({
  integration,
}: {
  integration: { name: string; slug: string; color: string }
}) {
  return (
    <div className="community-ui-integration-card group/card relative h-[82px] w-[156px] shrink-0 cursor-default overflow-hidden rounded-[18px] transition-all duration-300 hover:z-10 hover:-translate-y-0.5 md:h-[92px] md:w-[182px]">
      <div className="absolute inset-0 rounded-[18px] border border-black/[0.06] dark:border-white/[0.07]" />
      <div
        className="absolute inset-[8px] rounded-[12px] opacity-0 blur-2xl transition-opacity duration-500 group-hover/card:opacity-100"
        style={{
          background: `radial-gradient(circle, ${integration.color}18 0%, transparent 68%)`,
        }}
      />
      <div className="community-ui-integration-card-pane silver-glass-pane absolute inset-px z-10 flex items-center gap-3 rounded-[16px] border border-black/[0.04] bg-[rgba(244,246,248,0.9)] px-3.5 transition-all duration-300 group-hover/card:bg-[rgba(250,251,252,0.97)] dark:border-white/[0.04] dark:bg-[rgba(13,12,10,0.88)] dark:group-hover/card:bg-[rgba(18,16,13,0.96)] md:px-4">
        <div className="community-ui-integration-icon-shell relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] md:h-11 md:w-11">
          {iconComponents[integration.slug] ? (
            React.createElement(iconComponents[integration.slug], {
              className:
                'h-7 w-7 transition-transform duration-300 group-hover/card:scale-[1.06] md:h-8 md:w-8',
              color: integration.color,
              style: { opacity: 0.9 },
            })
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-zinc-500 dark:bg-white/[0.06] dark:text-white/40 md:h-8 md:w-8">
              {integration.name.slice(0, 2)}
            </div>
          )}
        </div>
        <div className="community-ui-integration-meta min-w-0">
          <span className="community-ui-integration-kicker block font-tech text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-white/[0.26]">
            Integration Node
          </span>
          <span className="community-ui-integration-name mt-1 block truncate font-tech text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 transition-colors duration-300 group-hover/card:text-zinc-700 dark:text-white/[0.45] dark:group-hover/card:text-white/78 md:text-[11px]">
            {integration.name}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsShowcase() {
  return (
    <section className="community-ui-section gb-integrations relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 h-[800px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-25"
          style={{
            background:
              'radial-gradient(ellipse, rgba(142,116,84,0.12) 0%, rgba(74,122,104,0.06) 42%, transparent 72%)',
          }}
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="community-ui-section-head text-center mb-14 md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-6 inline-flex odyssey-editorial-kicker">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              Extensible Integrations
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Cross-system orchestration
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-5 max-w-[10ch] text-[2.45rem] text-zinc-800 dark:text-white md:mb-6 md:text-[3.2rem] lg:text-[4rem]">
            Connect{' '}
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent">
              Everything
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-2xl text-[15.5px] md:text-[17px]">
            Orchestrate business systems, commerce platforms, and modern APIs from one self-hosted
            application layer built in NowFlow.
          </p>
        </motion.div>

        {/* Scrolling integration rows */}
        <div className="relative mb-14 md:mb-20">
          <div
            className="community-ui-marquee-mask space-y-4 md:space-y-5 overflow-hidden"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 9%, black 91%, transparent 100%)',
            }}
          >
            {/* Row 1 */}
            <motion.div
              className="flex gap-3 md:gap-4"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
            >
              {[...integrations.slice(0, 12), ...integrations.slice(0, 12)].map(
                (integration, i) => (
                  <IntegrationCard key={`r1-${i}`} integration={integration} />
                )
              )}
            </motion.div>

            {/* Row 2 - reverse */}
            <motion.div
              className="flex gap-3 md:gap-4"
              animate={{ x: ['-50%', '0%'] }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              {[...integrations.slice(12, 24), ...integrations.slice(12, 24)].map(
                (integration, i) => (
                  <IntegrationCard key={`r2-${i}`} integration={integration} />
                )
              )}
            </motion.div>

            {/* Row 3 */}
            <motion.div
              className="flex gap-3 md:gap-4"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}
            >
              {[...integrations.slice(24, 36), ...integrations.slice(24, 36)].map(
                (integration, i) => (
                  <IntegrationCard key={`r3-${i}`} integration={integration} />
                )
              )}
            </motion.div>
          </div>
        </div>

        {/* Bottom stats strip */}
        <motion.div
          className="community-ui-data-strip silver-glass-pane mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 rounded-[18px] border border-black/[0.05] bg-[rgba(244,246,248,0.88)] px-6 py-6 dark:border-white/[0.06] dark:bg-[rgba(13,12,10,0.82)] md:gap-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {[
            { value: 'API', label: 'Integrations', color: '#74D4FF' },
            { value: 'BYOK', label: 'Provider Keys', color: '#DCFD38' },
            { value: 'Local', label: 'Runtime Control', color: '#BDEEFF' },
            { value: 'OSS', label: 'Community Build', color: '#F9C65C' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="odyssey-editorial-stat flex min-w-[140px] flex-col items-center gap-1.5"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span
                className="font-heading text-2xl font-medium leading-none tracking-[-0.04em] md:text-[36px]"
                style={{ color: stat.color }}
              >
                {stat.value}
              </span>
              <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-white/[0.45] md:text-[11px]">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
