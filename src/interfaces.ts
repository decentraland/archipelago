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
}

export interface Archipelago {
  setPeerPosition(id: string, position: Position3D): void
  getIslands(): Island[]
  getIsland(id: string): Island | undefined
  clearPeer(id: string): boolean
}

export type ArchipelagoOptions = {
  maxPeersPerIsland: number
  joinDistance: number
  leaveDistance: number
  distanceFunction: (a: Position3D, b: Position3D) => number
  islandIdGenerator: IdGenerator
}
