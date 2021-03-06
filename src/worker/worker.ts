import { WorkerOptions } from "../controller/ArchipelagoController"
import { Archipelago } from "../domain/Archipelago"
import { IArchipelago } from "../domain/interfaces"
import { NullLogger } from "../misc/utils"
import { IslandUpdates, Logger, PeerData } from "../types/interfaces"
import {
  DisposeResponse,
  GetPeerDataResponse,
  GetPeerIdsResponse,
  GetPeersDataResponse,
  IslandResponse,
  IslandsCountResponse,
  IslandsResponse,
  IslandsUpdated,
  WorkerMessage,
  WorkerStatusMessage,
} from "../types/messageTypes"

const options: WorkerOptions = JSON.parse(process.argv[2])

console.log(`Starting worker with parameters ${JSON.stringify(process.argv)}`)

const archipelago: IArchipelago = new Archipelago(options.archipelagoParameters)

const logger: Logger = options.logging ? console : NullLogger

let status: "idle" | "working" = "idle"

process.on("message", (message: WorkerMessage) => {
  switch (message.type) {
    case "apply-updates":
      const { clearUpdates, positionUpdates } = message.updates
      performArchipelagoOperation(
        (archipelago) => ({
          ...archipelago.clearPeers(clearUpdates),
          ...archipelago.setPeersPositions(positionUpdates),
        }),
        "updates"
      )
      break
    case "apply-options-update":
      performArchipelagoOperation((archipelago) => archipelago.modifyOptions(message.updates), "options update")
      break
    case "get-islands": {
      const response: IslandsResponse = {
        type: "islands-response",
        payload: archipelago.getIslands(),
        requestId: message.requestId,
      }
      process.send!(response)
      break
    }
    case "get-islands-count": {
      const response: IslandsCountResponse = {
        type: "islands-count-response",
        payload: archipelago.getIslandsCount(),
        requestId: message.requestId,
      }
      process.send!(response)
      break
    }
    case "get-island": {
      const response: IslandResponse = {
        type: "island-response",
        payload: archipelago.getIsland(message.islandId),
        requestId: message.requestId,
      }

      process.send!(response)
      break
    }
    case "get-peer-data": {
      const response: GetPeerDataResponse = {
        type: "get-peer-data-response",
        payload: archipelago.getPeerData(message.peerId),
        requestId: message.requestId,
      }

      process.send!(response)
      break
    }
    case "get-peers-data": {
      const response: GetPeersDataResponse = {
        type: "get-peers-data-response",
        payload: getPeersData(message.peerIds),
        requestId: message.requestId,
      }

      process.send!(response)
      break
    }
    case "dispose-request": {
      const response: DisposeResponse = {
        type: "dispose-response",
        requestId: message.requestId,
        payload: null,
      }
      process.send!(response)
      break
    }
    case "get-peer-ids": {
      const response: GetPeerIdsResponse = {
        type: "get-peer-ids-response",
        requestId: message.requestId,
        payload: archipelago.getPeerIds()
      }
      process.send!(response)
      break
    }
  }
})

function getPeersData(peerIds: string[]): Record<string, PeerData> {
  const response: Record<string, PeerData> = {}
  for (const id of peerIds) {
    const data = archipelago.getPeerData(id)
    if (typeof data !== "undefined") {
      response[id] = data
    }
  }

  return response
}

function emitUpdates(updates: IslandUpdates) {
  const updatesMessage: IslandsUpdated = {
    type: "islands-updated",
    islandUpdates: updates,
  }
  process.send!(updatesMessage)
}

function performArchipelagoOperation(operation: (archipelago: IArchipelago) => IslandUpdates, description: string) {
  setStatus("working")
  const startTime = Date.now()

  logger.debug(`Processing ${description}`)

  const updates = operation(archipelago)
  emitUpdates(updates)

  logger.debug(`Processing ${description} took: ${Date.now() - startTime}`)

  setStatus("idle")
}

function setStatus(aStatus: "idle" | "working") {
  logger.info(`Setting worker status to ${aStatus}`)
  status = aStatus
  sendStatus()
}

function sendStatus() {
  const message: WorkerStatusMessage = { type: "worker-status", status }
  process.send?.(message)
}

logger.info("Worker started")
setStatus("idle")
