import { defaultArchipelago, Archipelago } from "../src"

import expect from "expect"

describe("archipelago", () => {
  let archipelago: Archipelago
  before(() => {
    // Distances are squared. We may want to make the interface so we don't have to consider that
    archipelago = defaultArchipelago({ joinDistance: 64 * 64, leaveDistance: 80 * 80 })
  })

  it("joins two close peers in island", () => {
    archipelago.setPeerPosition("1", [0, 0, 0])
    archipelago.setPeerPosition("2", [16, 0, 16])

    const islands = archipelago.getIslands()

    expect(islands.length).toEqual(1)
    expect(islands[0].peers.map((it) => it.id).sort()).toEqual(["1", "2"])
  })
})
