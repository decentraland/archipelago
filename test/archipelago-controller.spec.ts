import { ArchipelagoController, defaultArchipelagoController, IslandUpdates } from "../src"
import { expectIslandsInControllerWith, untilTrue } from "./lib"
import expect from "assert"

describe("archipelago controller", () => {
  let controller: ArchipelagoController
  let receivedUpdates: IslandUpdates[]

  beforeEach(() => {
    controller = defaultArchipelagoController({
      archipelagoParameters: { joinDistance: 64, leaveDistance: 80 },
      flushFrequency: 0.05,
    })

    controller.subscribeToUpdates((updates) => receivedUpdates.push(updates))

    receivedUpdates = []
  })

  afterEach(async () => {
    await controller.dispose()
  })

  async function receivedUpdatesForPeers(...ids: string[]) {
    await untilTrue(
      () => ids.every((id) => receivedUpdates.some((update) => id in update)),
      `Peers ${ids.join(", ")} should have received updates and they didn't. Received updates: ${JSON.stringify(
        receivedUpdates
      )}`
    )
  }

  function getLatestUpdateFor(peerId: string) {
    for (let i = receivedUpdates.length - 1; i >= 0; i--) {
      const update = receivedUpdates[i][peerId]
      if (update) {
        return update
      }
    }

    return undefined
  }

  it("should forward positions and receive updates", async () => {
    controller.setPeersPositions(
      { id: "1", position: [0, 0, 0] },
      { id: "2", position: [4, 0, 4] },
      { id: "3", position: [90, 0, 90] }
    )

    await controller.flush()

    await receivedUpdatesForPeers("1", "2", "3")

    expect.strictEqual(await controller.getIslandsCount(), 2)
    expect.strictEqual(await controller.getPeersCount(), 3)

    const update1 = getLatestUpdateFor("1")
    const update2 = getLatestUpdateFor("2")
    const update3 = getLatestUpdateFor("3")

    expect.strictEqual(update1!.islandId, update2!.islandId)
    expect.notStrictEqual(update1!.islandId, update3!.islandId)

    await expectIslandsInControllerWith(controller, ["1", "2"], ["3"])
  })

  it("should allow to clear peers", async () => {
    controller.setPeersPositions({ id: "1", position: [0, 0, 0] }, { id: "2", position: [4, 0, 4] })

    await controller.flush()

    await receivedUpdatesForPeers("1", "2")

    await expectIslandsInControllerWith(controller, ["1", "2"])

    receivedUpdates = []

    controller.clearPeers("1")

    await controller.flush()

    await receivedUpdatesForPeers("1")
    const update = getLatestUpdateFor("1")

    expect.strictEqual(update!.action, "leave")
  })

  it("should eventually flush automatically", async () => {
    controller.setPeersPositions(
      { id: "1", position: [0, 0, 0] },
      { id: "2", position: [4, 0, 4] },
      { id: "3", position: [90, 0, 90] }
    )

    await receivedUpdatesForPeers("1", "2", "3")

    await expectIslandsInControllerWith(controller, ["1", "2"], ["3"])
  })

  it("should allow to query specific islands", async () => {
    controller.setPeersPositions(
      { id: "1", position: [0, 0, 0] },
      { id: "2", position: [4, 0, 4] },
      { id: "3", position: [90, 0, 90] }
    )

    await receivedUpdatesForPeers("1", "2", "3")

    const update = getLatestUpdateFor("1")

    const island = await controller.getIsland(update!.islandId)

    expect.deepStrictEqual(island!.peers.map((it) => it.id).sort(), ["1", "2"])
  })

  it("should allow to query specific peers", async () => {

    controller.setPeersPositions(
      { id: "1", position: [0, 0, 0] },
      { id: "2", position: [4, 0, 4] },
      { id: "99", position: [984, 0, 984] }
    )

    await receivedUpdatesForPeers("1", "2", "99")

    const update = getLatestUpdateFor("99")

    const peerData = await controller.getPeerData("99")

    expect.strictEqual(peerData!.islandId, update!.islandId)

    const peersData = await controller.getPeersData(["1", "2"])

    expect.strictEqual(peersData["1"].islandId, peersData["2"].islandId)
    expect.strictEqual(peersData["1"].islandId, getLatestUpdateFor("1")!.islandId)
    expect.strictEqual(peersData["2"].islandId, getLatestUpdateFor("2")!.islandId)
  })
})
