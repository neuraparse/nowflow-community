/**
 * FAQ Schema Component for Landing Page
 * Optimized for Google AI Overviews and Featured Snippets (2026)
 */

export function FAQSchema() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is NowFlow?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community is the open-source edition of NowFlow with a visual workflow builder, community integrations, human‑in‑the‑loop approval, built‑in data tables, BYOK AI provider settings, and self-hosted runtime control.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many integrations does NowFlow support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community includes a practical connector catalog, API blocks, and bring-your-own-key provider configuration. You can extend workflows with your own API calls and self-hosted connectors.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is human-in-the-loop in NowFlow?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "NowFlow's human‑in‑the‑loop feature pauses workflows for human approval and supports Send & Wait blocks for gathering input mid‑workflow inside your self-hosted workspace.",
        },
      },
      {
        '@type': 'Question',
        name: 'What agent workflow features are available?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community supports AI workflow blocks and bring-your-own-key model settings so teams can define inspectable agent steps in their own deployment.',
        },
      },
      {
        '@type': 'Question',
        name: 'What AI models does NowFlow support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community supports bring-your-own-key provider configuration for common AI providers and local LLMs through Ollama, depending on the blocks and credentials enabled in your workspace.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is NowFlow suitable for self-hosted team use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community is suitable for local evaluation and self-hosted community workflows. Operators are responsible for their own infrastructure, access controls, backups, and compliance posture.',
        },
      },
      {
        '@type': 'Question',
        name: 'What deployment surfaces does NowFlow support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'NowFlow Community focuses on local and self-hosted workflow execution. Available surfaces depend on the blocks, credentials, and runtime configuration enabled in your deployment.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does NowFlow have built-in data tables?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, NowFlow includes built-in data tables with smart insert, auto-schema detection, query & filter capabilities, and bulk operations. These serve as a native database within your workflows for ETL operations and data management.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is NowFlow Community free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. NowFlow Community is the open-source edition and can be run locally or self-hosted under the repository license.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  )
}
