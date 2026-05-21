import { BitbucketIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const BitbucketBlock: BlockConfig = {
  type: 'bitbucket',
  name: 'Bitbucket',
  description: 'Manage Bitbucket repositories and pull requests',
  longDescription:
    'Integrate with Bitbucket to manage repositories, create and review pull requests, manage pipelines, and automate your development workflow with OAuth authentication.',
  category: 'tools',
  bgColor: '#0052CC',
  icon: BitbucketIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Bitbucket Account',
      type: 'oauth-input',
      layout: 'full',
      provider: 'bitbucket',
      serviceId: 'bitbucket',
      requiredScopes: ['repository', 'pullrequest'],
      placeholder: 'Select Bitbucket account',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'list_repos', label: 'List Repositories' },
        { id: 'get_repo', label: 'Get Repository' },
        { id: 'list_prs', label: 'List Pull Requests' },
        { id: 'create_pr', label: 'Create Pull Request' },
        { id: 'list_commits', label: 'List Commits' },
      ],
      value: () => 'list_repos',
    },
    {
      id: 'workspace',
      title: 'Workspace',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter workspace slug',
    },
    {
      id: 'repoSlug',
      title: 'Repository Slug',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter repository slug',
      condition: {
        field: 'operation',
        value: ['get_repo', 'list_prs', 'create_pr', 'list_commits'],
      },
    },
    {
      id: 'title',
      title: 'PR Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter pull request title',
      condition: { field: 'operation', value: 'create_pr' },
    },
    {
      id: 'sourceBranch',
      title: 'Source Branch',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., feature/new-feature',
      condition: { field: 'operation', value: 'create_pr' },
    },
    {
      id: 'destinationBranch',
      title: 'Destination Branch',
      type: 'short-input',
      layout: 'half',
      placeholder: 'e.g., main',
      condition: { field: 'operation', value: 'create_pr' },
    },
  ],
  tools: {
    access: ['bitbucket_api'],
    config: {
      tool: () => 'bitbucket_api',
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
    workspace: { type: 'string', required: false },
    repoSlug: { type: 'string', required: false },
    title: { type: 'string', required: false },
    sourceBranch: { type: 'string', required: false },
    destinationBranch: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
