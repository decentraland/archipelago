import { Archipelago, ArchipelagoOptions, defaultArchipelago } from "../src"
import { BaseClosure, evaluate } from "tiny-clojure"
import assert from "assert"
import get from "lodash.get"

function arraysEqual(a: any[], b: any[]) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }

  return true
}

export function expectIslandWith(archipelago: Archipelago, ...ids: string[]) {
  assert(Array.isArray(ids))
  const sortedIds = ids.sort()
  assert("getIslands" in archipelago)
  const islands = archipelago.getIslands()
  const condition = islands.some((it) => arraysEqual(it.peers.map((peer) => peer.id).sort(), sortedIds))
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

  // (equals a b)
  closure.defJsFunction("assert/equals", async function (a, b) {
    assert.strictEqual(arguments.length, 2)
    assert.strictEqual(a, b)
  })

  closure.defJsFunction("assert/notEqual", async function (a, b) {
    assert.strictEqual(arguments.length, 2)
    assert.notStrictEqual(a, b)
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

    for (let assertion of assertions) {
      await evaluate(assertion, closure)
    }
  })
}
