// Augment drizzle-orm to fix TypeScript module resolution issues
declare module 'drizzle-orm/pg-core' {
  export function index(name?: string): any
  export function primaryKey(...columns: any[]): any
  export function real(name: string): any
  export function uuid(name: string): any
  export function uniqueIndex(name?: string): any
  export function customType<T = any>(params: {
    dataType: (config?: any) => string
    toDriver?: (value: any) => any
    fromDriver?: (value: any) => any
  }): any
  export function vector(name: string, config?: { dimensions: number }): any
}

// Fix drizzle-orm sql function
declare module 'drizzle-orm' {
  interface SQL {
    join(values: any[], separator: any): any
  }
  const sql: ((strings: TemplateStringsArray, ...values: any[]) => any) & {
    join: (values: any[], separator: any) => any
    raw: (value: string) => any
    empty: any
    fromList: (list: any[]) => any
    identifier: (value: string) => any
    placeholder: (name: string) => any
    param: (value: any) => any
  }
}
