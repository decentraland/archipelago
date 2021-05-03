import { IRule, Grammars, Parser, IToken } from "ebnf"
import { grammar } from "./grammar"
import { walk } from "./walker"

const RULES: IRule[] = Grammars.Custom.getRules(grammar)

export const internalParser = new Parser(RULES, {})

export type ParseResult = {
  document: IToken
  syntaxErrors: IToken[]
}

export function parse(code: string): ParseResult {
  const syntaxErrors: IToken[] = []
  const document = internalParser.getAST(code, RULES[0].name)
  walk(document, (node) => {
    // discard nodes
    node.children = node.children.filter(($) => $.type != "Discard" && $.type != "Comment")

    if (node.type == "SyntaxError" || node.type == "RestSyntaxError") {
      node.type = "SyntaxError"
      syntaxErrors.push(node)
      // do not go deeper
      return false
    }
  })
  return { document, syntaxErrors }
}
