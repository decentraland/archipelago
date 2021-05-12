import { IdGenerator } from "./idGenerator"

export type Position3D = [number, number, number]

export type PeerData = {
  id: string
  position: Position3D
  islandId?: string
}

export type Island = {
  id: string
  peers: PeerData[]
  maxPeers: number
  center: Position3D
  radius: number
  sequenceId: number
}

export type PeerPositionChange = { id: string; position: Position3D }

export interface Archipelago {
  getOptions(): ArchipelagoOptions
  setPeersPositions(...requests: PeerPositionChange[]): IslandUpdates
  getIslands(): Island[]
  getIsland(id: string): Island | undefined
  clearPeers(...ids: string[]): IslandUpdates
  getPeersCount() : number
}

export type IslandUpdate = {
  action: 'leave' | 'changeTo'
  islandId: string
}

export type IslandUpdates = Record<string, IslandUpdate>

export type ArchipelagoOptions = {
  maxPeersPerIsland: number
  joinDistance: number
  leaveDistance: number
  distanceFunction: (a: Position3D, b: Position3D) => number
  islandIdGenerator: IdGenerator
}
