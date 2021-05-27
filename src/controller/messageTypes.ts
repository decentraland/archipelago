import { PeerPositionChange } from ".."
import { Island, IslandUpdates } from "../interfaces"

export type ApplyUpdates = {
  type: "apply-updates"
  updates: { positionUpdates: PeerPositionChange[]; clearUpdates: string[] }
}

export type GetIslands = {
  type: "get-islands"
}

export type GetIsland = {
  type: "get-island"
  islandId: string
}

export type GetIslandsCount = {
  type: "get-islands-count"
}

export type IslandsUpdated = {
  type: "islands-updated"
  islandUpdates: IslandUpdates
}

export type IslandsCountResponse = {
  type: "islands-count-response"
  payload: number
}

export type IslandsResponse = {
  type: "islands-response"
  payload: Island[]
}

export type WorkerStatusMessage = {
  type: "worker-status"
  status: "working" | "idle"
}

export type WorkerRequestError = {
  type: "worker-request-error"
  requestId: string
  error: any
}

export type WorkerStatus = "working" | "idle" | "unknown"

export type WorkerMessage =
  | ApplyUpdates
  | WorkerResponse
  | WorkerRequest
  | IslandsUpdated
  | WorkerStatusMessage
  | WorkerRequestError

export type WorkerResponse = (IslandsCountResponse | IslandsResponse) & { requestId: string; payload: any }
export type WorkerRequest = (GetIslands | GetIslandsCount | GetIsland) & { requestId: string }
