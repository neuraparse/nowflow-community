class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length() {
    return this.#values.size
  }

  clear() {
    for (const key of this.#values.keys()) {
      delete (this as any)[key]
    }
    this.#values.clear()
  }

  getItem(key: string) {
    const normalizedKey = String(key)
    return this.#values.has(normalizedKey) ? this.#values.get(normalizedKey)! : null
  }

  key(index: number) {
    return Array.from(this.#values.keys())[index] ?? null
  }

  removeItem(key: string) {
    const normalizedKey = String(key)
    this.#values.delete(normalizedKey)
    delete (this as any)[normalizedKey]
  }

  setItem(key: string, value: string) {
    const normalizedKey = String(key)
    const normalizedValue = String(value)
    this.#values.set(normalizedKey, normalizedValue)
    Object.defineProperty(this, normalizedKey, {
      configurable: true,
      enumerable: true,
      value: normalizedValue,
      writable: true,
    })
  }
}

function installStorageMock(name: 'localStorage' | 'sessionStorage') {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: new MemoryStorage(),
    writable: true,
  })
}

const localStorageIsUsable =
  typeof globalThis.localStorage !== 'undefined' &&
  typeof globalThis.localStorage.getItem === 'function' &&
  typeof globalThis.localStorage.setItem === 'function' &&
  typeof globalThis.localStorage.removeItem === 'function' &&
  typeof globalThis.localStorage.clear === 'function'

if (!localStorageIsUsable) {
  Object.defineProperty(globalThis, 'Storage', {
    configurable: true,
    value: MemoryStorage,
    writable: true,
  })

  installStorageMock('localStorage')
}

const sessionStorageIsUsable =
  typeof globalThis.sessionStorage !== 'undefined' &&
  typeof globalThis.sessionStorage.getItem === 'function' &&
  typeof globalThis.sessionStorage.setItem === 'function' &&
  typeof globalThis.sessionStorage.removeItem === 'function' &&
  typeof globalThis.sessionStorage.clear === 'function'

if (!sessionStorageIsUsable) {
  installStorageMock('sessionStorage')
}
