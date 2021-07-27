import { PeerPositionChange } from ".."
import { Island, IslandUpdates, PeerData, UpdatableArchipelagoParameters } from "./interfaces"

export type ApplyUpdates = {
  type: "apply-updates"
  updates: { positionUpdates: PeerPositionChange[]; clearUpdates: string[] }
}

export type ApplyOptionsUpdate = {
  type: "apply-options-update"
  updates: UpdatableArchipelagoParameters
}

type Request = { requestId: string }

export type GetIslands = {
  type: "get-islands"
} & Request

export type GetIsland = {
  type: "get-island"
  islandId: string
} & Request

export type GetIslandsCount = {
  type: "get-islands-count"
} & Request

export type IslandsUpdated = {
  type: "islands-updated"
  islandUpdates: IslandUpdates
}

type Response = {
  requestId: string
  payload: any
}

export type IslandsCountResponse = {
  type: "islands-count-response"
  payload: number
} & Response

export type IslandsResponse = {
  type: "islands-response"
  payload: Island[]
} & Response

export type IslandResponse = {
  type: "island-response"
  payload: Island | undefined
} & Response

export type WorkerStatusMessage = {
  type: "worker-status"
  status: "working" | "idle"
}

export type WorkerRequestError = {
  type: "worker-request-error"
  requestId: string
  error: any
}

export type DisposeRequest = {
  type: "dispose-request"
} & Request

export type DisposeResponse = {
  type: "dispose-response"
  requestId: string
} & Response

export type GetPeerData = {
  type: "get-peer-data"
  peerId: string
} & Request

export type GetPeerDataResponse = {
  type: "get-peer-data-response"
  payload: PeerData | undefined
} & Response

export type GetPeersData = {
  type: "get-peers-data"
  peerIds: string[]
} & Request

export type GetPeersDataResponse = {
  type: "get-peers-data-response"
  payload: Record<string, PeerData>
} & Response

export type GetPeerIds = {
  type: "get-peer-ids"
} & Request

export type GetPeerIdsResponse = {
  type: "get-peer-ids-response"
  payload: string[]
} & Response

export type WorkerStatus = "working" | "idle" | "unknown"

export type WorkerMessage =
  | ApplyUpdates
  | ApplyOptionsUpdate
  | WorkerResponse
  | WorkerRequest
  | IslandsUpdated
  | WorkerStatusMessage
  | WorkerRequestError
  | GetPeerData
  | GetPeersData
  | GetPeerIds

export type WorkerResponse = IslandsCountResponse | IslandsResponse | DisposeResponse | GetPeerDataResponse | GetPeersDataResponse | GetPeerIdsResponse
export type WorkerRequest = GetIslands | GetIslandsCount | GetIsland | DisposeRequest | GetPeerData | GetPeersData | GetPeerIds
