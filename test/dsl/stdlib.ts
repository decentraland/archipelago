import { evaluate } from "./vm"
import { NodeError } from "./types"
import { Closure, CallableFunction } from "./closure"

const rawStdlib: Record<string, CallableFunction> = {
  if: async function (_caller, args, callerClosure) {
    const cond = await evaluate(args[0], callerClosure)
    if (cond) return await evaluate(args[1], callerClosure)
    return args.length > 2 ? await evaluate(args[2], callerClosure) : null
  },
  def: async function (_caller, [nameNode, valueNode], callerClosure) {
    if (nameNode.type != "Symbol") throw new NodeError("You can only define using symbols", nameNode)

    const name = nameNode.text
    if (typeof name == "string") return callerClosure.def(name, await evaluate(valueNode, callerClosure))
  },
}

export class BaseClosure extends Closure {
  constructor(lib: Record<string | symbol, CallableFunction> = rawStdlib) {
    super(null)
    for (let i in lib) {
      if (lib.hasOwnProperty(i)) {
        this.def(i, lib[i])
      }
    }
  }

  get(name: string | symbol) {
    if (this.variables.has(name)) return this.variables.get(name)
    if (this.parentContext) return this.parentContext.get(name)
    return undefined
  }

  defJsFunction(name: string | symbol, fn: (...args: any[]) => any) {
    this.defn(name, async function (caller, args, callerClosure) {
      const materializedArgs: any[] = []
      for (let i = 0; i < args.length; i++) {
        materializedArgs.push(await evaluate(args[i], callerClosure))
      }
      return fn(...materializedArgs)
    } as CallableFunction)
  }
}
