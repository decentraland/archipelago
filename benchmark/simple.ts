import { defaultArchipelago, PeerData, Position3D } from "../src"
import seedrandom from "seedrandom"
import { sequentialIdGenerator } from "../src/idGenerator"

const archipelago = defaultArchipelago({ joinDistance: 64, leaveDistance: 80 })

const SEED = process.env.SEED ? process.env.SEED : `${seedrandom()()}`

console.log("Using seed " + SEED)

const TARGET_PEERS = parseInt(process.env.TARGET_PEERS ?? "5000")
const DISCONNECT_CHANCE = parseFloat(process.env.DISCONNECT_CHANCE ?? "0.01")
const HOTSPOT_CHANCE = parseFloat(process.env.HOTSPOT_CHANCE ?? "0.95")
const TELEPORT_CHANCE = parseFloat(process.env.TELEPORT_CHANCE ?? "0.01")
const MIN_POSITION = [-2400, 0, -2400]
const MAX_POSITION = [2400, 0, 2400]
const DURATION = parseFloat(process.env.DURATION ?? "120")
const HOTSPOTS = parseInt(process.env.HOTSPOTS ?? "100")

const activePeers: { id: string; position: Position3D }[] = []
const peerIdGenerator = sequentialIdGenerator("Peer")

const prng = seedrandom(SEED)

function randomBetween(min: number, max: number): number {
  return prng() * (max - min) + min
}

function randomBoolean(trueChance: number): boolean {
  return prng() <= trueChance
}

function randomArrayIndex<T>(array: T[]) {
  return Math.floor(prng() * array.length)
}

function generatePosition(): Position3D {
  return [
    randomBetween(MIN_POSITION[0], MAX_POSITION[0]),
    randomBetween(MIN_POSITION[1], MAX_POSITION[1]),
    randomBetween(MIN_POSITION[2], MAX_POSITION[2]),
  ]
}

function* generateHotspots() {
  for (let i = 0; i < HOTSPOTS; i++) {
    yield generatePosition()
  }
}

const hotSpots = [...generateHotspots()]

function generatePositionAround(aPosition: Position3D, maxOffset: Position3D): Position3D {
  return [
    randomBetween(aPosition[0] - maxOffset[0], aPosition[0] + maxOffset[0]),
    randomBetween(aPosition[1] - maxOffset[1], aPosition[1] + maxOffset[1]),
    randomBetween(aPosition[2] - maxOffset[2], aPosition[2] + maxOffset[2]),
  ]
}

function generateRandomHotspotPositon(): Position3D {
  const hotspotIndex = randomArrayIndex(hotSpots)

  return generatePositionAround(hotSpots[hotspotIndex], [64, 0, 64])
}

function generateNewPeerPosition(): Position3D {
  return randomBoolean(HOTSPOT_CHANCE) ? generateRandomHotspotPositon() : generatePosition()
}

function addPeer() {
  const randomPosition = generateNewPeerPosition()
  const id = peerIdGenerator.generateId()

  const request = { id, position: randomPosition }

  archipelago.setPeersPositions(request)
  activePeers.push(request)
}

function disconnectRandomPeer() {
  const index = randomArrayIndex(activePeers)

  const activePeer = activePeers[index]
  activePeers[index] = activePeers.pop()! // we remove the last element because is fast, and store it in the current index

  archipelago.clearPeers(activePeer.id)
}

function changeRandomPeerPosition() {
  const index = randomArrayIndex(activePeers)
  const newPosition = randomBoolean(TELEPORT_CHANCE)
    ? generateNewPeerPosition()
    : generatePositionAround(activePeers[index].position, [5, 0, 5])
  archipelago.setPeersPositions({ id: activePeers[index].id, position: newPosition })
}

function loop() {
  if (archipelago.getPeersCount() < TARGET_PEERS) {
    addPeer()
  } else {
    if (randomBoolean(DISCONNECT_CHANCE)) {
      disconnectRandomPeer()
    } else {
      changeRandomPeerPosition()
    }
  }
}

const startTime = Date.now()
let timeToLog = 1000

console.log(`Starting test at ${startTime}`)

let operations = 0

let elapsed = 0
let currentCycleOperations = 0
let currentCycleStartTime = Date.now()

while ((elapsed = Date.now() - startTime) < DURATION * 1000) {
  loop()
  operations++
  currentCycleOperations++

  if (elapsed > timeToLog) {
    console.log(
      `
Performed ${operations} ops. ${((operations * 1000) / elapsed).toFixed(2)} avg ops/s
Last second: ${currentCycleOperations} ops. ${(
        (currentCycleOperations * 1000) /
        (Date.now() - currentCycleStartTime)
      ).toFixed(2)} avg ops/s
Number of peers: ${archipelago.getPeersCount()}
Number of islands: ${archipelago.getIslandsCount()}
Elapsed: ${elapsed / 1000}s. Remaining: ${DURATION - elapsed / 1000}s
      `
    )
    timeToLog += 1000
    currentCycleStartTime = Date.now()
    currentCycleOperations = 0
  }
}

console.log(`Test finished at ${Date.now()}. Total operations: ${operations}`)
