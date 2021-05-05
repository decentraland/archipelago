/**
 * Finds the index of the element that is first according to the provided ordering
 * @param array the array in which to look up the index
 * @param ordering a function returning -1 if the element on the left goes first, 0 if they are the equivalent, and 1 if right goes first
 * @returns
 */
export function findIndexOfFirstByOrder<T>(array: T[], ordering: (t1: T, t2: T) => number) {
  if (array.length === 0) return undefined

  let biggestIndex = 0

  for (let i = 1; i < array.length; i++) {
    if (ordering(array[i], array[biggestIndex]) < 0) {
      biggestIndex = i
    }
  }

  return biggestIndex
}

export function findMaxIndex<T>(array: T[], criteria: (t: T) => number) {
  return findIndexOfFirstByOrder(array, (t1, t2) => Math.sign(criteria(t2) - criteria(t1)))
}

export function findMax<T>(array: T[], criteria: (t: T) => number) {
  const index = findMaxIndex(array, criteria)
  return typeof index !== "undefined" ? array[index] : undefined
}

export function popIndex<T>(array: T[], index: number | undefined) {
  if (typeof index !== "undefined") {
    const [max] = array.splice(index, 1)
    return max
  } else {
    return undefined
  }
}

/**
 * Removes the "max" element by criteria and returns it. Mutates the array.
 */
export function popMax<T>(array: T[], criteria: (t: T) => number) {
  return popIndex(array, findMaxIndex(array, criteria))
}

/**
 * Removes the "first" element by the provided ordering and returns it. Mutates the array.
 */
export function popFirstByOrder<T>(array: T[], ordering: (t1: T, t2: T) => number) {
  return popIndex(array, findIndexOfFirstByOrder(array, ordering))
}
