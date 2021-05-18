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

export type MandatoryArchipelagoOptions = Pick<ArchipelagoOptions, "joinDistance" | "leaveDistance">

const X_AXIS = 0
const Y_AXIS = 1
const Z_AXIS = 2

const squaredDistance = (p1: Position3D, p2: Position3D) => {
  // By default, we use XZ plane squared distance. We ignore "height"
  const xDiff = p2[X_AXIS] - p1[X_AXIS]
  const zDiff = p2[Z_AXIS] - p1[Z_AXIS]

  return xDiff * xDiff + zDiff * zDiff
}

export function defaultOptions() {
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
  setPeersPositions(changes: PeerPositionChange[]): IslandUpdates {
    let updates: IslandUpdates = {}
    const affectedIslands: Set<string> = new Set()
    for (const { id, position } of changes) {
      if (!this.peers.has(id)) {
        this.peers.set(id, { id, position })
        this.createIsland([this.peers.get(id)!], updates, affectedIslands)
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

  clearPeers(ids: string[]): IslandUpdates {
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

  updateIslands(updates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    updates = this.checkSplitIslands(updates, affectedIslands)
    return this.checkMergeIslands(updates, affectedIslands)
  }

  checkSplitIslands(updates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    for (const islandId of affectedIslands) {
      this.checkSplitIsland(this.getIsland(islandId)!, updates, affectedIslands)
    }

    return updates
  }

  checkMergeIslands(updates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
    const processedIslands: Record<string, boolean> = {}

    for (const islandId of affectedIslands) {
      if (!processedIslands[islandId] && this.islands.has(islandId)) {
        const island = this.getIsland(islandId)!
        const islandsIntersected: InternalIsland[] = []
        for (const [, otherIsland] of this.islands) {
          if (islandId !== otherIsland.id && this.intersectIslands(island, otherIsland, this.options.joinDistance)) {
            islandsIntersected.push(otherIsland)
            processedIslands[islandId] = true
          }
        }
        if (islandsIntersected.length > 0) {
          updates = this.mergeIslands(updates, island, ...islandsIntersected)
        }
      }
    }

    return updates
  }

  checkSplitIsland(island: InternalIsland, updates: IslandUpdates, affectedIslands: Set<string>) {
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

    if (peerGroups.length > 1) {
      const biggestGroup = popMax(peerGroups, (group) => group.length)!
      island.peers = biggestGroup
      this.markGeometryDirty(island)

      for (const group of peerGroups) {
        this.createIsland(group, updates, affectedIslands)
      }
    }
  }

  mergeIslands(updates: IslandUpdates, ...islands: InternalIsland[]): IslandUpdates {
    if (islands.length < 1) return updates

    const sortedIslands = islands.sort((i1, i2) =>
      i1.peers.length === i2.peers.length
        ? Math.sign(i1.sequenceId - i2.sequenceId)
        : Math.sign(i2.peers.length - i1.peers.length)
    )

    const biggestIslands: InternalIsland[] = [sortedIslands.shift()!]

    let anIsland: InternalIsland | undefined

    while ((anIsland = sortedIslands.shift())) {
      let merged = false

      for (let i = 0; i < biggestIslands.length; i++) {
        if (biggestIslands[i].peers.length + anIsland.peers.length <= biggestIslands[i].maxPeers) {
          updates = this.addPeersToIsland(biggestIslands[i], anIsland.peers, updates)

          this.islands.delete(anIsland.id)

          this.markGeometryDirty(biggestIslands[i])

          merged = true
          break
        }
      }

      if (!merged) {
        biggestIslands.push(anIsland)
      }
    }

    return updates
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

  addPeersToIsland(island: InternalIsland, peers: PeerData[], updates: IslandUpdates): IslandUpdates {
    island.peers.push(...peers)
    this.markGeometryDirty(island)
    return this.setPeersIsland(island.id, peers, updates)
  }

  markGeometryDirty(island: InternalIsland) {
    island._geometryDirty = true
  }

  createIsland(group: PeerData[], updates: IslandUpdates, affectedIslands: Set<string>): IslandUpdates {
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
    affectedIslands.add(newIslandId)

    return this.setPeersIsland(newIslandId, group, updates)
  }

  private setPeersIsland(islandId: string, peers: PeerData[], updates: IslandUpdates): IslandUpdates {
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
