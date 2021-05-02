import { evaluate } from "./vm"
import { NodeError } from "./types"
import { Closure, CallableFunction } from "./closure"

const rawStdlib: Record<string, CallableFunction> = {
  if: async function (_caller, args, callerClosure) {
    const cond = await evaluate(args[0], callerClosure)
    if (cond) return await evaluate(args[1], callerClosure)
    return args.length > 2 ? await evaluate(args[2], callerClosure) : null
  },
}

export class BaseClosure extends Closure {
  constructor(private stdlib: Record<string | symbol, CallableFunction> = rawStdlib) {
    super(null)
  }

  get(name: string | symbol) {
    if (this.variables.has(name)) return this.variables.get(name)
    if (this.parentContext) return this.parentContext.get(name)
    if (name in this.stdlib) return this.stdlib[name as any]
    return undefined
  }

  defJsFunction(name: string | symbol, fn: (...args: any[]) => any) {
    this.def(name, async function (caller, args, callerClosure) {
      const materializedArgs: any[] = []
      for (let i = 0; i < args.length; i++) {
        materializedArgs.push(await evaluate(args[i], callerClosure))
      }
      try {
        return fn(...args)
      } catch (e) {
        throw new NodeError(e.toString(), caller)
      }
    } as CallableFunction)
  }
}
