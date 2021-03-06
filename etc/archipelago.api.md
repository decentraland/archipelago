## API Report File for "@dcl/archipelago"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public (undocumented)
export interface ArchipelagoController {
    // (undocumented)
    clearPeers(...ids: string[]): void;
    // (undocumented)
    dispose(): Promise<void>;
    // (undocumented)
    flush(): void;
    // (undocumented)
    getIsland(id: string): Promise<Island | undefined>;
    // (undocumented)
    getIslands(): Promise<Island[]>;
    // (undocumented)
    getIslandsCount(): Promise<number>;
    // (undocumented)
    getPeerData(id: string): Promise<PeerData | undefined>;
    // (undocumented)
    getPeerIds(): Promise<string[]>;
    // (undocumented)
    getPeersCount(): Promise<number>;
    // (undocumented)
    getPeersData(ids: string[]): Promise<Record<string, PeerData>>;
    // (undocumented)
    modifyOptions(options: UpdatableArchipelagoParameters): void;
    // (undocumented)
    setPeersPositions(...requests: PeerPositionChange[]): void;
    // (undocumented)
    subscribeToUpdates(subscriber: UpdateSubscriber): void;
    // (undocumented)
    unsubscribeFromUpdates(subscriber: UpdateSubscriber): void;
}

// @public (undocumented)
export type ArchipelagoControllerOptions = {
    flushFrequency?: number;
    archipelagoParameters: ArchipelagoParameters;
    logger?: Logger;
    workerSrcPath?: string;
};

// @public (undocumented)
export type ArchipelagoOptions = {
    maxPeersPerIsland: number;
    joinDistance: number;
    leaveDistance: number;
    islandIdGenerator: IdGenerator;
};

// @public (undocumented)
export type ArchipelagoParameters = MandatoryArchipelagoOptions & Partial<ArchipelagoOptions>;

// @public (undocumented)
export type ChangeToIslandUpdate = {
    action: "changeTo";
    islandId: string;
    fromIslandId?: string;
};

// @public (undocumented)
export function defaultArchipelagoController(options: ArchipelagoControllerOptions): ArchipelagoController;

// @public (undocumented)
export interface IdGenerator {
    // (undocumented)
    generateId(): string;
}

// @public (undocumented)
export type Island = {
    id: string;
    peers: PeerData[];
    maxPeers: number;
    center: Position3D;
    radius: number;
    sequenceId: number;
};

// @public (undocumented)
export type IslandUpdate = ChangeToIslandUpdate | LeaveIslandUpdate;

// @public (undocumented)
export type IslandUpdates = Record<string, IslandUpdate>;

// @public (undocumented)
export type LeaveIslandUpdate = {
    action: "leave";
    islandId: string;
};

// @public (undocumented)
export type Logger = {
    info(message?: any, ...optionalParams: any[]): void;
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
    trace(message?: any, ...optionalParams: any[]): void;
};

// @public (undocumented)
export type MandatoryArchipelagoOptions = Pick<ArchipelagoOptions, "joinDistance" | "leaveDistance">;

// @public (undocumented)
export type PeerData = {
    id: string;
    position: Position3D;
    preferedIslandId?: string;
    islandId?: string;
};

// @public (undocumented)
export type PeerPositionChange = {
    id: string;
    position: Position3D;
    preferedIslandId?: string;
};

// @public (undocumented)
export type Position3D = [number, number, number];

// @public (undocumented)
export type UpdatableArchipelagoParameters = Partial<Omit<ArchipelagoOptions, 'islandIdGenerator'>>;

// @public (undocumented)
export type UpdateSubscriber = (updates: IslandUpdates) => any;


// (No @packageDocumentation comment for this package)

```
