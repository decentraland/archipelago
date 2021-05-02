// This file is both used int he webapp and with mocha,
// please do not put any file system or "mocha" logic here
// to mantain compatibility

import { IToken } from "ebnf"
import { Closure, evaluate, parse } from "./dsl"

export type PositionCapable<T> = { start: number; end: number } & T
export type DocumentError = PositionCapable<{ message: string }>
export type Step = PositionCapable<{ node: IToken } & ((closure: Closure) => Promise<any>)>

export type DocumentParsingResult = {
  errors: DocumentError[]
  steps: Step[]
  document: IToken
}

export function parseTestSuite(code: string): DocumentParsingResult {
  const { syntaxErrors, document } = parse(code)

  const errors: DocumentError[] = []
  const steps: Step[] = []

  for (let err of syntaxErrors) {
    errors.push({
      start: err.start,
      end: err.end,
      message: "SyntaxError",
    })
  }

  if (document.children.length == 0) {
    errors.push({
      start: 0,
      end: code.length,
      message: "The document is empty",
    })
  }

  for (let child of document.children) {
    switch (true) {
      case child.type == "List": {
        steps.push(
          Object.assign(
            (closure: Closure) => {
              return evaluate(child, closure)
            },
            { start: child.start, end: child.end, node: child }
          )
        )
        break
      }
      default:
        errors.push({
          start: child.start,
          end: child.end,
          message: "Invalid test step, it will be ignored",
        })
    }
  }

  return {
    errors,
    steps,
    document,
  }
}
