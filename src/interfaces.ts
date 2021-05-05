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
  sequenceId: number
}

export interface Archipelago {
  getOptions(): ArchipelagoOptions
  setPeerPosition(id: string, position: Position3D): IslandUpdates
  getIslands(): Island[]
  getIsland(id: string): Island | undefined
  clearPeer(id: string): [boolean, IslandUpdates]
}

export type IslandUpdates = Record<string, string>

export type ArchipelagoOptions = {
  maxPeersPerIsland: number
  joinDistance: number
  leaveDistance: number
  distanceFunction: (a: Position3D, b: Position3D) => number
  islandIdGenerator: IdGenerator
}
