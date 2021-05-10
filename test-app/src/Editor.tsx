import MonacoEditor, { OnMount, useMonaco, OnChange, Monaco } from "@monaco-editor/react"
import React, { useState, useEffect, useRef } from "react"
import { ErrorBoundary } from "./ErrorBounday"
import { parseTestSuite, DocumentParsingResult, DocumentError, getClosure } from "../../test/runner"
import type * as monacoType from "monaco-editor/esm/vs/editor/editor.api"
import { Closure, LineMapper } from "tiny-clojure"
import { Archipelago, Island } from "../../src"
import { Visualizer } from "./Visualizer"

const size = "50%"

type RemoteFile = {
  basename: string
  content: string
  dirty?: boolean
}

const DEFAULT_FILE_CONTENT = `(configure { "joinDistance" 4096 ; 64 * 64
             "leaveDistance" 6400 ; 80 * 80
            })
`

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

export function Editor(props: {}) {
  const monaco = useMonaco()

  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor>()

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
  const [layerUrl, setLayerUrl] = useState("https://peer.decentraland.org/comms/layers/amber")
  const debouncedCode = useDebounce(currentCode, 300)

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

    editor.addAction({
      id: "save-file",
      // A label of the action that will be presented to the user.
      label: "Save current file",

      // An optional array of keybindings for the action.
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S],

      contextMenuGroupId: "file",

      contextMenuOrder: 1.5,

      // Method that will be executed when the action is triggered.
      // @param editor The editor instance is passed in as a convinience
      run: function (editor, ...args) {
        saveSelectedFile()
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

  async function saveFile(theFile: RemoteFile) {
    setLoadingSave(true)
    try {
      const response = await fetch("/save-fixture", {
        method: "post",
        body: JSON.stringify({
          basename: theFile.basename,
          content: theFile.content,
        }),
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        theFile.dirty = false
        setFiles({ ...files, [theFile.basename]: theFile })
      } else {
        throw new Error("Response not OK: " + response.status)
      }
    } catch (e) {
      alert("Couldn't save: " + e.message)
    } finally {
      setLoadingSave(false)
    }
  }

  async function saveSelectedFile() {
    if (selectedFile && files) {
      const theFile = files[selectedFile]
      if (theFile) {
        await saveFile(theFile)
      }
    }
  }

  async function createNewFile() {
    let filename = prompt("Enter file name")

    if (filename) {
      if (!filename.endsWith(".clj")) {
        filename = filename + ".clj"
      }

      await saveFile({ basename: filename, content: DEFAULT_FILE_CONTENT })

      setSelectedFile(filename)
    }
  }

  async function importLayer(layerUrl: string) {
    if (editorRef.current) {
      const response = await fetch(`${layerUrl}/users`)

      if (response.ok) {
        const json = await response.json()

        if (json.length > 0) {
          let codeToAppend = "\n\n(move\n"

          for (const user of json) {
            if (user.position) {
              codeToAppend += `      ["${user.id}" ${user.position.join(" ")}]\n`
            }
          }

          codeToAppend += ")\n"
          editorRef.current.setValue(editorRef.current.getValue() + codeToAppend)
        }
      }
    }
  }

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
              onClick={() => saveSelectedFile()}
            >
              Save<span className="AnimatedEllipsis"></span>
            </button>
            <button className="" onClick={() => createNewFile()}>
              New file
            </button>
            <div style={{ display: "inline-block", padding: "5px" }}>
              {loadingSave && (
                <span className="m-1">
                  <span>Saving</span>
                  <span className="AnimatedEllipsis"></span>
                </span>
              )}
            </div>
          </div>
          <div>
            <button className="" onClick={() => setRunToLine(0)}>
              Run all
            </button>
            <span> | </span>
            <input
              name="layer-url"
              type="text"
              placeholder="Catalyst Layer URL"
              style={{ width: "400px" }}
              value={layerUrl}
              onChange={(ev) => setLayerUrl(ev.target.value)}
            ></input>
            <button
              style={{ position: "relative", left: "-65px", width: "65px" }}
              onClick={() => importLayer(layerUrl)}
              disabled={!(files && selectedFile && files[selectedFile] && layerUrl)}
            >
              Import
            </button>
          </div>
          <div className="p-2 d-flex" style={{ alignItems: "center" }}>
            <span className="ml-4"></span>
          </div>
        </div>
        <div className="scroll">
          <Visualizer renderState={renderState} />
          <pre>{JSON.stringify(renderState?.getIslands(), null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
