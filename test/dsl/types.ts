import { IToken } from "ebnf";

export class NodeError extends Error {
  constructor(message: string, public node: IToken) {
    super(message)
  }
}