import { describe, expect, it, vi } from 'vitest'
import { GitHubBlock } from '../github'

vi.mock('@/components/icons', () => ({ GithubIcon: () => null }))

describe('GitHubBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(GitHubBlock).toBeDefined()
    expect(typeof GitHubBlock.type).toBe('string')
    expect(typeof GitHubBlock.name).toBe('string')
    expect(GitHubBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(GitHubBlock.subBlocks)).toBe(true)
    expect(GitHubBlock.tools).toBeDefined()
  })

  it('has type matching filename (github)', () => {
    expect(GitHubBlock.type).toBe('github')
  })

  it('has subBlocks where every entry has id and type', () => {
    expect(GitHubBlock.subBlocks.length).toBeGreaterThan(0)
    for (const sub of GitHubBlock.subBlocks) {
      expect(typeof sub.id).toBe('string')
      expect(typeof sub.type).toBe('string')
    }
  })

  it('exposes all four github tools in access list', () => {
    expect(GitHubBlock.tools.access).toEqual(
      expect.arrayContaining([
        'github_pr',
        'github_comment',
        'github_repo_info',
        'github_latest_commit',
      ])
    )
  })

  it('tool selector dispatches based on operation', () => {
    const tool = GitHubBlock.tools.config!.tool
    expect(tool({ operation: 'github_pr' })).toBe('github_pr')
    expect(tool({ operation: 'github_comment' })).toBe('github_comment')
    expect(tool({ operation: 'github_repo_info' })).toBe('github_repo_info')
    expect(tool({ operation: 'github_latest_commit' })).toBe('github_latest_commit')
  })

  it('tool selector defaults to github_repo_info for unknown operation', () => {
    const tool = GitHubBlock.tools.config!.tool
    expect(tool({ operation: 'github_unknown' })).toBe('github_repo_info')
    expect(tool({})).toBe('github_repo_info')
  })

  it('declares apiKey as a password subBlock', () => {
    const apiKey = GitHubBlock.subBlocks.find((s) => s.id === 'apiKey')
    expect(apiKey).toBeDefined()
    expect((apiKey as any).password).toBe(true)
  })
})
