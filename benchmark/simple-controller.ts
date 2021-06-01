import {
  ArchipelagoController,
  Island,
  IslandUpdates,
  PeerPositionChange,
  UpdateSubscriber,
} from "../src"
import { IArchipelago } from "../src/domain/interfaces"

/**
 * This class is a mono-thread unbuffered version of the default controller. Useful to test & benchmark an archipelago implementation in isolation
 */
export class SimpleArchipelagoController implements ArchipelagoController {
  archipelago: IArchipelago
  updatesSubscribers: Set<UpdateSubscriber>

  constructor(archipelago: IArchipelago) {
    this.archipelago = archipelago
    this.updatesSubscribers = new Set()
  }

  setPeersPositions(...requests: PeerPositionChange[]): void {
    this.archipelago.setPeersPositions(requests)
  }

  async getIslands(): Promise<Island[]> {
    return this.archipelago.getIslands()
  }

  async getIsland(id: string): Promise<Island | undefined> {
    return this.archipelago.getIsland(id)
  }

  clearPeers(...ids: string[]): void {
    this.notifyUpdates(this.archipelago.clearPeers(ids))
  }

  notifyUpdates(updates: IslandUpdates) {
    for (const subscriber of this.updatesSubscribers) {
      subscriber(updates)
    }
  }

  async getPeersCount(): Promise<number> {
    return this.archipelago.getPeersCount()
  }

  async getIslandsCount(): Promise<number> {
    return this.archipelago.getIslandsCount()
  }

  subscribeToUpdates(subscriber: UpdateSubscriber): void {
    this.updatesSubscribers.add(subscriber)
  }

  unsubscribeFromUpdates(subscriber: UpdateSubscriber): void {
    this.updatesSubscribers.delete(subscriber)
  }

  async dispose() {

  }

  async flush() {
    
  }
}
