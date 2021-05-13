import { defaultArchipelago, Archipelago, IslandUpdates } from "../src"

import expect from "assert"
import { expectIslandsWith, expectIslandWith } from "./lib"

type PositionWithId = [string, number, number, number]

describe("archipelago", () => {
  let archipelago: Archipelago
  beforeEach(() => {
    archipelago = defaultArchipelago({ joinDistance: 64, leaveDistance: 80 })
  })

  function setPositions(...positions: PositionWithId[]) {
    archipelago.setPeersPositions(...positions.map(([id, ...position]) => ({ id, position })))
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

    archipelago.clearPeers("4")

    expectIslandsWith(archipelago, ["1", "2"], ["3"])
  })

  it("can add a peer again after it has been cleared", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16])

    expectIslandsWith(archipelago, ["1", "2"])

    archipelago.clearPeers("1")
    archipelago.clearPeers("2")

    setPositions(["1", 0, 0, 0])

    expectIslandsWith(archipelago, ["1"])
  })

  function expectChangedTo(updates: IslandUpdates, peerId: string, islandId: string) {
    expect.strictEqual(updates[peerId].islandId, islandId)
    expect.strictEqual(updates[peerId].action, "changeTo")
  }

  function expectLeft(updates: IslandUpdates, peerId: string, islandId: string) {
    expect.strictEqual(updates[peerId].islandId, islandId)
    expect.strictEqual(updates[peerId].action, "leave")
  }

  function expectNoUpdate(updates: IslandUpdates, peerId: string) {
    expect.strictEqual(typeof updates[peerId], "undefined")
  }

  it("provides updates when setting positions", () => {
    let updates = archipelago.setPeersPositions({ id: "0", position: [15, 0, 0] })

    expectChangedTo(updates, "0", "I1")
    updates = archipelago.setPeersPositions({ id: "1", position: [0, 0, 0] })
    expectChangedTo(updates, "1", "I1")
    expectNoUpdate(updates, "0")

    updates = archipelago.setPeersPositions({ id: "2", position: [100, 0, 0] })

    expectChangedTo(updates, "2", "I3")
    expectNoUpdate(updates, "1")
    expectNoUpdate(updates, "0")

    updates = archipelago.setPeersPositions({ id: "3", position: [50, 0, 0] })

    expectChangedTo(updates, "2", "I1")
    expectChangedTo(updates, "3", "I1")
    expectNoUpdate(updates, "1")
    expectNoUpdate(updates, "0")
  })

  it("provides updates when clearing peer", () => {
    setPositions(["1", 0, 0, 0], ["2", 50, 0, 0], ["3", 100, 0, 0])

    expectIslandsWith(archipelago, ["1", "2", "3"])

    const updates = archipelago.clearPeers("2")

    expectLeft(updates, "2", "I1")
    expectChangedTo(updates, "3", "I4")
    expectNoUpdate(updates, "1")
  })

  it("calculates island geometry", () => {
    setPositions(["1", 0, 0, 0], ["2", 40, 0, 40])

    const island = archipelago.getIslands()[0]

    expect.deepStrictEqual(island.center, [20, 0, 20])
    expect(Math.abs(island.radius - Math.sqrt(800)) < 0.0000001) // Distance between center and farthest peer
  })


  it("sets radius to encompass all peers", () => {
    setPositions(["1", 0, 0, 0], ["2", 10, 0, 10], ["3", 6, 0, 6], ["4", 40, 0, 40])

    const island = archipelago.getIslands()[0]

    expect.deepStrictEqual(island.center, [14, 0, 14])
    expect(Math.abs(island.radius - Math.sqrt(1352)) < 0.0000001)
  })
})
