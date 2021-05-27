import { defaultArchipelago } from "../domain/Archipelago"
import { IslandUpdates, PeerPositionChange } from "../interfaces"
import { IslandsCountResponse, IslandsResponse, WorkerMessage, WorkerStatusMessage } from "./messageTypes"

console.log("Received parameter " + JSON.stringify(process.argv))

const archipelago = defaultArchipelago(JSON.parse(process.argv[2]).archipelagoParameters)

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

  console.log(`Processing ${positionUpdates.length} position updates and ${clearUpdates.length} clear updates`)
  emitUpdates(archipelago.clearPeers(clearUpdates))
  emitUpdates(archipelago.setPeersPositions(positionUpdates))

  console.log(`Processing updates took: ${Date.now() - startTime}`)

  setStatus("idle")
}

function setStatus(aStatus: "idle" | "working") {
  status = aStatus
  sendStatus()
}

function sendStatus() {
  const message: WorkerStatusMessage = { type: "worker-status", status }
  process.send!(message)
}

setStatus("idle")
