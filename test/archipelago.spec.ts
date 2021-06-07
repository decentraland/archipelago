import { Archipelago} from "../src/domain/Archipelago"

import expect from "assert"
import { expectIslandsWith, expectIslandWith, setMultiplePeersAround } from "./lib"
import { sequentialIdGenerator } from "../src/misc/idGenerator"
import { IslandUpdates } from "../src"

type PositionWithId = [string, number, number, number]

describe("archipelago", () => {
  let archipelago: Archipelago
  beforeEach(() => {
    archipelago = new Archipelago({ joinDistance: 64, leaveDistance: 80 })
  })

  function setPositions(...positions: PositionWithId[]) {
    archipelago.setPeersPositions(positions.map(([id, ...position]) => ({ id, position })))
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

    archipelago.clearPeers(["4"])

    expectIslandsWith(archipelago, ["1", "2"], ["3"])
  })

  it("can add a peer again after it has been cleared", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16])

    expectIslandsWith(archipelago, ["1", "2"])

    archipelago.clearPeers(["1"])
    archipelago.clearPeers(["2"])

    setPositions(["1", 0, 0, 0])

    expectIslandsWith(archipelago, ["1"])
  })

  it("recalculates islands when options are modified", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16])
    expectIslandWith(archipelago, "1", "2")

    archipelago.modifyOptions({ joinDistance: 4, leaveDistance: 5 })

    expectIslandWith(archipelago, "1")
    expectIslandWith(archipelago, "2")
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
    let updates = archipelago.setPeersPositions([{ id: "0", position: [15, 0, 0] }])

    expectChangedTo(updates, "0", "I1")
    updates = archipelago.setPeersPositions([{ id: "1", position: [0, 0, 0] }])
    expectChangedTo(updates, "1", "I1")
    expectNoUpdate(updates, "0")

    updates = archipelago.setPeersPositions([{ id: "2", position: [100, 0, 0] }])

    expectChangedTo(updates, "2", "I3")
    expectNoUpdate(updates, "1")
    expectNoUpdate(updates, "0")

    updates = archipelago.setPeersPositions([{ id: "3", position: [50, 0, 0] }])

    expectChangedTo(updates, "2", "I1")
    expectChangedTo(updates, "3", "I1")
    expectNoUpdate(updates, "1")
    expectNoUpdate(updates, "0")
  })

  it("provides updates when clearing peer", () => {
    setPositions(["1", 0, 0, 0], ["2", 50, 0, 0], ["3", 100, 0, 0])

    expectIslandsWith(archipelago, ["1", "2", "3"])

    const updates = archipelago.clearPeers(["2"])

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

  it("enforces max peers per island limit", () => {
    const idGenerator = sequentialIdGenerator("P")
    const firstRequests = setMultiplePeersAround(archipelago, [0, 0, 0], 190, idGenerator)

    expect.strictEqual(archipelago.getIslandsCount(), 1)
    expectIslandWith(archipelago, ...firstRequests.map((it) => it.id))

    const peerRequests = setMultiplePeersAround(archipelago, [100, 0, 0], 20, idGenerator)

    expect.strictEqual(archipelago.getIslandsCount(), 2)
    expectIslandWith(archipelago, ...peerRequests.map((it) => it.id))

    setPositions(
      ...peerRequests.map((it) => [it.id, it.position[0] - 100, it.position[1], it.position[2]] as PositionWithId)
    )

    expect.strictEqual(archipelago.getIslandsCount(), 2)
    expectIslandWith(archipelago, ...firstRequests.map((it) => it.id))
    expectIslandWith(archipelago, ...peerRequests.map((it) => it.id))

    archipelago.clearPeers(peerRequests.slice(0, 10).map((it) => it.id))

    expect.strictEqual(archipelago.getIslandsCount(), 1)
    expectIslandWith(archipelago, ...firstRequests.map((it) => it.id), ...peerRequests.slice(10, 20).map((it) => it.id))
  })

  it("merges with the biggest island available", () => {
    const idGenerator = sequentialIdGenerator("P")
    const superBigIsland = setMultiplePeersAround(archipelago, [0, 0, 0], 190, idGenerator)
    const bigIsland = setMultiplePeersAround(archipelago, [100, 0, 0], 150, idGenerator)
    const smallIsland = setMultiplePeersAround(archipelago, [200, 0, 0], 100, idGenerator)

    setPositions(
      ...bigIsland.map((it) => [it.id, it.position[0] - 100, it.position[1], it.position[2]] as PositionWithId)
    )

    setPositions(
      ...smallIsland.map((it) => [it.id, it.position[0] - 200, it.position[1], it.position[2]] as PositionWithId)
    )

    expect.strictEqual(archipelago.getIslandsCount(), 3)

    setPositions(["newPeer", 0, 0, 0])
    expect.strictEqual(archipelago.getIslandsCount(), 3)

    expectIslandWith(archipelago, "newPeer", ...superBigIsland.map((it) => it.id))

    const smallestIsland = setMultiplePeersAround(archipelago, [100, 0, 0], 20, idGenerator)

    setPositions(
      ...smallestIsland.map((it) => [it.id, it.position[0] - 100, it.position[1], it.position[2]] as PositionWithId)
    )

    expectIslandWith(archipelago, ...smallestIsland.map((it) => it.id), ...bigIsland.map((it) => it.id))
  })
})
