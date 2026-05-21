import { FileIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface FileOperationsResponse extends ToolResponse {
  output: {
    success: boolean
    data?: string | Buffer | object
    path?: string
    error?: string
    metadata?: {
      size?: number
      type?: string
      lastModified?: string
      created?: string
    }
  }
}

export const FileOperationsBlock: BlockConfig<FileOperationsResponse> = {
  type: 'file_operations',
  name: 'File Operations',
  description: 'Advanced file system operations',
  longDescription:
    'Read, write, append, delete, and manage files with support for various formats including text, JSON, CSV, and binary files.',
  category: 'tools',
  bgColor: '#4CAF50',
  icon: FileIcon,
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Read File', id: 'read' },
        { label: 'Write File', id: 'write' },
        { label: 'Append to File', id: 'append' },
        { label: 'Delete File', id: 'delete' },
        { label: 'Check if File Exists', id: 'exists' },
        { label: 'Get File Metadata', id: 'metadata' },
        { label: 'List Directory', id: 'list' },
        { label: 'Create Directory', id: 'mkdir' },
      ],
    },
    {
      id: 'fileFormat',
      title: 'File Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Text', id: 'text' },
        { label: 'JSON', id: 'json' },
        { label: 'CSV', id: 'csv' },
        { label: 'Binary', id: 'binary' },
      ],
      condition: {
        field: 'operation',
        value: ['read', 'write', 'append'],
      },
    },
    {
      id: 'filePath',
      title: 'File Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter file path',
      condition: {
        field: 'operation',
        value: ['read', 'write', 'append', 'delete', 'exists', 'metadata'],
      },
    },
    {
      id: 'directoryPath',
      title: 'Directory Path',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter directory path',
      condition: {
        field: 'operation',
        value: ['list', 'mkdir'],
      },
    },
    {
      id: 'content',
      title: 'Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter content to write to file',
      condition: {
        field: 'operation',
        value: ['write', 'append'],
        and: {
          field: 'fileFormat',
          value: 'text',
        },
      },
      rows: 5,
    },
    {
      id: 'jsonContent',
      title: 'JSON Content',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "key": "value"\n}',
      condition: {
        field: 'operation',
        value: ['write', 'append'],
        and: {
          field: 'fileFormat',
          value: 'json',
        },
      },
    },
    {
      id: 'csvContent',
      title: 'CSV Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'column1,column2,column3\nvalue1,value2,value3',
      condition: {
        field: 'operation',
        value: ['write', 'append'],
        and: {
          field: 'fileFormat',
          value: 'csv',
        },
      },
      rows: 5,
    },
    {
      id: 'encoding',
      title: 'Encoding',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'UTF-8', id: 'utf8' },
        { label: 'ASCII', id: 'ascii' },
        { label: 'Binary', id: 'binary' },
      ],
      condition: {
        field: 'operation',
        value: ['read', 'write', 'append'],
        and: {
          field: 'fileFormat',
          value: ['text', 'json', 'csv'],
        },
      },
    },
    {
      id: 'recursive',
      title: 'Recursive',
      type: 'switch',
      layout: 'half',
      condition: {
        field: 'operation',
        value: ['list', 'mkdir'],
      },
    },
  ],
  tools: {
    access: ['file_operations'],
    config: {
      tool: () => 'file_operations',
      params: (params: Record<string, any>) => {
        // Transform parameters based on operation
        const transformedParams: Record<string, any> = {
          operation: params.operation || 'read',
        }

        // Add path based on operation type
        if (
          ['read', 'write', 'append', 'delete', 'exists', 'metadata'].includes(params.operation)
        ) {
          transformedParams.path = params.filePath
        } else if (['list', 'mkdir'].includes(params.operation)) {
          transformedParams.path = params.directoryPath
        }

        // Add content based on file format
        if (['write', 'append'].includes(params.operation)) {
          if (params.fileFormat === 'json') {
            transformedParams.content =
              typeof params.jsonContent === 'string'
                ? JSON.parse(params.jsonContent)
                : params.jsonContent
            transformedParams.format = 'json'
          } else if (params.fileFormat === 'csv') {
            transformedParams.content = params.csvContent
            transformedParams.format = 'csv'
          } else {
            transformedParams.content = params.content
            transformedParams.format = params.fileFormat || 'text'
          }
        }

        // Add encoding if applicable
        if (
          ['read', 'write', 'append'].includes(params.operation) &&
          ['text', 'json', 'csv'].includes(params.fileFormat)
        ) {
          transformedParams.encoding = params.encoding || 'utf8'
        }

        // Add recursive flag for directory operations
        if (['list', 'mkdir'].includes(params.operation)) {
          transformedParams.recursive = !!params.recursive
        }

        return transformedParams
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    fileFormat: { type: 'string', required: false },
    filePath: { type: 'string', required: false },
    directoryPath: { type: 'string', required: false },
    content: { type: 'string', required: false },
    jsonContent: { type: 'json', required: false },
    csvContent: { type: 'string', required: false },
    encoding: { type: 'string', required: false },
    recursive: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'any',
        path: 'string',
        error: 'string',
        metadata: 'json',
      },
    },
  },
}
