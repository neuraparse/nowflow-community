'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    question: 'What is NowFlow and how does it work?',
    answer:
      'NowFlow is an AI-powered workflow automation platform that lets you build complex workflows visually with drag-and-drop blocks. Connect APIs, credentials, and data sources, then deploy through the surfaces enabled in your edition.',
  },
  {
    question: 'Can I use NowFlow for robotics and IoT applications?',
    answer:
      'Absolutely! NowFlow supports webhook triggers and real-time data processing, making it ideal for robotics and IoT. Integrate sensor data, control devices with voice commands, automate digital screens, and build custom API integrations for any hardware.',
  },
  {
    question: 'What integrations are available?',
    answer:
      'Community includes a practical connector catalog, custom API blocks, and bring-your-own-key provider configuration. You can extend workflows with your own API calls and self-hosted connectors.',
  },
  {
    question: 'What AI agents are included?',
    answer:
      'NowFlow Community supports AI workflow blocks and bring-your-own-key model settings so teams can define inspectable agent steps in their own deployment.',
  },
  {
    question: 'Is NowFlow Community free?',
    answer:
      'Yes. NowFlow Community is the open-source edition and can be run locally or self-hosted under the repository license. There are no hosted-plan quotas, inference credits, or credit-card requirements in this release.',
  },
  {
    question: 'How does Human-in-the-Loop work?',
    answer:
      'Pause workflows at critical steps and request human approval through the channels enabled in your workspace.',
  },
  {
    question: 'What deployment options are available?',
    answer:
      'Community builds focus on local and self-hosted workflow execution. Available surfaces depend on the blocks, credentials, and runtime configuration enabled in your deployment.',
  },
  {
    question: 'How secure is my data?',
    answer:
      'Community users control their own deployment, database, provider keys, and storage. Your operator is responsible for access controls, backups, network security, and compliance posture.',
  },
  {
    question: 'Do I need a subscription?',
    answer:
      'No subscription is required for the Community source distribution. You are responsible for any infrastructure, provider API, or third-party service costs you choose to connect.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="community-ui-section gb-faq relative overflow-hidden bg-[#f4f5f7] py-24 dark:bg-transparent md:py-32 lg:py-40">
      <div className="container mx-auto px-4 sm:px-5 md:px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="community-ui-section-head text-center mb-14 md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex odyssey-editorial-kicker">
            <span className="odyssey-editorial-dot" />
            <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/40">
              FAQ
            </span>
            <span className="h-3.5 w-px bg-black/[0.07] dark:bg-white/[0.08]" />
            <span className="font-heading text-[13px] font-medium tracking-[-0.03em] text-[#4d6268] dark:text-[#b9c8cf]">
              Calm objections, clearly
            </span>
          </div>
          <h2 className="odyssey-display-title mx-auto mb-6 max-w-[11ch] text-[2.45rem] text-zinc-800 dark:text-white md:text-[3.25rem] lg:text-[4rem]">
            Frequently Asked{' '}
            <span className="odyssey-display-accent bg-linear-to-r from-[#5B7B6F] via-[#4A7A68] to-[#6B8F80] dark:from-[#6EDAB0] dark:via-[#5EC9A0] dark:to-[#4AB890] bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="odyssey-section-copy mx-auto max-w-lg text-[15.5px] md:text-[17px]">
            Everything you need to know about NowFlow.
          </p>
        </motion.div>

        {/* FAQ accordion */}
        <div className="max-w-3xl mx-auto relative">
          <div className="community-ui-shell community-ui-faq-shell silver-glass-panel signal-accent-frame relative rounded-[20px] border border-black/[0.06] bg-[rgba(244,246,248,0.88)] dark:border-white/[0.06] dark:bg-[rgba(13,12,10,0.86)]">
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index
              const num = String(index + 1).padStart(2, '0')

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                  className={cn(
                    'community-ui-faq-item',
                    index < faqs.length - 1
                      ? 'border-b border-black/[0.05] dark:border-white/[0.05]'
                      : ''
                  )}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="community-ui-faq-trigger flex w-full items-center gap-4 px-6 py-5 text-left transition-colors duration-200 hover:bg-black/[0.015] dark:hover:bg-white/[0.01] md:gap-6 md:px-10 md:py-6"
                  >
                    {/* Number */}
                    <span
                      className={`shrink-0 font-tech text-[10px] font-semibold uppercase tracking-[0.16em] leading-none transition-colors duration-300 ${
                        isOpen
                          ? 'text-[#74D4FF] dark:text-[#BDEEFF]'
                          : 'text-zinc-300 dark:text-white/[0.16]'
                      }`}
                    >
                      {num}
                    </span>

                    {/* Question */}
                    <span
                      className={`flex-1 font-heading text-[15px] font-medium leading-[1.6] tracking-[-0.02em] transition-colors duration-300 md:text-[16px] ${
                        isOpen
                          ? 'text-zinc-800 dark:text-white'
                          : 'text-zinc-600 dark:text-white/44'
                      }`}
                    >
                      {faq.question}
                    </span>

                    {/* Chevron */}
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="shrink-0"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-colors duration-300 ${
                          isOpen
                            ? 'text-[#74D4FF] dark:text-[#BDEEFF]'
                            : 'text-zinc-300 dark:text-white/28'
                        }`}
                        strokeWidth={1.5}
                      />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 md:px-10 pb-6 md:pb-7">
                          {/* Offset to align with question text (past the number) */}
                          <div className="community-ui-faq-answer pl-[26px] md:pl-[34px]">
                            <p className="font-body text-[13.5px] leading-[1.72] tracking-[-0.012em] text-zinc-500 dark:text-white/[0.62]">
                              {faq.answer}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-12 md:mt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="font-body text-[13px] leading-[1.6] tracking-[-0.012em] text-zinc-400 dark:text-white/28">
            Still have questions?{' '}
            <a
              href="/contact"
              className="text-[#dcfd38] dark:text-[#f2ff84] hover:underline underline-offset-4 transition-colors duration-200"
            >
              Talk to our team
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
