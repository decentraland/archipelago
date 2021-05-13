; smoke tests
(assert "smoke" 1)
(assert "smoke" (= 1 1))
(assert/equal 1 1)
(assert/equal (* 4 4) 16)
(assert/equal (* 4 4 4) 64)
(assert/equal (+ 4 4 4) 12)
(assert/equal (+ 4) 4)
(assert/equal (- 4 1) 3)
(assert/equal (- 4) 4)
(assert/equal (/ 4 2) 2)
(assert/equal {} {})
(assert/equal #{1} #{1})

(assert/throws (throwIf 1))
(assert/throws (throwIf (= 1 1)))
(assert/throws (throwIf (not (= 1 1))))
(assert/throws (assert/equal #{1} #{2}))

; initialize the archipelago
(configure)

; test functions
(def ensureIslandsCount #(assert/equal (get (getIslands) "length") %1))

; make sure we can call functions
(ensureIslandsCount 0)

; test case 1
(move ["1" 0 0 0]
      ["2" 16 0 16])
(ensureIslandsCount 1)
(expectIslandWith ["1" "2"])

; remove all peers
(disconnect ["1" "2"])
(ensureIslandsCount 0)

; add one peer
(move ["1" 0 0 0])
(ensureIslandsCount 1)
(expectIslandWith ["1"])

; remove the only peer
(disconnect "1")
(ensureIslandsCount 0)