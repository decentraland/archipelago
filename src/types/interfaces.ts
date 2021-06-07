import { IdGenerator } from "../misc/idGenerator"

export type Position3D = [number, number, number]

export type PeerData = {
  id: string
  position: Position3D
  islandId?: string
}

export type Island = {
  id: string
  peers: PeerData[]
  maxPeers: number
  center: Position3D
  radius: number
  sequenceId: number
}

export type PeerPositionChange = { id: string; position: Position3D }

export type UpdateSubscriber = (updates: IslandUpdates) => any

export interface ArchipelagoController {
  setPeersPositions(...requests: PeerPositionChange[]): void
  getIslands(): Promise<Island[]>
  getIsland(id: string): Promise<Island | undefined>
  clearPeers(...ids: string[]): void
  getPeersCount(): Promise<number>
  getIslandsCount(): Promise<number>
  subscribeToUpdates(subscriber: UpdateSubscriber): void
  unsubscribeFromUpdates(subscriber: UpdateSubscriber): void
  getPeerData(id: string): Promise<PeerData | undefined>
  getPeersData(ids: string[]): Promise<Record<string, PeerData>>
  dispose(): Promise<void>
  flush(): Promise<void>
  modifyOptions(options: UpdatableArchipelagoParameters): void
}

export type IslandUpdate = {
  action: "leave" | "changeTo"
  islandId: string
}

export type IslandUpdates = Record<string, IslandUpdate>

export type ArchipelagoOptions = {
  maxPeersPerIsland: number
  joinDistance: number
  leaveDistance: number
  islandIdGenerator: IdGenerator
}

export type MandatoryArchipelagoOptions = Pick<ArchipelagoOptions, "joinDistance" | "leaveDistance">

export type ArchipelagoParameters = MandatoryArchipelagoOptions & Partial<ArchipelagoOptions>

export type UpdatableArchipelagoParameters = Partial<Omit<ArchipelagoOptions, 'islandIdGenerator'>>

export type Logger = {
  info(message?: any, ...optionalParams: any[]): void
  log(message?: any, ...optionalParams: any[]): void
  error(message?: any, ...optionalParams: any[]): void
  warn(message?: any, ...optionalParams: any[]): void
  debug(message?: any, ...optionalParams: any[]): void
  trace(message?: any, ...optionalParams: any[]): void
}

export type ArchipelagoControllerOptions = {
  flushFrequency?: number
  archipelagoParameters: ArchipelagoParameters
  logger?: Logger
  workerSrcPath?: string
}

export { IdGenerator } from "../misc/idGenerator"
