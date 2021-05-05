import { sequentialIdGenerator } from "./idGenerator"
import { Island, Archipelago, Position3D, PeerData, ArchipelagoOptions, IslandUpdates } from "./interfaces"
import { popFirstByOrder, popMax } from "./utils"

type MandatoryArchipelagoOptions = Pick<ArchipelagoOptions, "joinDistance" | "leaveDistance">

const X_AXIS = 0
const Y_AXIS = 1
const Z_AXIS = 2

function defaultOptions() {
  return {
    maxPeersPerIsland: 200,
    distanceFunction: (p1: Position3D, p2: Position3D) => {
      // By default, we use XZ plane squared distance. We ignore "height"
      const xDiff = p2[X_AXIS] - p1[X_AXIS]
      const zDiff = p2[Z_AXIS] - p1[Z_AXIS]

      return xDiff * xDiff + zDiff * zDiff
    },
    islandIdGenerator: sequentialIdGenerator("I"),
  }
}

class ArchipelagoImpl implements Archipelago {
  private peers: Map<string, PeerData> = new Map()
  private islands: Map<string, Island> = new Map()

  private options: ArchipelagoOptions

  private currentSequence: number = 0

  private generateId(): string {
    return this.options.islandIdGenerator.generateId()
  }

  constructor(options: MandatoryArchipelagoOptions & Partial<ArchipelagoOptions>) {
    this.options = { ...defaultOptions(), ...options }
  }

  getOptions() {
    return this.options
  }

  /**
   * This returns a map containing the peers that changed island as keys, and to which island they went as values
   * */
  setPeerPosition(id: string, position: Position3D): IslandUpdates {
    let updates: IslandUpdates = {}
    if (!this.peers.has(id)) {
      this.peers.set(id, { id, position })
      updates = this.createIsland([this.peers.get(id)!])
    } else {
      this.peers.get(id)!.position = position
    }
    return { ...updates, ...this.updateIslands() }
  }

  clearPeer(id: string): [boolean, IslandUpdates] {
    const peer = this.peers.get(id)
    if (peer) {
      this.peers.delete(id)
      if (peer.islandId) {
        this.clearPeerFromIsland(id, this.islands.get(peer.islandId)!)
      }

      return [true, this.updateIslands()]
    }
    return [false, {}]
  }

  clearPeerFromIsland(id: string, island: Island) {
    const idx = island.peers.findIndex((it) => it.id === id)
    if (idx >= 0) {
      island.peers.splice(idx, 1)
    }

    if (island.peers.length === 0) {
      this.islands.delete(island.id)
    }
  }

  updateIslands(): IslandUpdates {
    return { ...this.checkSplitIslands(), ...this.checkMergeIslands() }
  }

  checkSplitIslands(): IslandUpdates {
    let updates: IslandUpdates = {}
    for (const island of this.islands.values()) {
      updates = { ...updates, ...this.checkSplitIsland(island) }
    }

    return updates
  }

  checkMergeIslands(): IslandUpdates {
    const processedIslands: Map<string, Island> = new Map()

    let updates: IslandUpdates = {}

    for (const island of this.islands.values()) {
      const islandsIntersected = [...processedIslands.values()].filter((it) =>
        this.intersectIslands(island, it, this.options.joinDistance)
      )

      if (islandsIntersected.length > 0) {
        const [merged, mergeUpdates] = this.mergeIslands(island, ...islandsIntersected)
        updates = { ...updates, ...mergeUpdates }
        islandsIntersected.forEach((it) => processedIslands.delete(it.id))
        processedIslands.set(merged.id, merged)
      } else {
        processedIslands.set(island.id, island)
      }
    }

    return updates
  }

  checkSplitIsland(island: Island): IslandUpdates {
    const peerGroups: PeerData[][] = []

    for (const peer of island.peers) {
      const groupsIntersected = peerGroups.filter((it) => this.intersectPeerGroup(peer, it, this.options.leaveDistance))
      if (groupsIntersected.length === 0) {
        peerGroups.push([peer])
      } else {
        // We merge all the groups into one
        const [finalGroup, ...rest] = groupsIntersected
        finalGroup.push(peer)

        for (const group of rest) {
          // We remove each group
          peerGroups.splice(peerGroups.indexOf(group), 1)

          //We add the members of each group to the final group
          finalGroup.push(...group)
        }
      }
    }

    if (peerGroups.length <= 1) {
      return {}
    } else {
      const biggestGroup = popMax(peerGroups, (group) => group.length)!
      island.peers = biggestGroup
      return peerGroups.reduce((updates, group) => ({ ...updates, ...this.createIsland(group) }), {})
    }
  }

  mergeIslands(...islands: Island[]): [Island, IslandUpdates] {
    let updates: IslandUpdates = {}

    const biggest = popFirstByOrder(islands, (i1, i2) =>
      i1.peers.length === i2.peers.length
        ? Math.sign(i1.sequenceId - i2.sequenceId)
        : Math.sign(i2.peers.length - i1.peers.length)
    )! // We should never call mergeIslands with an empty list

    while (islands.length > 0) {
      const anIsland = islands.shift()!

      updates = { ...updates, ...this.addPeersToIsland(biggest, anIsland.peers) }

      this.islands.delete(anIsland.id)
    }

    return [biggest, updates]
  }

  intersectIslands(anIsland: Island, otherIsland: Island, intersectDistance: number) {
    return anIsland.peers.some((it) => this.intersectPeerGroup(it, otherIsland.peers, intersectDistance))
  }

  intersectPeerGroup(peer: PeerData, group: PeerData[], intersectDistance: number) {
    return group.some((it) => this.intersectPeers(peer, it, intersectDistance))
  }

  intersectPeers(aPeer: PeerData, otherPeer: PeerData, intersectDistance: number) {
    return this.options.distanceFunction(aPeer.position, otherPeer.position) <= intersectDistance
  }

  addPeersToIsland(island: Island, peers: PeerData[]): IslandUpdates {
    island.peers.push(...peers)
    return this.setPeersIsland(island.id, peers)
  }

  createIsland(group: PeerData[]): IslandUpdates {
    const newIslandId = this.generateId()

    const island = {
      id: newIslandId,
      peers: group,
      maxPeers: this.options.maxPeersPerIsland,
      sequenceId: ++this.currentSequence,
    }

    this.islands.set(newIslandId, island)

    return this.setPeersIsland(newIslandId, group)
  }

  private setPeersIsland(islandId: string, peers: PeerData[]): IslandUpdates {
    let updates: IslandUpdates = {}

    for (const peer of peers) {
      peer.islandId = islandId
      updates[peer.id] = islandId
    }

    return updates
  }

  getIslands(): Island[] {
    return [...this.islands.values()]
  }

  getIsland(id: string): Island | undefined {
    return this.islands.get(id)
  }
}

export function defaultArchipelago(options: MandatoryArchipelagoOptions & Partial<ArchipelagoOptions>): Archipelago {
  return new ArchipelagoImpl(options)
}
