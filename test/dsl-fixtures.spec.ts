import { getClosure, parseTestSuite } from "./runner"
import assert from "assert"
import { getFixtures } from "./fixtures"

describe("File based tests", () => {
  getFixtures().forEach(({ basename, content }) => {
    const suite = parseTestSuite(content)
    const closure = getClosure()
    describe(basename, () => {
      it("the file has no errors", () => {
        assert.strictEqual(suite.errors.length, 0)
      })

      for (let step of suite.steps) {
        it(step.node.text.trim().replace(/\s*\r?\n\r?\s*/gm, " "), async () => {
          await step(closure)
        })
      }
    })
  })
})
