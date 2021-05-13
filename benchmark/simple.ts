import { defaultArchipelago, PeerData, Position3D } from "../src"
import seedrandom from "seedrandom"
import { sequentialIdGenerator } from "../src/idGenerator"

const archipelago = defaultArchipelago({ joinDistance: 64 * 64, leaveDistance: 80 * 80 })

const SEED = process.env.SEED ? process.env.SEED : `${seedrandom()()}`

console.log("Using seed " + SEED)

const TARGET_PEERS = parseInt(process.env.TARGET_PEERS ?? "5000")
const DISCONNECT_CHANCE = parseFloat(process.env.DISCONNECT_CHANCE ?? "0.01")
const MIN_POSITION = [-2400, 0, -2400]
const MAX_POSITION = [2400, 0, 2400]
const DURATION = parseFloat(process.env.DURATION ?? "120")

const activePeers: string[] = []
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

function addPeer() {
  const randomPosition = generatePosition()
  const id = peerIdGenerator.generateId()

  archipelago.setPeersPositions({ id, position: randomPosition })
  activePeers.push(id)
}

function disconnectRandomPeer() {
  const index = randomArrayIndex(activePeers)

  const peerId = activePeers[index]
  activePeers[index] = activePeers.pop()! // we remove the last element because is fast, and store it in the current index

  archipelago.clearPeers(peerId)
}

function changeRandomPeerPosition() {
  const index = randomArrayIndex(activePeers)

  archipelago.setPeersPositions({ id: activePeers[index], position: generatePosition() })
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
