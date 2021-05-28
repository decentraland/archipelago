import { WorkerOptions } from "../controller/ArchipelagoController"
import { Archipelago } from "../domain/Archipelago"
import { NullLogger } from "../misc/utils"
import { IslandUpdates, Logger, PeerPositionChange } from "../types/interfaces"
import {
  IslandResponse,
  IslandsCountResponse,
  IslandsResponse,
  WorkerMessage,
  WorkerStatusMessage,
} from "../types/messageTypes"

const options: WorkerOptions = JSON.parse(process.argv[2])

const archipelago = new Archipelago(options.archipelagoParameters)

const logger: Logger = options.logging ? console : NullLogger

let status: "idle" | "working" = "idle"

process.on("message", (message: WorkerMessage) => {
  switch (message.type) {
    case "apply-updates":
      applyUpdates(message.updates)
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
  }
})

function emitUpdates(updates: IslandUpdates) {
  process.send!({ updates })
}

function applyUpdates({
  positionUpdates,
  clearUpdates,
}: {
  positionUpdates: PeerPositionChange[]
  clearUpdates: string[]
}) {
  setStatus("working")
  const startTime = Date.now()

  logger.debug(`Processing ${positionUpdates.length} position updates and ${clearUpdates.length} clear updates`)
  emitUpdates(archipelago.clearPeers(clearUpdates))
  emitUpdates(archipelago.setPeersPositions(positionUpdates))

  logger.debug(`Processing updates took: ${Date.now() - startTime}`)

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
