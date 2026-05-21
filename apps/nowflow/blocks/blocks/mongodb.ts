import { DatabaseIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { createOperationDropdown, defineBlock, parseJsonSafely } from '../helpers'

interface MongoDBResponse extends ToolResponse {
  output: {
    success: boolean
    result: any
    count?: number
    error?: string
  }
}

export const MongoDBBlock = defineBlock<MongoDBResponse>({
  type: 'mongodb',
  name: 'MongoDB',
  description: 'Connect and interact with MongoDB databases',
  longDescription:
    'Query, insert, update, and delete documents in MongoDB collections with support for complex queries and aggregations.',
  category: 'tools',
  bgColor: '#4DB33D',
  icon: DatabaseIcon,
  subBlocks: [
    {
      id: 'connectionString',
      title: 'Connection String',
      type: 'short-input',
      layout: 'full',
      placeholder: 'mongodb://username:password@host:port/database',
      password: true,
    },
    {
      id: 'database',
      title: 'Database',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter database name',
    },
    {
      id: 'collection',
      title: 'Collection',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter collection name',
    },
    createOperationDropdown({
      operations: [
        { id: 'find', label: 'Find Documents' },
        { id: 'findOne', label: 'Find One Document' },
        { id: 'insertOne', label: 'Insert One Document' },
        { id: 'insertMany', label: 'Insert Many Documents' },
        { id: 'updateOne', label: 'Update One Document' },
        { id: 'updateMany', label: 'Update Many Documents' },
        { id: 'deleteOne', label: 'Delete One Document' },
        { id: 'deleteMany', label: 'Delete Many Documents' },
        { id: 'count', label: 'Count Documents' },
        { id: 'aggregate', label: 'Aggregate' },
      ],
    }),
    {
      id: 'query',
      title: 'Query Filter',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "field": "value"\n}',
      condition: {
        field: 'operation',
        value: ['find', 'findOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'count'],
      },
    },
    {
      id: 'document',
      title: 'Document',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "field1": "value1",\n  "field2": "value2"\n}',
      condition: {
        field: 'operation',
        value: ['insertOne'],
      },
    },
    {
      id: 'documents',
      title: 'Documents',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '[\n  {\n    "field1": "value1"\n  },\n  {\n    "field1": "value2"\n  }\n]',
      condition: {
        field: 'operation',
        value: ['insertMany'],
      },
    },
    {
      id: 'update',
      title: 'Update',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "$set": {\n    "field": "new value"\n  }\n}',
      condition: {
        field: 'operation',
        value: ['updateOne', 'updateMany'],
      },
    },
    {
      id: 'options',
      title: 'Options',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "sort": { "field": 1 },\n  "limit": 10,\n  "skip": 0\n}',
      condition: {
        field: 'operation',
        value: ['find'],
      },
    },
    {
      id: 'pipeline',
      title: 'Aggregation Pipeline',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder:
        '[\n  { "$match": { "field": "value" } },\n  { "$group": { "_id": "$field", "count": { "$sum": 1 } } }\n]',
      condition: {
        field: 'operation',
        value: ['aggregate'],
      },
    },
  ],
  tools: {
    access: ['mongodb'],
    config: {
      tool: () => 'mongodb',
      params: (params: Record<string, any>) => {
        // Transform parameters based on operation
        const transformedParams: Record<string, any> = {
          connectionString: params.connectionString,
          database: params.database,
          collection: params.collection,
          operation: params.operation || 'find',
        }

        // Parse JSON strings to objects
        const parseJsonParam = (value: any) => parseJsonSafely(value) ?? {}

        // Add operation-specific parameters
        switch (params.operation) {
          case 'find':
            transformedParams.query = parseJsonParam(params.query)
            transformedParams.options = parseJsonParam(params.options)
            break
          case 'findOne':
          case 'deleteOne':
          case 'deleteMany':
          case 'count':
            transformedParams.query = parseJsonParam(params.query)
            break
          case 'insertOne':
            transformedParams.document = parseJsonParam(params.document)
            break
          case 'insertMany':
            transformedParams.documents = parseJsonParam(params.documents)
            break
          case 'updateOne':
          case 'updateMany':
            transformedParams.query = parseJsonParam(params.query)
            transformedParams.update = parseJsonParam(params.update)
            break
          case 'aggregate':
            transformedParams.pipeline = parseJsonParam(params.pipeline)
            break
        }

        return transformedParams
      },
    },
  },
  inputs: {
    connectionString: { type: 'string', required: true },
    database: { type: 'string', required: true },
    collection: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    query: { type: 'json', required: false },
    document: { type: 'json', required: false },
    documents: { type: 'json', required: false },
    update: { type: 'json', required: false },
    options: { type: 'json', required: false },
    pipeline: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        result: 'json',
        count: 'number',
        error: 'string',
      },
    },
  },
})
