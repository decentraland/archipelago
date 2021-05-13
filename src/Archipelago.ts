import { sequentialIdGenerator } from "./idGenerator"
import {
  Archipelago,
  Position3D,
  PeerData,
  ArchipelagoOptions,
  IslandUpdates,
  PeerPositionChange,
  Island,
} from "./interfaces"
import { findMax, popFirstByOrder, popMax } from "./utils"

type MandatoryArchipelagoOptions = Pick<ArchipelagoOptions, "joinDistance" | "leaveDistance">

const X_AXIS = 0
const Y_AXIS = 1
const Z_AXIS = 2

const squaredDistance = (p1: Position3D, p2: Position3D) => {
  // By default, we use XZ plane squared distance. We ignore "height"
  const xDiff = p2[X_AXIS] - p1[X_AXIS]
  const zDiff = p2[Z_AXIS] - p1[Z_AXIS]

  return xDiff * xDiff + zDiff * zDiff
}

function defaultOptions() {
  return {
    maxPeersPerIsland: 200,
    islandIdGenerator: sequentialIdGenerator("I"),
  }
}

function islandGeometryCalculator(peers: PeerData[]): [Position3D, number] {
  if (peers.length === 0) return [[0, 0, 0], 0]
  const sum = peers.reduce<Position3D>(
    (current, peer) => [current[X_AXIS] + peer.position[X_AXIS], 0, current[Z_AXIS] + peer.position[Z_AXIS]],
    [0, 0, 0]
  )

  const center = sum.map((it) => it / peers.length) as Position3D
  const farthest = findMax(peers, (peer) => squaredDistance(peer.position, center))!

  const radius = Math.sqrt(squaredDistance(farthest.position, center))

  return [center, radius]
}

function squared(n: number) {
  return n * n
}

type InternalIsland = Island & {
  _center?: Position3D
  _radius?: number
  _geometryDirty: boolean
  _recalculateGeometryIfNeeded: () => void
}

class ArchipelagoImpl implements Archipelago {
  private peers: Map<string, PeerData> = new Map()
  private islands: Map<string, InternalIsland> = new Map()

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
   * This returns a map containing the peers that left or changed island as keys, how they changed as values
   * */
  setPeersPositions(...changes: PeerPositionChange[]): IslandUpdates {
    let updates: IslandUpdates = {}
    const affectedIslands: Set<string> = new Set()
    for (const { id, position } of changes) {
      if (!this.peers.has(id)) {
        this.peers.set(id, { id, position })
        updates[id] = this.createIsland([this.peers.get(id)!])[id]
        affectedIslands.add(updates[id].islandId)
      } else {
        const peer = this.peers.get(id)!
        peer.position = position
        if (peer.islandId) {
          const island = this.getIsland(peer.islandId)!
          this.markGeometryDirty(island)
          affectedIslands.add(peer.islandId)
        }
      }
    }

    return this.updateIslands(updates, affectedIslands)
  }

  clearPeers(...ids: string[]): IslandUpdates {
    let updates: IslandUpdates = {}
    const affectedIslands: Set<string> = new Set()
    for (const id of ids) {
      const peer = this.peers.get(id)

      if (peer) {
        this.peers.delete(id)
        if (peer.islandId) {
          this.clearPeerFromIsland(id, this.islands.get(peer.islandId)!)
          updates[peer.id] = { action: "leave", islandId: peer.islandId }
          if (this.islands.has(peer.islandId)) {
            affectedIslands.add(peer.islandId)
          } else {
            affectedIslands.delete(peer.islandId)
          }
        }
      }
    }

    return this.updateIslands(updates, affectedIslands)
  }

  clearPeerFromIsland(id: string, island: InternalIsland) {
    const idx = island.peers.findIndex((it) => it.id === id)
    if (idx >= 0) {
      island.peers.splice(idx, 1)
    }

    if (island.peers.length === 0) {
      this.islands.delete(island.id)
    }

    this.markGeometryDirty(island)
  }

  updateIslands(previousUpdates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    const splitUpdates = this.checkSplitIslands(previousUpdates, affectedIslands)
    return this.checkMergeIslands(splitUpdates, affectedIslands)
  }

  checkSplitIslands(previousUpdates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    let updates: IslandUpdates = previousUpdates
    const processedIslands: Record<string, boolean> = {}
    for (const islandId of [...affectedIslands]) {
      if (!processedIslands[islandId]) {
        const thisSplitUpdates = this.checkSplitIsland(this.getIsland(islandId)!)
        Object.values(thisSplitUpdates).forEach((it) => affectedIslands.add(it.islandId))
        updates = { ...updates, ...thisSplitUpdates }
        processedIslands[islandId] = true
      }
    }

    return updates
  }

  checkMergeIslands(previousUpdates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    const processedIslands: Record<string, boolean> = {}

    let updates: IslandUpdates = previousUpdates

    for (const islandId of affectedIslands) {
      if (!processedIslands[islandId] && this.islands.has(islandId)) {
        const island = this.getIsland(islandId)!
        const islandsIntersected: InternalIsland[] = []
        for (const otherIsland of this.islands.values()) {
          if (islandId !== otherIsland.id && this.intersectIslands(island, otherIsland, this.options.joinDistance)) {
            islandsIntersected.push(otherIsland)
            processedIslands[islandId] = true
          }
        }
        if (islandsIntersected.length > 0) {
          const [, mergeUpdates] = this.mergeIslands(island, ...islandsIntersected)
          updates = { ...updates, ...mergeUpdates }
        }
      }
    }

    return updates
  }

  checkSplitIsland(island: InternalIsland): IslandUpdates {
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
      this.markGeometryDirty(island)
      return peerGroups.reduce((updates, group) => ({ ...updates, ...this.createIsland(group) }), {})
    }
  }

  mergeIslands(...islands: InternalIsland[]): [InternalIsland, IslandUpdates] {
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

    this.markGeometryDirty(biggest)

    return [biggest, updates]
  }

  intersectIslands(anIsland: InternalIsland, otherIsland: InternalIsland, intersectDistance: number) {
    return (
      this.intersectIslandGeometry(anIsland, otherIsland, intersectDistance) &&
      anIsland.peers.some((it) => this.intersectPeerGroup(it, otherIsland.peers, intersectDistance))
    )
  }

  intersectIslandGeometry(anIsland: InternalIsland, otherIsland: InternalIsland, intersectDistance: number) {
    return (
      squaredDistance(anIsland.center, otherIsland.center) <=
      squared(anIsland.radius + otherIsland.radius + intersectDistance)
    )
  }

  intersectPeerGroup(peer: PeerData, group: PeerData[], intersectDistance: number) {
    return group.some((it) => this.intersectPeers(peer, it, intersectDistance))
  }

  intersectPeers(aPeer: PeerData, otherPeer: PeerData, intersectDistance: number) {
    return squaredDistance(aPeer.position, otherPeer.position) <= squared(intersectDistance)
  }

  addPeersToIsland(island: InternalIsland, peers: PeerData[]): IslandUpdates {
    island.peers.push(...peers)
    this.markGeometryDirty(island)
    return this.setPeersIsland(island.id, peers)
  }

  markGeometryDirty(island: InternalIsland) {
    island._geometryDirty = true
  }

  createIsland(group: PeerData[]): IslandUpdates {
    const newIslandId = this.generateId()

    const island: InternalIsland = {
      id: newIslandId,
      peers: group,
      maxPeers: this.options.maxPeersPerIsland,
      sequenceId: ++this.currentSequence,
      _geometryDirty: true,
      _recalculateGeometryIfNeeded() {
        if (this.peers.length > 0 && (this._geometryDirty || !this._radius || !this._center)) {
          const [center, radius] = islandGeometryCalculator(this.peers)
          this._center = center
          this._radius = radius
          this._geometryDirty = false
        }
      },
      get center() {
        this._recalculateGeometryIfNeeded()
        return this._center!
      },
      get radius() {
        this._recalculateGeometryIfNeeded()
        return this._radius!
      },
    }

    this.islands.set(newIslandId, island)

    return this.setPeersIsland(newIslandId, group)
  }

  private setPeersIsland(islandId: string, peers: PeerData[]): IslandUpdates {
    let updates: IslandUpdates = {}

    for (const peer of peers) {
      peer.islandId = islandId
      updates[peer.id] = { action: "changeTo", islandId }
    }

    return updates
  }

  getIslands(): InternalIsland[] {
    return [...this.islands.values()]
  }

  getIsland(id: string): InternalIsland | undefined {
    return this.islands.get(id)
  }

  getPeersCount(): number {
    return this.peers.size
  }

  getIslandsCount(): number {
    return this.islands.size
  }
}

export function defaultArchipelago(options: MandatoryArchipelagoOptions & Partial<ArchipelagoOptions>): Archipelago {
  return new ArchipelagoImpl(options)
}
