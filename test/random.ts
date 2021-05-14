import { Position3D } from "../src"

export function createRandomizer(generator: () => number = Math.random) {
  const randomizer = {
    randomBetween(min: number, max: number): number {
      return generator() * (max - min) + min
    },

    randomBoolean(trueChance: number): boolean {
      return generator() <= trueChance
    },

    randomArrayIndex<T>(array: T[]) {
      return Math.floor(generator() * array.length)
    },

    generatePosition(minPosition: Position3D, maxPosition: Position3D): Position3D {
      return [
        randomizer.randomBetween(minPosition[0], maxPosition[0]),
        randomizer.randomBetween(minPosition[1], maxPosition[1]),
        randomizer.randomBetween(minPosition[2], maxPosition[2]),
      ]
    },

    generatePositionAround(aPosition: Position3D, maxOffset: Position3D): Position3D {
      return [
        randomizer.randomBetween(aPosition[0] - maxOffset[0], aPosition[0] + maxOffset[0]),
        randomizer.randomBetween(aPosition[1] - maxOffset[1], aPosition[1] + maxOffset[1]),
        randomizer.randomBetween(aPosition[2] - maxOffset[2], aPosition[2] + maxOffset[2]),
      ]
    },
  }

  return randomizer
}
