export interface IdGenerator {
  generateId(): string
}

export function sequentialIdGenerator(prefix: string): IdGenerator {
  let currentId = 0

  return {
    generateId: () => {
      currentId++
      return prefix + currentId
    },
  }
}
