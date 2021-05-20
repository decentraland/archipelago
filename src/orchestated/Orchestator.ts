import { Worker } from "worker_threads"
import { IdGenerator, sequentialIdGenerator } from "../idGenerator"
import { ArchipelagoParameters, Island, IslandUpdates, PeerPositionChange, Position3D } from "../interfaces"
import { WorkerMessage, WorkerResponse, WorkerRequest, WorkerStatus } from "./messageTypes"

type SetPositionUpdate = { type: "set-position"; position: Position3D }
type ClearUpdate = { type: "clear" }

type PeerUpdate = SetPositionUpdate | ClearUpdate

export type UpdateSubscriber = (updates: IslandUpdates) => any

class Orchestator {
  pendingUpdates: Map<string, PeerUpdate> = new Map()

  updatesSubscribers: UpdateSubscriber[] = []

  activePeers: Set<string> = new Set()

  worker: Worker
  workerStatus: WorkerStatus = "unknown"

  activeWorkerRequests: Record<string, (a: any) => any> = {}

  requestIdGenerator: IdGenerator = sequentialIdGenerator("R")

  constructor(parameters: ArchipelagoParameters & { flushFrequency?: number }) {
    const flushFrequency = parameters.flushFrequency ?? 1

    this.worker = new Worker("./dist/orchestated/worker.js", { workerData: { archipelagoParameters: parameters } })

    this.worker.on("message", this.handleWorkerMessage.bind(this))

    this.startFlushLoop(flushFrequency)
  }

  startFlushLoop(flushFrequency: number) {
    const loop = () => {
      this.flush()
      setTimeout(loop, flushFrequency * 1000)
    }

    loop()
  }

  flush() {
    if (this.pendingUpdates.size > 0 && this.workerStatus === "idle") {
      console.log(`Flushing ${this.pendingUpdates.size} updates`)
      const updatesToFlush = this.pendingUpdates
      this.pendingUpdates = new Map()

      const positionUpdates: PeerPositionChange[] = []
      const clearUpdates: string[] = []

      for (const [id, update] of updatesToFlush) {
        if (update.type === "set-position") {
          positionUpdates.push({ id, position: update.position })
        } else {
          clearUpdates.push(id)
        }
      }

      this.sendMessageToWorker({ type: "apply-updates", updates: { positionUpdates, clearUpdates } })
    }
  }

  sendMessageToWorker(message: WorkerMessage) {
    this.worker.postMessage(message)
  }

  sendRequestToWorker<T>(message: Omit<WorkerRequest, "requestId">) {
    const requestId = this.requestIdGenerator.generateId()

    return new Promise<T>((resolve, reject) => {
      this.activeWorkerRequests[requestId] = resolve

      this.sendMessageToWorker({ ...message, requestId })
    })
  }

  handleWorkerMessage(message: WorkerMessage) {
    switch (message.type) {
      case "islands-updated": {
        for (const subscriber of this.updatesSubscribers) {
          subscriber(message.islandUpdates)
        }
        break
      }
      case "islands-count-response":
      case "islands-response": {
        const { requestId, payload } = message
        this.activeWorkerRequests[requestId]?.(payload)
        delete this.activeWorkerRequests[requestId]
        break
      }
      case "worker-status": {
        this.workerStatus = message.status
        break
      }
    }
  }

  setPeerPosition(request: PeerPositionChange) {
    this.pendingUpdates.set(request.id, { type: "set-position", position: request.position })
    this.activePeers.add(request.id)
  }

  clearPeer(id: string) {
    this.pendingUpdates.set(id, { type: "clear" })
    this.activePeers.delete(id)
  }

  getPeersCount() {
    return this.activePeers.size
  }

  async getIslandsCount(): Promise<number> {
    return this.sendRequestToWorker({ type: "get-islands-count" })
  }

  async getIslands(): Promise<Island[]> {
    return this.sendRequestToWorker({ type: "get-islands" })
  }
}

export function orchestatedArchipelago(options: ArchipelagoParameters & { flushFrequency?: number }): Orchestator {
  return new Orchestator(options)
}
