import { IToken } from "ebnf"

export type CallableFunction = (callerNode: IToken, argNodes: IToken[], ctx: Closure) => Promise<any> | any

export class Closure {
  variables = new Map<string | symbol, any>()

  constructor(public parentContext: Closure | null) {}

  def(name: string | symbol, value: any) {
    this.variables.set(name, value)
  }

  defn(name: string | symbol, value: CallableFunction) {
    const fn: CallableFunction = (...args) => {
      try {
        return value(...args)
      } catch (e) {
        throw new Error('Error calling JS function: "' + name.toString() + '": ' + e.toString())
      }
    }
    this.variables.set(name, fn)
  }

  get(name: string | symbol): any {
    if (this.variables.has(name)) return this.variables.get(name)
    if (this.parentContext) return this.parentContext.get(name)
    return undefined
  }

  getChild() {
    return new Closure(this)
  }
}
