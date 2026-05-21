declare module 'quickjs-emscripten' {
  export type QuickJSContext = any
  export type QuickJSHandle = any
  export function getQuickJS(): Promise<any>
}
