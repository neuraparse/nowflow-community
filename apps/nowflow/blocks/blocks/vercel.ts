import { VercelIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const VercelBlock = defineBlock({
  type: 'vercel',
  name: 'Vercel',
  description: 'Frontend deployment and hosting platform',
  longDescription:
    'Integrate with Vercel to deploy frontend applications, manage projects, create deployments, configure environment variables, and monitor deployments. Perfect for Next.js and modern web applications with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#000000',
  icon: VercelIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'vercel',
      serviceId: 'vercel',
      requiredScopes: [],
      title: 'Vercel Account',
      placeholder: 'Select Vercel account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_projects', label: 'List Projects' },
        { id: 'get_project', label: 'Get Project' },
        { id: 'create_deployment', label: 'Create Deployment' },
        { id: 'list_deployments', label: 'List Deployments' },
        { id: 'get_deployment', label: 'Get Deployment' },
        { id: 'create_env', label: 'Create Environment Variable' },
        { id: 'list_domains', label: 'List Domains' },
      ],
      defaultValue: 'list_projects',
    }),
    {
      id: 'projectId',
      title: 'Project ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter project ID',
      condition: { field: 'operation', value: ['get_project', 'create_deployment', 'create_env'] },
    },
    {
      id: 'deploymentId',
      title: 'Deployment ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter deployment ID',
      condition: { field: 'operation', value: 'get_deployment' },
    },
    {
      id: 'gitSource',
      title: 'Git Source (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"type": "github", "repo": "owner/repo", "ref": "main"}',
      condition: { field: 'operation', value: 'create_deployment' },
    },
  ],
  tools: {
    access: ['vercel_api'],
    config: {
      tool: () => 'vercel_api',
      params: (params) => {
        const { credential, gitSource, ...rest } = params as Record<string, any>
        return {
          credential,
          gitSource: gitSource ? JSON.parse(gitSource) : undefined,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    projectId: { type: 'string', required: false },
    deploymentId: { type: 'string', required: false },
    gitSource: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
