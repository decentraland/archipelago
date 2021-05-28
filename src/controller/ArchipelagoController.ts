import {
  ArchipelagoController,
  ArchipelagoControllerOptions,
  ArchipelagoParameters,
  Island,
  Logger,
  PeerData,
  PeerPositionChange,
  Position3D,
  UpdateSubscriber,
} from "../types/interfaces"

import { fork, ChildProcess } from "child_process"
import { GetIsland, WorkerMessage, WorkerRequest, WorkerResponse, WorkerStatus } from "../types/messageTypes"
import { IdGenerator, sequentialIdGenerator } from "../misc/idGenerator"

type SetPositionUpdate = { type: "set-position"; position: Position3D }
type ClearUpdate = { type: "clear" }

type PeerUpdate = SetPositionUpdate | ClearUpdate

type WorkerControllerOptions = { requestTimeoutMs: number; workerLogging?: boolean }

type PendingWorkerRequest = { resolve: (arg: any) => any; reject: (error: any) => any }

export type WorkerOptions = { archipelagoParameters: ArchipelagoParameters; logging: boolean }
class WorkerController {
  worker: ChildProcess
  workerStatus: WorkerStatus = "unknown"

  activeWorkerRequests: Record<string, PendingWorkerRequest> = {}

  messageHandler: (m: WorkerMessage) => boolean

  requestIdGenerator: IdGenerator = sequentialIdGenerator("")

  options: WorkerControllerOptions

  constructor(
    messageHandler: (m: WorkerMessage) => any,
    parameters: ArchipelagoParameters,
    options: Partial<WorkerControllerOptions> = {}
  ) {
    this.worker = fork("./dist/worker/worker.js", [
      JSON.stringify({ archipelagoParameters: parameters, logging: options.workerLogging ?? true }),
    ])

    this.worker.on("message", this.handleWorkerMessage.bind(this))

    this.messageHandler = messageHandler

    this.options = { requestTimeoutMs: 10 * 1000, ...options }
  }

  handleWorkerMessage(message: WorkerMessage) {
    this.messageHandler(message)

    if (message.type === "worker-status") {
      this.workerStatus = message.status
    } else if (message.type === "worker-request-error") {
      const { requestId, error } = message
      this.activeWorkerRequests[requestId]?.reject(error)
      delete this.activeWorkerRequests[requestId]
    } else if ("requestId" in message) {
      const { requestId, payload } = message as WorkerResponse
      this.activeWorkerRequests[requestId]?.resolve(payload)
      delete this.activeWorkerRequests[requestId]
    }
  }

  sendMessageToWorker(message: WorkerMessage) {
    this.worker.send(message)
  }

  sendRequestToWorker<T>(message: Omit<WorkerRequest, "requestId">) {
    const requestId = this.requestIdGenerator.generateId()

    return new Promise<T>((resolve, reject) => {
      this.activeWorkerRequests[requestId] = { resolve, reject }

      this.sendMessageToWorker({ ...message, requestId } as WorkerMessage)

      setTimeout(() => {
        if (this.activeWorkerRequests[requestId]) {
          delete this.activeWorkerRequests[requestId]
          reject(new Error("Request timed out"))
        }
      }, this.options.requestTimeoutMs)
    })
  }

  async dispose() {
    await this.sendRequestToWorker({ type: "dispose-request" })
    this.worker.kill()
  }
}

export class ArchipelagoControllerImpl implements ArchipelagoController {
  pendingUpdates: Map<string, PeerUpdate> = new Map()

  updatesSubscribers: Set<UpdateSubscriber> = new Set()

  activePeers: Map<string, PeerData> = new Map()
  flushFrequency: number
  logger: Logger

  workerController: WorkerController

  disposed: boolean = false

  constructor(options: ArchipelagoControllerOptions) {
    this.flushFrequency = options.flushFrequency ?? 2
    this.logger = options.logger ?? console
    this.workerController = new WorkerController(this.handleWorkerMessage.bind(this), options.archipelagoParameters)

    this.startFlushLoop()
  }

  startFlushLoop() {
    const loop = () => {
      if (!this.disposed) {
        this.flush()
        setTimeout(loop, this.flushFrequency * 1000)
      }
    }

    loop()
  }

  async flush() {
    if (this.pendingUpdates.size > 0 && this.workerController.workerStatus === "idle") {
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

      this.workerController.sendMessageToWorker({ type: "apply-updates", updates: { positionUpdates, clearUpdates } })
    }
  }

  setPeersPositions(...requests: PeerPositionChange[]): void {
    for (const req of requests) {
      if (!this.activePeers.has(req.id)) {
        this.activePeers.set(req.id, { id: req.id, position: req.position })
      }

      this.pendingUpdates.set(req.id, { type: "set-position", position: req.position })
    }
  }

  getIslands(): Promise<Island[]> {
    return this.workerController.sendRequestToWorker({ type: "get-islands" })
  }

  getIsland(id: string): Promise<Island | undefined> {
    const req: Omit<GetIsland, "requestId"> = { type: "get-island", islandId: id }

    return this.workerController.sendRequestToWorker(req)
  }

  clearPeers(...ids: string[]): void {
    for (const id of ids) {
      this.pendingUpdates.set(id, { type: "clear" })
      this.activePeers.delete(id)
    }
  }

  async getPeersCount(): Promise<number> {
    return this.activePeers.size
  }

  getIslandsCount(): Promise<number> {
    return this.workerController.sendRequestToWorker({ type: "get-islands-count" })
  }

  subscribeToUpdates(subscriber: UpdateSubscriber): void {
    this.updatesSubscribers.add(subscriber)
  }

  unsubscribeFromUpdates(subscriber: UpdateSubscriber): void {
    this.updatesSubscribers.delete(subscriber)
  }

  handleWorkerMessage(message: WorkerMessage) {
    switch (message.type) {
      case "islands-updated": {
        for (const subscriber of this.updatesSubscribers) {
          subscriber(message.islandUpdates)
        }
      }
    }
  }

  async dispose() {
    this.disposed = true
    await this.workerController.dispose()
  }
}

export function defaultArchipelagoController(options: ArchipelagoControllerOptions): ArchipelagoController {
  return new ArchipelagoControllerImpl(options)
}
