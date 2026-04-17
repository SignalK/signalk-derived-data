// Ambient type shim for `cubic-spline` (v3). The package ships no
// .d.ts of its own. Only the public class API is declared here —
// internal helpers (zerosMat, solve, etc.) stay untyped because
// consumers never touch them.
declare module 'cubic-spline' {
  export default class Spline {
    xs: number[]
    ys: number[]
    ks: Float64Array
    constructor(xs: number[], ys: number[])
    at(x: number): number
    getIndexBefore(target: number): number
  }
}
