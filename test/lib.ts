import { Archipelago, ArchipelagoOptions, defaultArchipelago } from "../src"
import { BaseClosure, evaluate } from "tiny-clojure"
import { NodeError } from "tiny-clojure/dist/types"
import assert from "assert"
import get from "lodash.get"
import deepEqual from "fast-deep-equal"

export function expectIslandWith(archipelago: Archipelago, ...ids: string[]) {
  assert(Array.isArray(ids))
  const sortedIds = ids.sort()
  assert("getIslands" in archipelago)
  const islands = archipelago.getIslands()
  const condition = islands.some((it) => deepEqual(it.peers.map((peer) => peer.id).sort(), sortedIds))
  if (!condition) {
    throw new Error(
      "\nThere are no islands with the peers:\n  " +
        JSON.stringify(sortedIds) +
        "\nIslands have:\n" +
        islands.map((it) => "  " + it.id + " -> " + JSON.stringify(it.peers.map((peer) => peer.id).sort())).join("\n")
    )
  }
}

export function expectIslandsWith(archipelago: Archipelago, ...islandIds: string[][]) {
  assert("getIslands" in archipelago)
  assert(Array.isArray(islandIds))
  islandIds.forEach((ids) => expectIslandWith(archipelago, ...ids))
  assert.strictEqual(archipelago.getIslands().length, islandIds.length)
}

export function configureLibs(closure: BaseClosure) {
  // (configure { options })
  closure.defJsFunction("configure", (options: ArchipelagoOptions) => {
    closure.def("archipelago", defaultArchipelago(options))
  })

  // (move ...[peer x y z])
  closure.defJsFunction("move", (...args: [string, number, number, number][]) => {
    const archipelago = closure.get("archipelago") as Archipelago
    for (let arg of args) {
      archipelago.setPeerPosition(arg[0], arg.slice(1) as any)
    }
  })

  // (getIslands archipelago?)
  closure.defJsFunction("getIslands", (arch) => {
    const archipelago = (arch || closure.get("archipelago")) as Archipelago
    return archipelago.getIslands()
  })

  // (getIsland id archipelago?)
  closure.defJsFunction("getIsland", (id, arch?) => {
    const archipelago = (arch || closure.get("archipelago")) as Archipelago
    console.assert(typeof id == "string", "getIsland(islandId) islandId must be a string")
    return archipelago.getIsland(id)
  })

  // (expectIslandWith [...ids] arch?)
  closure.defJsFunction("expectIslandWith", (ids, arch) => {
    const archipelago = (arch || closure.get("archipelago")) as Archipelago
    expectIslandWith(archipelago, ...ids)
  })

  // (expectIslandsWith [...ids] arch?)
  closure.defJsFunction("expectIslandsWith", (ids, arch) => {
    const archipelago = (arch || closure.get("archipelago")) as Archipelago
    expectIslandsWith(archipelago, ...ids)
  })

  // (disconnect [...ids] arch?)
  closure.defJsFunction("disconnect", (ids, arch) => {
    const archipelago = (arch || closure.get("archipelago")) as Archipelago
    if (typeof ids == "string") {
      assert(archipelago.clearPeer(ids), `Peer ${ids} must be deleted`)
    } else if (Array.isArray(ids)) {
      ids.forEach(($: any) => assert(archipelago.clearPeer($), `Peer ${$} must be deleted`))
    } else throw new Error("Invalid argument")
  })

  // (get obj ...path)
  closure.defJsFunction("get", (obj, ...path: string[]) => {
    return get(obj, path)
  })

  // (* ...args)
  closure.defJsFunction("*", async function (...args: any[]) {
    return args.reduce((a, b) => a * b, 1)
  })

  // (+ ...args)
  closure.defJsFunction("+", async function (...args: any[]) {
    return args.reduce((a, b) => a + b, 0)
  })

  // (- ...args)
  closure.defJsFunction("-", async function (...args: any[]) {
    return args.reduce((a, b) => a - b)
  })

  // (/ ...args)
  closure.defJsFunction("/", async function (...args: any[]) {
    return args.reduce((a, b) => a / b)
  })

  // (= a b)
  closure.defJsFunction("=", async function (a, b) {
    assert.deepStrictEqual(arguments.length, 2, "(= a b) requires exactly two arguments")
    return deepEqual(a, b)
  })

  // (not a)
  closure.defJsFunction("not", async function (a) {
    assert.deepStrictEqual(arguments.length, 1, "(not arg) requires exactly one argument, got: " + arguments.length)
    return !a
  })

  // (assert/equal a b)
  closure.defJsFunction("assert/equal", async function (a, b) {
    assert.deepStrictEqual(arguments.length, 2, "assert/equal requires exactly two arguments")
    assert.deepStrictEqual(a, b)
    return true
  })

  // (assert/notEqual a b)
  closure.defJsFunction("assert/notEqual", async function (a, b) {
    assert.strictEqual(arguments.length, 2, "assert/notEqual requires exactly two arguments")
    assert.notDeepStrictEqual(a, b)
    return true
  })

  // (assert/throws ...assertions)
  closure.defn("assert/throws", async (node, assertions, closure) => {
    for (let assertion of assertions) {
      await assert.rejects(async () => {
        await evaluate(assertion, closure)
      }, new NodeError("The assertion didn't fail", assertion))
    }
    return true
  })

  // (assert "name" condition)
  closure.defJsFunction("throwIf", async function (condition) {
    if (condition) {
      throw new Error("bla")
    }
  })

  // (assert "name" condition)
  closure.defJsFunction("assert", async function (name, condition) {
    assert(condition, name)
  })

  // (test ...assertions)
  // (test "name" ...assertions)
  closure.defn("test", async (node, args, closure) => {
    const assertions = args.slice()
    let name = "Anonymus assertion"

    if (assertions.length && assertions[0].type == "String") {
      name = assertions.shift()!.text
    }

    try {
      for (let assertion of assertions) {
        await evaluate(assertion, closure)
      }
    } catch (e) {
      e.message = e.message + `\nat: ${name} assertion`
      throw e
    }
  })
}
