import {
  ArchipelagoController,
  ArchipelagoControllerOptions,
  ArchipelagoParameters,
  Island,
  Logger,
  PeerData,
  PeerPositionChange,
  Position3D,
  UpdatableArchipelagoParameters,
  UpdateSubscriber,
} from "../types/interfaces"

import { fork, ChildProcess } from "child_process"
import {
  GetIsland,
  GetPeerData,
  GetPeerIds,
  GetPeersData,
  WorkerMessage,
  WorkerRequest,
  WorkerResponse,
  WorkerStatus,
} from "../types/messageTypes"
import { IdGenerator, sequentialIdGenerator } from "../misc/idGenerator"

type SetPositionUpdate = { type: "set-position" } & PeerPositionChange
type ClearUpdate = { type: "clear" }

type PeerUpdate = SetPositionUpdate | ClearUpdate

type WorkerControllerOptions = { requestTimeoutMs: number; workerLogging?: boolean; workerSrcPath?: string }

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
    const workerSrcPath = options.workerSrcPath ?? __dirname + "/../worker/worker.js"

    this.worker = fork(workerSrcPath, [
      JSON.stringify({ archipelagoParameters: parameters, logging: options.workerLogging ?? true }),
    ])

    this.messageHandler = messageHandler

    this.worker.on("message", this.handleWorkerMessage.bind(this))

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

  activePeers: Set<string> = new Set()
  flushFrequency: number
  logger: Logger

  workerController: WorkerController

  disposed: boolean = false

  constructor(options: ArchipelagoControllerOptions) {
    this.flushFrequency = options.flushFrequency ?? 2
    this.logger = options.logger ?? console
    this.workerController = new WorkerController(this.handleWorkerMessage.bind(this), options.archipelagoParameters, {
      workerSrcPath: options.workerSrcPath,
    })

    this.startFlushLoop()
  }

  private startFlushLoop() {
    const loop = () => {
      if (!this.disposed) {
        const startTime = Date.now()
        this.flush()
        const flushElapsed = Date.now() - startTime
        setTimeout(loop, Math.max(this.flushFrequency * 1000 - flushElapsed), 1) // At least 1 ms between flushes
      }
    }

    loop()
  }

  flush() {
    if (this.pendingUpdates.size > 0 && this.workerController.workerStatus === "idle") {
      this.logger.info(`Flushing ${this.pendingUpdates.size} updates`)
      const updatesToFlush = this.pendingUpdates
      this.pendingUpdates = new Map()

      const positionUpdates: PeerPositionChange[] = []
      const clearUpdates: string[] = []

      for (const [id, update] of updatesToFlush) {
        if (update.type === "set-position") {
          const { type, ...rest } = update
          positionUpdates.push({ ...rest, id })
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
        this.activePeers.add(req.id)
      }

      this.pendingUpdates.set(req.id, { type: "set-position", ...req })
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

  modifyOptions(options: UpdatableArchipelagoParameters) {
    this.workerController.sendMessageToWorker({ type: "apply-options-update", updates: options })
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

  async getPeerData(id: string): Promise<PeerData | undefined> {
    const request: Omit<GetPeerData, "requestId"> = { type: "get-peer-data", peerId: id }
    return this.workerController.sendRequestToWorker(request)
  }

  async getPeersData(ids: string[]): Promise<Record<string, PeerData>> {
    const request: Omit<GetPeersData, "requestId"> = { type: "get-peers-data", peerIds: ids }
    return this.workerController.sendRequestToWorker(request)
  }

  async getPeerIds(): Promise<string[]> {
    const request: Omit<GetPeerIds, "requestId"> = { type: "get-peer-ids" }

    return this.workerController.sendRequestToWorker(request)
  }
}

export function defaultArchipelagoController(options: ArchipelagoControllerOptions): ArchipelagoController {
  return new ArchipelagoControllerImpl(options)
}
