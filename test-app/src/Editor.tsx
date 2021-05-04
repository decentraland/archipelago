import MonacoEditor, { OnMount, useMonaco, OnChange, Monaco } from "@monaco-editor/react"
import React, { useState, useEffect, useRef } from "react"
import { ErrorBoundary } from "./ErrorBounday"
import { parseTestSuite, DocumentParsingResult, DocumentError, getClosure } from "../../test/runner"
import type * as monacoType from "monaco-editor/esm/vs/editor/editor.api"
import { Closure, LineMapper } from "tiny-clojure"
import { Archipelago, Island } from "../../src"
import * as d3 from "d3"

const size = "50%"

type RemoteFile = {
  basename: string
  content: string
  dirty?: boolean
}

function makeTransparent(color: string, opacity: number = 0.05): string {
  const rgb = d3.rgb(color)
  rgb.opacity = opacity

  return rgb.toString()
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value])

  return debouncedValue
}

const mem = new Map<string, DocumentParsingResult>()
function memoizedParse(str: string): DocumentParsingResult {
  if (!mem.has(str)) {
    mem.set(str, parseTestSuite(str))
  }
  return mem.get(str)!
}

function calculateRenderState(closure: Closure): Archipelago | null {
  const archipelago = closure.get("archipelago") as Archipelago | void

  return archipelago || null
}

export const useD3 = (
  renderChartFn: (sel: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void,
  dependencies: any[]
) => {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (ref.current) {
      renderChartFn(d3.select(ref.current!))
    }
    return () => {}
  }, dependencies)

  return ref
}

export function Editor(props: {}) {
  const monaco = useMonaco()

  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor>()

  const [loadingCopy, setLoadingCopy] = useState<boolean>(false)
  const [loadingSave, setLoadingSave] = useState<boolean>(false)
  const [steps, setSteps] = useState<DocumentParsingResult | null>(null)
  const [, setIsEditorReady] = useState(false)
  const [files, setFiles] = useState<Record<string, RemoteFile> | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined)
  const [syntaxErrorDecorations, setSyntaxErrorDecorations] = useState<monacoType.editor.IModelDeltaDecoration[]>([])
  const [runtimeDecorations, setRuntimeDecorations] = useState<monacoType.editor.IModelDeltaDecoration[]>([])

  const [renderState, setRenderState] = useState<Archipelago | null>(null)
  const [readonly, setReadonly] = useState<boolean>(false)
  const [currentCode, setCurrentCode] = useState<string>("")
  const [runToLine, setRunToLine] = useState<number>(-1)
  const debouncedCode = useDebounce(currentCode, 300)

  const refD3 = useD3(
    (svg) => {
      let islandsData: Array<{ x: number; y: number; island: string }> = []
      let data: Array<{
        peerId: string
        x: number
        y: number
        joinRadius: number
        leaveRadius: number
        island: string
      }> = []

      renderState?.getIslands().forEach((island) => {
        island.peers.forEach((peer) => {
          data.push({
            island: island.id,
            joinRadius: Math.sqrt(renderState.getOptions().joinDistance),
            leaveRadius: Math.sqrt(renderState.getOptions().leaveDistance),
            peerId: peer.id,
            x: peer.position[0],
            y: peer.position[2],
          })
        })

        const centerX = island.peers.slice(1).reduce((a, b) => b.position[0] + a, island.peers[0].position[0])
        const centerY = island.peers.slice(1).reduce((a, b) => b.position[0] + a, island.peers[0].position[0])

        islandsData.push({
          x: centerX / island.peers.length,
          y: centerY / island.peers.length,
          island: island.id,
        })
      })

      // set the dimensions and margins of the graph
      const height = svg.node()!.clientHeight
      const width = svg.node()!.clientWidth
      const margin = { top: 30, right: 30, bottom: 30, left: 30 }

      const x = d3
        .scaleLinear()
        .domain([Math.min(...data.map((d) => d.x - 10)), Math.max(...data.map((d) => d.x + 10))])
        .rangeRound([margin.left, width - margin.right])

      // Add Y axis
      const y = d3
        .scaleLinear()
        .domain([Math.min(...data.map((d) => d.y - 10)), Math.max(...data.map((d) => d.y + 10))])
        .rangeRound([height - margin.bottom, margin.top])

      const maxValue = Math.abs(x.domain()[1] - x.domain()[0])
      const maxScaled = Math.abs(x.range()[1] - x.range()[0])

      console.log("MAX SCALED " + maxScaled)

      const radiusScale = d3.scaleLinear().domain([0, maxValue]).range([0, maxScaled])

      svg
        .select<SVGGElement>(".x-axis")
        .call((g) =>
          g
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(20).tickSizeOuter(0))
        )

      svg.select<SVGGElement>(".y-axis").call((g) =>
        g
          .attr("transform", `translate(${margin.left},0)`)
          .style("color", "steelblue")
          .call(d3.axisLeft(y).ticks(null, "s"))
          .call((g) => g.select(".domain").remove())
          .call((g) =>
            g
              .append("text")
              .attr("x", -margin.left)
              .attr("y", 10)
              .attr("fill", "currentColor")
              .attr("text-anchor", "start")
              .text("y")
          )
      )

      // Color scale: give me a specie name, I return a color
      var color = d3
        .scaleOrdinal()
        .domain(renderState?.getIslands().map((it) => it.id) ?? [])
        .range(d3.schemeCategory10)
      const ANIM_DURATION = 300

      // Highlight the specie that is hovered
      var highlight = function (evt: any) {
        const d: { peerId: string; x: number; y: number; island: string } = evt.target.__data__
        d3.selectAll(".dot").transition().duration(ANIM_DURATION).style("fill", "lightgrey").attr("r", 3)
        console.log(d)
        d3.selectAll("." + d.island)
          .transition()
          .duration(ANIM_DURATION)
          .style("fill", color(d.island) as string)
          .attr("r", 7)
      }

      // Highlight the specie that is hovered
      var doNotHighlight = function () {
        d3.selectAll(".dot").transition().duration(ANIM_DURATION).style("fill", "lightgrey").attr("r", 5)
      }

      // Add dots
      const svgPoints = svg
        .select(".plot-area")
        .selectAll(".dot")
        .data(data, function (d: any) {
          return d.peerId
        })

      const svgIslands = svg
        .select(".plot-area")
        .selectAll(".island")
        .data(islandsData, function (d: any) {
          return d.island
        })

      const svgPointLabels = svg
        .select(".plot-area")
        .selectAll("text")
        .data(data, function (d: any) {
          return d.peerId
        })

      svgIslands
        .enter()
        .append("rect")
        .attr("class", (d) => "island")
        .attr("x", (d) => x(d.x) - 2)
        .attr("y", (d) => y(d.y) - 2)
        .attr("width", (d) => 5)
        .attr("height", (d) => 5)

        .on("mouseover", highlight)
        .on("mouseleave", doNotHighlight)

      svgIslands.exit().remove()

      svgIslands
        .transition()
        .duration(ANIM_DURATION)
        .attr("class", (d) => "dot " + d.island)
        .attr("x", (d) => x(d.x) - 2)
        .attr("y", (d) => y(d.y) - 2)

      svgPoints
        .enter()
        .append("circle")
        .attr("class", (d) => "dot " + d.island)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 5)
        .on("mouseover", highlight)
        .on("mouseleave", doNotHighlight)

      svgPoints.exit().remove()

      svgPoints
        .transition()
        .duration(ANIM_DURATION)
        .attr("class", (d) => "dot " + d.island)
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 5)

      svgPointLabels
        .enter()
        .append("text")
        .attr("x", (d) => x(d.x) - 10)
        .attr("y", (d) => y(d.y) - 10)
        .text(function (d) {
          return d.island + ": " + d.peerId
        })
        .attr("font-size", "10px")

      svgPointLabels.exit().remove()

      svgPointLabels
        .transition()
        .duration(ANIM_DURATION)
        .attr("x", (d) => x(d.x) - 10)
        .attr("y", (d) => y(d.y) - 10)
        .text(function (d) {
          return d.island + ": " + d.peerId
        })

      const d3dataradius = svg
        .select(".plot-area")
        .selectAll(".connectRadius")
        .data(data, function (d: any) {
          return d.peerId
        })

      d3dataradius
        .enter()
        .append("circle")
        .attr("class", (d) => "connectRadius")
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.joinRadius))
        .lower()

      d3dataradius
        .transition()
        .duration(ANIM_DURATION)
        .attr("class", (d) => "connectRadius")
        .style("fill", (d) => makeTransparent(color(d.island) as string))
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", (d) => radiusScale(d.joinRadius))

      d3dataradius.exit().remove()
    },
    [renderState]
  )

  useEffect(() => {
    if (debouncedCode) {
      setSteps(memoizedParse(debouncedCode))
    }
  }, [debouncedCode])

  useEffect(() => {
    fetch("/fixtures")
      .then(($) => $.json())
      .then((files: RemoteFile[]) => {
        const r: Record<string, RemoteFile> = {}
        for (let $ of files) {
          r[$.basename] = $
          $.dirty = false
        }
        if (!selectedFile) {
          setSelectedFile(files[0].basename)
        }
        setFiles(r)
      })
  }, [])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    setIsEditorReady(true)
    configureLanguage(editor, monaco)
  }

  function configureLanguage(editor: monacoType.editor.IStandaloneCodeEditor, monaco: typeof monacoType) {
    var commandId = editor.addCommand(0, function (accesor, start, end, range: monacoType.IRange) {
      setRunToLine(range.endLineNumber)
    })

    editor.addAction({
      // An unique identifier of the contributed action.
      id: "run-to-cursor-action",

      // A label of the action that will be presented to the user.
      label: "Run to cursor",

      // An optional array of keybindings for the action.
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],

      contextMenuGroupId: "navigation",

      contextMenuOrder: 1.5,

      // Method that will be executed when the action is triggered.
      // @param editor The editor instance is passed in as a convinience
      run: function (editor, ...args) {
        const pos = editor.getPosition()
        if (pos) {
          setRunToLine(pos.lineNumber)
        }
      },
    })

    monaco.languages.registerCodeActionProvider("clojure", {
      provideCodeActions: function (model, range, context, token) {
        const steps = memoizedParse(model.getValue())

        if (steps && steps.steps.length) {
          const lm = new LineMapper(steps.document.text, selectedFile || "")

          const actions = steps.steps
            .map(
              (step): monacoType.languages.CodeAction => {
                const startLine = lm.position(step.start)
                const endLine = lm.position(step.end)

                const tokenRange = new monaco.Selection(
                  startLine.line + 1,
                  startLine.column + 1,
                  endLine.line + 1,
                  endLine.column + 1
                )

                if (range.intersectRanges(tokenRange)) {
                  return {
                    title: "▶ Run to cursor",
                    kind: "run",
                    command: {
                      id: commandId!,
                      title: "▶ Run",
                      arguments: [step.start, step.end, tokenRange],
                    },
                  }
                }
                return null as any
              }
            )
            .filter(($) => !!$)

          return {
            actions: actions.length ? [actions[actions.length - 1]] : [],
            dispose: () => {},
          }
        }

        return {
          actions: [],
          dispose: () => {},
        }
      },
    })
  }

  const handleEditorChange: OnChange = (value, editor) => {
    if (selectedFile && files && files[selectedFile] && files[selectedFile].content != value) {
      const wasDirty = files[selectedFile].dirty
      files[selectedFile].dirty = true
      files[selectedFile].content = value || files[selectedFile].content

      if (!wasDirty) {
        setFiles({ ...files })
      }

      setCurrentCode(value || "")
      setRuntimeDecorations([])
    }
  }

  useEffect(() => {
    if (!steps || !monaco) return
    if (runToLine == -1) return
    const decorations: monacoType.editor.IModelDeltaDecoration[] = []
    const closure = getClosure()
    setReadonly(true)
    setRuntimeDecorations([])
    ;(async function () {
      console.log("run to line: ", runToLine)
      const lm = new LineMapper(steps.document.text, selectedFile || "")
      for (let step of steps.steps) {
        const startLine = lm.position(step.start)
        const endLine = lm.position(step.end)
        let range = new monaco.Selection(startLine.line + 1, startLine.column + 1, endLine.line + 1, endLine.column + 1)

        if (runToLine == 0 || endLine.line < runToLine) {
          try {
            await step(closure)
            decorations.push({
              range,
              options: {
                isWholeLine: true,
                glyphMarginClassName: "green-background",
                hoverMessage: { value: "OK" },
                className: "ok-test",
              },
            })
          } catch (e) {
            console.error(e)
            if (e.node) {
              const startLine = lm.position(e.node.start)
              const endLine = lm.position(e.node.end)
              const range = new monaco.Selection(
                startLine.line + 1,
                startLine.column + 1,
                endLine.line + 1,
                endLine.column + 1
              )
              decorations.push({
                range,
                options: {
                  isWholeLine: false,
                  inlineClassName: "squiggly-error",
                  hoverMessage: { value: "```\n" + e.message + "\n```" },
                },
              })
            }

            decorations.push({
              range,
              options: {
                isWholeLine: false,
                glyphMarginClassName: "red-background",
                inlineClassName: e.node ? "" : "squiggly-error",
                hoverMessage: { value: "```\n" + e.message + "\n```" },
                afterContentClassName: "err-test-content",
              },
            })
          }
        } else {
          decorations.push({
            range,
            options: {
              isWholeLine: true,
              glyphMarginClassName: "gray-background",
              hoverMessage: { value: "Skipped" },
            },
          })
        }
      }
    })()
      .then(() => {
        setRenderState(calculateRenderState(closure))
        setRuntimeDecorations(decorations)
        setReadonly(false)
        setRunToLine(-1)
      })
      .catch(console.error)
  }, [runToLine])

  useEffect(() => {
    if (monaco && steps && editorRef.current) {
      const lm = new LineMapper(steps.document.text, selectedFile || "")

      setSyntaxErrorDecorations(
        steps.errors.map(
          (error: DocumentError): monacoType.editor.IModelDeltaDecoration => {
            const startLine = lm.position(error.start)
            const endLine = lm.position(error.end)
            const range = new monaco.Selection(
              startLine.line + 1,
              startLine.column + 1,
              endLine.line + 1,
              endLine.column + 1
            )

            return {
              options: {
                stickiness: 3,
                inlineClassName: "squiggly-error",
                className: "squiggly-error",
                hoverMessage: { value: error.message },
                overviewRuler: {
                  position: monaco.editor.OverviewRulerLane.Center,
                  color: "#FF0000",
                  darkColor: "#FF0000",
                },
              },
              range,
            }
          }
        )
      )
    }
  }, [steps, editorRef, monaco])

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel()

      if (model) {
        const decor = model.getAllDecorations()
        const newDecor = [...syntaxErrorDecorations, ...runtimeDecorations]
        const mapdedup = new Map<string, monacoType.editor.IModelDeltaDecoration>()
        newDecor.forEach(($) => {
          mapdedup.set(
            `${$.range.startLineNumber},${$.range.startColumn},${$.range.endLineNumber},${
              $.range.endColumn
            },${JSON.stringify($.options.hoverMessage)}`,
            $
          )
        })
        model.deltaDecorations(
          decor.map(($) => $.id),
          Array.from(mapdedup.values())
        )
      }
    }
  }, [syntaxErrorDecorations, runtimeDecorations, editorRef])

  function handleSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedFile(event.target.value)
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.render()
    }
  }, [editorRef.current])

  useEffect(() => {
    if (selectedFile && files) {
      const theFile = files[selectedFile]
      if (theFile) {
        setRuntimeDecorations([])
        setSyntaxErrorDecorations([])
        setCurrentCode(theFile.content)
      }
    }
  }, [selectedFile, files])

  return (
    <div>
      <div className="editor" style={{ width: size }}>
        <ErrorBoundary>
          {files && selectedFile && (
            <MonacoEditor
              language="clojure"
              loading={<div>Loading editor...</div>}
              defaultValue={(files[selectedFile] && files[selectedFile].content) || ""}
              defaultLanguage="clojure"
              path={selectedFile}
              onMount={handleEditorMount}
              onChange={handleEditorChange}
              options={{
                // fontSize: 13,
                glyphMargin: true,
                lineNumbers: "on",
                minimap: { enabled: false },
                automaticLayout: true,
                readOnly: readonly,
              }}
            />
          )}
        </ErrorBoundary>
      </div>
      <div className="content" style={{ left: size + 5 }}>
        <div className="top-bar content-bar d-flex flex-justify-between">
          <div>
            <select onChange={handleSelect} value={selectedFile}>
              {files ? (
                Object.values(files).map(($) => (
                  <option key={$.basename} value={$.basename}>
                    {$.basename}
                    {$.dirty && " * <NOT SAVED>"}
                  </option>
                ))
              ) : (
                <option disabled>Loading...</option>
              )}
            </select>
            <button
              className=""
              disabled={!(files && selectedFile && files[selectedFile] && files[selectedFile].dirty)}
            >
              Save<span className="AnimatedEllipsis"></span>
            </button>
            <button className="">New file</button>
          </div>
          <div>
            <button className="" onClick={() => setRunToLine(0)}>
              Run all
            </button>
            <div className="p-2">
              {loadingSave && (
                <span className="m-1">
                  <span>Saving</span>
                  <span className="AnimatedEllipsis"></span>
                </span>
              )}
            </div>
          </div>
          <div className="p-2 d-flex" style={{ alignItems: "center" }}>
            <span className="ml-4"></span>
          </div>
        </div>
        <div className="scroll">
          <svg
            ref={refD3}
            style={{
              width: "75%",
              aspectRatio: "1/1",
              marginLeft: "12.5%",
            }}
          >
            <g className="plot-area" />
            <g className="x-axis" />
            <g className="y-axis" />
          </svg>
          <pre>{JSON.stringify(renderState?.getIslands(), null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
