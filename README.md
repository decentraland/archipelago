# Decentraland's Archipelago Library

## What is it?

Decentraland uses P2P connections for communication between players. In order to be able to take better advantage of the available resources, there is a need to be able to group peers in clusters so they can communicate more efficiently and without compromising user experience.

Archipelago organizes peers in "islands" according to their positions in world, so that information can be used to organize the P2P network. It supports near real time position changes, and produces outputs that can be easily transfered to each peer so they can change their connections.

## Usage

You can create an Archipelago using the default implementation

```typescript
import { defaultArchipelago } from "@dcl/archipelago"

const archipelago = defaultArchipelago({ joinDistance: 64, leaveDistance: 80 })
```

You can then set peer positions and obtain the island changes on each peer:

```typescript
const changes = archipelago.setPeersPositions(
  { id: SOME_PEER_ID, position: SOME_PEER_POSITION },
  { id: OTHER_PEER_ID, position: OTHER_PEER_POSITION }
)

console.log(changes) // {"SOME_PEER_ID": {"action": "changeTo", "islandId": "SOME_ISLAND_ID"}, "OTHER_PEER_ID": {"action": "changeTo", "islandId": "SOME_ISLAND_ID"}}
```

You can also clear some peers from the archipelago:

```typescript
archipelago.clearPeers(SOME_PEER_ID, OTHER_PEER_ID)
```

## Interfaces

See [src/types/interfaces.ts](src/types/interfaces.ts)

## Commands

### Running specs with mocha

#### Run all the tests

`make test`

#### Run a sigle test

`TESTARGS="--grep 'test name'" make test`

#### Debugging tests

`TESTARGS="--inspect-brk" make test`

Then you can connect the debugger either through VsCode, or through chrome://inspect in Chromium based browsers

### Benchmark

There is a simple benchmark that can be run to assess the performance of the algorithm. It can be found in [benchmark/simple.ts](benchmark/simple.ts)

To run it:

```sh
npx ts-node benchmark/simple.ts
```

It has multiple parameters that can be configured through environment variables:

* `MAX_PEERS_PER_ISLAND`: Default 200. The maximum amount of people that can be in the same island.
* `SEED`: The seed used for RNG. If not provided, one is generated.
* `TARGET_PEERS`: Default 5000. The amount of peers the benchmark will try to reach by exclusively adding peers until that amount has been reached.
* `DISCONNECT_CHANCE`: Default 0.01. The chance a peer will disconnect during an operation.
* `HOTSPOT_CHANCE`: Default 0.95. The chance a peer will select a position near a hotspot
* `TELEPORT_CHANCE`: Default 0.01. The chance an existing peer will teleport instead of moving close to its position.
* `MIN_POSITION`: Default [-2400, 0, -2400]. The "minimum" position that can be generated.
* `MAX_POSITION`: Default [2400, 0, 2400]. The "maximum" position that can be generated. Positions are generated using random values between min and max for each component.
* `DURATION`: Default 120. Number of seconds to run the benchmark
* `HOTSPOTS`: Default 100. Number of hotspots that will be generated for this run.
* `DEBUG`: Default false. Show additional information when logging. When set to true, it can affect the performance significantly.

Example setting multiple parameters:

```sh
DEBUG=true HOTSPOTS=20 SEED=0.8277166950419682 DURATION=60 npx ts-node benchmark/simple.ts
```

### Build

`make build`, run it before pushing, otherwise the CI may fail if the API changed.

### Run test app

There is a test app that runs Archipelago in the browser and draws the result. You can also write tests using Clojure that can be run line by line in an interpreter.

`make start`, then manually open `http://0.0.0.0:3000`
