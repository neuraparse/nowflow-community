declare namespace Chai {
  interface Assertion {
    not: Assertion
  }
}

declare module 'chai' {
  export = Chai
}
