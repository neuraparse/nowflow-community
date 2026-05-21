import { DatabaseIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { parseJsonStrict } from '../helpers'
import { BlockConfig } from '../types'

interface SQLiteResponse extends ToolResponse {
  output: {
    result: any
    query: string
    affectedRows?: number
    error?: string
  }
}

export const SQLiteBlock: BlockConfig<SQLiteResponse> = {
  type: 'sqlite',
  name: 'SQLite Database',
  description: 'Query and manipulate SQLite databases',
  longDescription:
    'Connect to SQLite databases to run queries, insert, update, or delete data with full SQL support.',
  category: 'tools',
  bgColor: '#0078D7',
  icon: DatabaseIcon,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: 'Execute Query', id: 'query' },
        { label: 'Create Table', id: 'create_table' },
        { label: 'Insert Data', id: 'insert' },
        { label: 'Update Data', id: 'update' },
        { label: 'Delete Data', id: 'delete' },
      ],
    },
    {
      id: 'databasePath',
      title: 'Database Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter path to SQLite database file or :memory: for in-memory database',
    },
    {
      id: 'query',
      title: 'SQL Query',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder: 'SELECT * FROM table_name WHERE condition;',
      condition: {
        field: 'operation',
        value: 'query',
      },
    },
    {
      id: 'createTableQuery',
      title: 'Create Table Query',
      type: 'code',
      layout: 'full',
      language: 'javascript',
      placeholder: 'CREATE TABLE table_name (column1 datatype, column2 datatype, ...);',
      condition: {
        field: 'operation',
        value: 'create_table',
      },
    },
    {
      id: 'tableName',
      title: 'Table Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter table name',
      condition: {
        field: 'operation',
        value: ['insert', 'update', 'delete'],
      },
    },
    {
      id: 'data',
      title: 'Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "column1": "value1",\n  "column2": "value2"\n}',
      condition: {
        field: 'operation',
        value: ['insert', 'update'],
      },
    },
    {
      id: 'whereCondition',
      title: 'WHERE Condition',
      type: 'short-input',
      layout: 'full',
      placeholder: 'column1 = "value1" AND column2 > 100',
      condition: {
        field: 'operation',
        value: ['update', 'delete'],
      },
    },
  ],
  tools: {
    access: ['sqlite_database'],
    config: {
      tool: () => 'sqlite_database',
      params: (params: Record<string, any>) => {
        // Transform parameters based on operation
        const transformedParams: Record<string, any> = {
          databasePath: params.databasePath || ':memory:',
          operation: params.operation || 'query',
        }

        switch (params.operation) {
          case 'query':
            transformedParams.query = params.query
            break
          case 'create_table':
            transformedParams.query = params.createTableQuery
            break
          case 'insert':
            transformedParams.tableName = params.tableName
            transformedParams.data = parseJsonStrict(params.data, 'data')
            break
          case 'update':
            transformedParams.tableName = params.tableName
            transformedParams.data = parseJsonStrict(params.data, 'data')
            transformedParams.whereCondition = params.whereCondition
            break
          case 'delete':
            transformedParams.tableName = params.tableName
            transformedParams.whereCondition = params.whereCondition
            break
        }

        return transformedParams
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    databasePath: { type: 'string', required: true },
    query: { type: 'string', required: false },
    createTableQuery: { type: 'string', required: false },
    tableName: { type: 'string', required: false },
    data: { type: 'json', required: false },
    whereCondition: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        result: 'json',
        query: 'string',
        affectedRows: 'number',
        error: 'string',
      },
    },
  },
}
