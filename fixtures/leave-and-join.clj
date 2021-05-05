
; initialize the archipelago
(configure { "joinDistance" 4096 ; 64 * 64
             "leaveDistance" 6400 ; 80 * 80
            })

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