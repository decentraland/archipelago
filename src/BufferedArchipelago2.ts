import {
  Archipelago,
  ArchipelagoOptions,
  ArchipelagoParameters,
  Island,
  IslandUpdates,
  PeerPositionChange,
  Position3D,
} from "./interfaces"
import { PaperArchipelago } from "./paper/PaperArchipelago"

type SetPositionUpdate = { type: "set-position"; pos: { x: number, y: number }, velocity: { x: number, y: number }, time: number }
type ClearUpdate = { type: "clear" }

type PeerUpdate = SetPositionUpdate | ClearUpdate

export type UpdateSubscriber = (updates: IslandUpdates) => any

class BufferedArchipelago implements Archipelago {
  innerArchipelago: PaperArchipelago

  pendingUpdates: Map<string, PeerUpdate> = new Map()

  lastPosition: Map<string, { pos: Position3D, time: number }> = new Map()

  updatesSubscribers: UpdateSubscriber[] = []

  activePeers: Set<string> = new Set()

  constructor(options: ArchipelagoParameters & { flushFrequency?: number }) {
    const flushFrequency = options.flushFrequency ?? 5
    this.innerArchipelago = new PaperArchipelago()

    this.startFlushLoop(flushFrequency)
  }

  emitUpdates(updates: IslandUpdates) {
    for (const subscriber of this.updatesSubscribers) {
      subscriber(updates)
    }
  }

  startFlushLoop(flushFrequency: number) {
    const loop = () => {
      this.flush()
      setTimeout(loop, flushFrequency * 1000)
    }

    loop()
  }

  getOptions(): ArchipelagoOptions {
    throw new Error('Not implemented')
  }

  setPeersPositions(requests: PeerPositionChange[]): IslandUpdates {
    const now = Date.now()
    for (const request of requests) {
      const lastPosition = this.lastPosition.get(request.id)
      const velocity = lastPosition ? { x: request.position[0] - lastPosition.pos[0] / (now - lastPosition.time), y: (request.position[2] - lastPosition.pos[2]) / (now - lastPosition.time) } : { x: 0, y: 0 }
      this.pendingUpdates.set(request.id, { type: "set-position", pos: { x: request.position[0], y: request.position[2] }, velocity, time: now })
      this.activePeers.add(request.id)
      this.lastPosition.set(request.id, { pos: request.position, time: now })
    }

    return {}
  }

  flush() {
    console.log("Starting flush...")
    console.time("Flush Completed")
    if (this.pendingUpdates.size > 0) {
      console.log(`Flushing ${this.pendingUpdates.size} updates`)
      const updatesToFlush = this.pendingUpdates
      this.pendingUpdates = new Map()

      const positionUpdates: {
        id: string,
        pos: { x: number, y: number },
        velocity: { x: number, y: number },
        time: number}[] = []
      const clearUpdates: string[] = []

      for (const [id, update] of updatesToFlush) {
        if (update.type === "set-position") {
          positionUpdates.push({ id, ...update })
        } else {
          clearUpdates.push(id)
        }
      }

      this.innerArchipelago.update(positionUpdates, clearUpdates, Date.now())
    }

    console.timeEnd("Flush Completed")
  }

  getIslands(): Island[] {
    return this.innerArchipelago.getIslands()
  }

  getIsland(id: string): Island | undefined {
    throw new Error('Not implemented')
  }

  clearPeers(ids: string[]): IslandUpdates {
    for (const id of ids) {
      this.pendingUpdates.set(id, { type: "clear" })
      this.activePeers.delete(id)
    }
    return {}
  }

  getPeersCount(): number {
    return this.activePeers.size
  }

  getIslandsCount(): number {
    return this.innerArchipelago.getIslandsCount()
  }

  subscribeToUpdates(subscriber: (updates: IslandUpdates) => any) {
    this.updatesSubscribers.push(subscriber)
  }
}

export function bufferedArchipelago2(options: ArchipelagoParameters & { flushFrequency?: number }): BufferedArchipelago {
  return new BufferedArchipelago(options)
}
