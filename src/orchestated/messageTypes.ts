import { PeerPositionChange } from ".."
import { Island, IslandUpdates } from "../interfaces"

export type ApplyUpdates = {
  type: "apply-updates"
  updates: { positionUpdates: PeerPositionChange[]; clearUpdates: string[] }
}

export type GetIslands = {
  type: "get-islands"
  requestId: string
}

export type GetIslandsCount = {
  type: "get-islands-count"
  requestId: string
}

export type IslandsUpdated = {
  type: "islands-updated"
  islandUpdates: IslandUpdates
}

export type IslandsCountResponse = {
  type: "islands-count-response"
  payload: number
  requestId: string
}

export type IslandsResponse = {
  type: "islands-response"
  payload: Island[]
  requestId: string
}

export type WorkerStatusMessage = {
  type: "worker-status"
  status: "working" | "idle"
}

export type WorkerStatus = "working" | "idle" | "unknown"

export type WorkerMessage = ApplyUpdates | WorkerResponse | WorkerRequest | IslandsUpdated | WorkerStatusMessage

export type WorkerResponse = (IslandsCountResponse | IslandsResponse) & { payload: any }
export type WorkerRequest = GetIslands | GetIslandsCount
