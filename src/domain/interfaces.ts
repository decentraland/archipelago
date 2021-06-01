import { Island, IslandUpdates, PeerPositionChange } from ".."

export interface IArchipelago {
  getIslandsCount(): number
  getPeersCount(): number
  clearPeers(ids: string[]): IslandUpdates
  getIsland(id: string): Island | undefined
  getIslands(): Island[]
  setPeersPositions(requests: PeerPositionChange[]): IslandUpdates
}
