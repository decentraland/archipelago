export function findMaxIndex<T>(array: T[], criteria: (t: T) => number) {
  if (array.length === 0) return undefined

  let biggestIndex = 0

  for (let i = 1; i < array.length; i++) {
    if (criteria(array[i]) > criteria(array[biggestIndex])) {
      biggestIndex = i
    }
  }

  return biggestIndex
}

export function findMax<T>(array: T[], criteria: (t: T) => number) {
  const index = findMaxIndex(array, criteria)
  return typeof index !== "undefined" ? array[index] : undefined
}

/**
 * Removes the "max" element by criteria and returns it. Mutates the array.
 */
export function popMax<T>(array: T[], criteria: (t: T) => number) {
  const index = findMaxIndex(array, criteria)

  if (typeof index !== "undefined") {
    const [max] = array.splice(index, 1)
    return max
  } else {
    return undefined
  }
}
