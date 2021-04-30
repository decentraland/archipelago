import { defaultArchipelago, Archipelago } from "../src"

import expect from "expect"

type PositionWithId = [string, number, number, number]

function arraysEqual(a: any[], b: any[]) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }

  return true
}

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

  function expectIslandWith(...ids: string[]) {
    const sortedIds = ids.sort()
    expect(archipelago.getIslands().some((it) => arraysEqual(it.peers.map((peer) => peer.id).sort(), sortedIds))).toBe(
      true
    )
  }

  it("joins two close peers in island", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16])

    expect(archipelago.getIslands().length).toEqual(1)
    expectIslandWith("1", "2")
  })

  it("avoids joining a peer that is far away", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 200, 0, 200])

    const islands = archipelago.getIslands()

    expect(islands.length).toEqual(2)
    expectIslandWith("1", "2")
    expectIslandWith("3")
  })

  it("joins two existing islands when a peer 'bridges' them", () => {
    setPositions(["1", 0, 0, 0], ["2", 16, 0, 16], ["3", 100, 0, 0])

    expect(archipelago.getIslands().length).toEqual(2)
    expectIslandWith("1", "2")
    expectIslandWith("3")

    setPositions(["4", 50, 0, 0])

    console.log(JSON.stringify(archipelago.getIslands()))

    expect(archipelago.getIslands().length).toEqual(1)

    expectIslandWith("1", "2", "3", "4")
  })
})
