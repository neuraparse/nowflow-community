import { createLogger } from '@/lib/logs/console-logger'
import contentCreationWorkflow from './content_creation_workflow.json'
import customerServiceWorkflow from './customer_service_workflow.json'
import dataAnalysisWorkflow from './data_analysis_workflow.json'
import ecommerceWorkflow from './ecommerce_workflow.json'
import educationWorkflow from './education_workflow.json'
import healthcareWorkflow from './healthcare_workflow.json'
import simpleWorkflow from './simple_workflow.json'

const logger = createLogger('index')

export interface ExampleWorkflow {
  metadata: {
    name: string
    description: string
    category: string
    tags: string[]
  }
  blocks: any[]
  edges: any[]
}

export interface WorkflowCategory {
  id: string
  name: string
  description: string
  workflows: string[]
}

export const exampleWorkflows: Record<string, ExampleWorkflow> = {
  simpleWorkflow,
  customerServiceWorkflow,
  contentCreationWorkflow,
  dataAnalysisWorkflow,
  educationWorkflow,
  healthcareWorkflow,
  ecommerceWorkflow,
}

export const workflowCategories: WorkflowCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'General purpose workflows',
    workflows: ['simpleWorkflow'],
  },
  {
    id: 'customer-service',
    name: 'Customer Service',
    description: 'Answer customer inquiries and automate support processes',
    workflows: ['customerServiceWorkflow'],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Workflows for content creation and marketing',
    workflows: ['contentCreationWorkflow'],
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Extract information from data sources and analyze it',
    workflows: ['dataAnalysisWorkflow'],
  },
  {
    id: 'education',
    name: 'Education',
    description: 'Workflows that assist students and create educational materials',
    workflows: ['educationWorkflow'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Provide health information and patient support',
    workflows: ['healthcareWorkflow'],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'E-commerce workflows that provide product recommendations and customer support',
    workflows: ['ecommerceWorkflow'],
  },
]

// Debug: Log available workflows
logger.debug('Available workflows in index.ts:', Object.keys(exampleWorkflows))

export default exampleWorkflows
