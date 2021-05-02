import { IToken } from "ebnf"

export function walkPreOrder<T extends { children: any[] } = IToken>(
  cbEnter?: (node: T, parent: T | null) => boolean | void,
  cbLeave?: (node: T, parent: T | null) => void
) {
  const leFn = function (node: T, parent: T | null = null) {
    return walk(node, cbEnter, cbLeave, parent)
  }

  return leFn
}

export function walk<T extends { children: any[] } = IToken>(
  node: T,
  cbEnter?: (node: T, parent: T | null) => boolean | void,
  cbLeave?: (node: T, parent: T | null) => void,
  parent: T | null = null
) {
  if (node) {
    let traverseIn = true
    if (cbEnter) {
      if (false === cbEnter.call(null, node, parent)) {
        traverseIn = false
      }
    }

    if (traverseIn) {
      const children = node.children

      if (children) {
        for (let i = 0; i < children.length; i++) {
          if (children[i]) {
            walk(children[i], cbEnter, cbLeave, node)
          }
        }
      }

      if (cbLeave) {
        cbLeave.call(null, node, parent)
      }
    }
  }
}
