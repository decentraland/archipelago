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

See [src/interfaces.ts](src/interfaces.ts)

## Commands

### Running specs with mocha

#### Run all the tests

`make test`

#### Run a sigle test

`TESTARGS="--grep 'test name'" make test`

#### Debugging tests

`TESTARGS="--inspect-brk" make test`

Then you can connect the debugger either through VsCode, or through chrome://inspect in Chromium based browsers

### build

`make build`, run it before pushing, otherwise the CI may fail if the API changed.

### run test app

There is a test app that runs Archipelago in the browser and draws the result. You can also write tests using Clojure that can be run line by line in an interpreter.

`make start`, then manually open `http://0.0.0.0:3000`
