import { defaultArchipelago, Archipelago } from "../src"

import expect from "assert"
import { expectIslandsWith, expectIslandWith } from "./lib"

type PositionWithId = [string, number, number, number]

describe("archipelago", () => {
  let archipelago: Archipelago
  beforeEach(() => {
    // Distances are squared. We may want to make the interface so we don't have to consider that
    archipelago = defaultArchipelago({ joinDistance: 64 * 64, leaveDistance: 80 * 80 })
  })

  function setPositions(...positions: PositionWithId[]) {
    for (const position of positions) {
      const [id, ...coordinates] = position

      archipelago.setPeerPosition(id, coordinates)
    }
  }

  it("joins two close peers in island", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16])

    expect.strictEqual(archipelago.getIslands().length, 1)
    expectIslandWith(archipelago, "1", "2")
  })

  it("avoids joining a peer that is far away", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 200, 0, 200])

    const islands = archipelago.getIslands()

    expect.strictEqual(islands.length, 2)
    expectIslandsWith(archipelago, ["1", "2"], ["3"])
  })

  it("joins two existing islands when a peer 'bridges' them", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 100, 0, 0])

    expect.strictEqual(archipelago.getIslands().length, 2)
    expectIslandsWith(archipelago, ["1", "2"], ["3"])

    setPositions(["4", 50, 0, 0])

    expect.strictEqual(archipelago.getIslands().length, 1)

    expectIslandWith(archipelago, "1", "2", "3", "4")
  })

  it("splits islands when a peer leaves", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 50, 0, 0])
    expectIslandWith(archipelago, "1", "2", "3")

    setPositions(["3", 100, 0, 0])

    expectIslandsWith(archipelago, ["1", "2"], ["3"])
  })

  it("splits islands when a group of peers leaves", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 50, 0, 0], ["4", 45, 0, 0])
    expectIslandWith(archipelago, "1", "2", "3", "4")

    setPositions(["3", 100, 0, 0], ["4", 95, 0, 0])

    expectIslandsWith(archipelago, ["1", "2"], ["3", "4"])
  })

  it("respects join & leave radiuses for stability", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 50, 0, 0], ["4", 45, 0, 0])
    expectIslandWith(archipelago, "1", "2", "3", "4")

    setPositions(["5", -100, 0, 0], ["6", -105, 0, 0])

    expectIslandsWith(archipelago, ["1", "2", "3", "4"], ["5", "6"])

    setPositions(["5", -50, 0, 0])

    expectIslandWith(archipelago, "1", "2", "3", "4", "5", "6")

    setPositions(["5", -70, 0, 0])
    expectIslandWith(archipelago, "1", "2", "3", "4", "5", "6")

    setPositions(["5", -85, 0, 0])

    expectIslandsWith(archipelago, ["1", "2", "3", "4"], ["5", "6"])
  })

  it("keeps biggest island id when splitting", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 50, 0, 0], ["4", 45, 0, 0])
    const islandId = archipelago.getIslands()[0].id

    setPositions(["3", 150, 0, 0])

    const island = archipelago.getIsland(islandId)

    expect.notStrictEqual(island!.peers.map((it) => it.id).sort(), ["1", "2", "4"])

    expectIslandWith(archipelago, "3")
  })

  it("can clear a peer", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["4", 50, 0, 0], ["3", 100, 0, 0])

    expectIslandsWith(archipelago, ["1", "2", "3", "4"])

    archipelago.clearPeer("4")

    expectIslandsWith(archipelago, ["1", "2"], ["3"])
  })
})
