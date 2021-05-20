import { defaultArchipelago } from "./Archipelago"
import {
  Archipelago,
  ArchipelagoOptions,
  ArchipelagoParameters,
  Island,
  IslandUpdates,
  PeerPositionChange,
  Position3D,
} from "./interfaces"

type SetPositionUpdate = { type: "set-position"; position: Position3D }
type ClearUpdate = { type: "clear" }

type PeerUpdate = SetPositionUpdate | ClearUpdate

export type UpdateSubscriber = (updates: IslandUpdates) => any

class BufferedArchipelago implements Archipelago {
  innerArchipelago: Archipelago

  pendingUpdates: Map<string, PeerUpdate> = new Map()

  updatesSubscribers: UpdateSubscriber[] = []

  activePeers: Set<string> = new Set()

  constructor(options: ArchipelagoParameters & { flushFrequency?: number }) {
    const flushFrequency = options.flushFrequency ?? 2
    this.innerArchipelago = defaultArchipelago(options)

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
    return this.innerArchipelago.getOptions()
  }

  setPeersPositions(requests: PeerPositionChange[]): IslandUpdates {
    for (const request of requests) {
      this.pendingUpdates.set(request.id, { type: "set-position", position: request.position })
      this.activePeers.add(request.id)
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

      const positionUpdates: PeerPositionChange[] = []
      const clearUpdates: string[] = []

      for (const [id, update] of updatesToFlush) {
        if (update.type === "set-position") {
          positionUpdates.push({ id, position: update.position })
        } else {
          clearUpdates.push(id)
        }
      }

      this.emitUpdates(this.innerArchipelago.setPeersPositions(positionUpdates))
      this.emitUpdates(this.innerArchipelago.clearPeers(clearUpdates))
    }

    console.timeEnd("Flush Completed")
  }

  getIslands(): Island[] {
    return this.innerArchipelago.getIslands()
  }

  getIsland(id: string): Island | undefined {
    return this.innerArchipelago.getIsland(id)
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

export function bufferedArchipelago(options: ArchipelagoParameters & { flushFrequency?: number }): BufferedArchipelago {
  return new BufferedArchipelago(options)
}
