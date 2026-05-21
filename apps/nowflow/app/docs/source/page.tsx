import type { Metadata } from 'next'
import Link from 'next/link'
import fs from 'fs/promises'
import path from 'path'
import ReactMarkdown from 'react-markdown'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'NowFlow Docs Source',
  description: 'Read internal documentation sources for NowFlow.',
}

const getAppRoot = () => {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'nowflow'))) {
    return cwd
  }
  return path.join(cwd, 'apps', 'nowflow')
}

const getRepoRoot = (appRoot: string) => path.resolve(appRoot, '..', '..')

const getAllowedRoots = () => {
  const appRoot = getAppRoot()
  const repoRoot = getRepoRoot(appRoot)

  return [
    path.join(appRoot, 'app'),
    path.join(appRoot, 'docs'),
    path.join(appRoot, 'blocks'),
    path.join(appRoot, 'stores'),
    path.join(repoRoot, 'docs'),
  ]
}

const resolveDocPath = (rawPath: string) => {
  const cleaned = rawPath.replace(/^[./]+/, '').replace(/\\/g, '/')
  const allowedRoots = getAllowedRoots()

  for (const root of allowedRoots) {
    const candidate = path.resolve(root, cleaned)
    if (candidate.startsWith(root)) {
      return candidate
    }
  }

  throw new Error('Source path is not allowed.')
}

interface DocSourcePageProps {
  searchParams?: Promise<{ path?: string }> | { path?: string }
}

export default async function DocSourcePage({ searchParams }: DocSourcePageProps) {
  const resolvedParams = (await searchParams) ?? {}
  const requestedPath = resolvedParams.path ? String(resolvedParams.path) : ''

  if (!requestedPath) {
    return (
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
        <h1 className="text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
          Source not specified
        </h1>
        <p className="mt-3 text-[13px] text-zinc-400 dark:text-white/40 font-logo leading-relaxed">
          Provide a source path from the docs map to load the file.
        </p>
        <Link
          href="/docs"
          className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-logo font-semibold text-zinc-400 dark:text-white/40 hover:text-[#4A7A68] dark:hover:text-[#8CB09C] transition-colors duration-200"
        >
          Back to Docs
        </Link>
      </div>
    )
  }

  let content = ''
  let errorMessage = ''

  try {
    const resolvedPath = resolveDocPath(requestedPath)
    content = await fs.readFile(resolvedPath, 'utf-8')
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to read source file.'
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-white/12 font-logo">
            Source
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-logo font-light text-zinc-800 dark:text-white tracking-tight leading-[1.15]">
            {requestedPath}
          </h1>
        </div>
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-[11px] font-logo font-semibold text-zinc-400 dark:text-white/40 hover:text-[#4A7A68] dark:hover:text-[#8CB09C] transition-colors duration-200"
        >
          Back to Docs
        </Link>
      </div>

      {errorMessage ? (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-logo text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </div>
      ) : (
        <article className="prose prose-zinc dark:prose-invert mt-8 max-w-none prose-headings:font-logo prose-headings:tracking-tight prose-code:font-mono prose-p:font-sans prose-li:font-sans prose-p:text-zinc-400 dark:prose-p:text-white/40 prose-headings:text-zinc-800 dark:prose-headings:text-white">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      )}
    </div>
  )
}
