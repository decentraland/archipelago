; initialize the archipelago
(configure { "joinDistance" 4096 ; 64 * 64
             "leaveDistance" 6400 ; 80 * 80
            })

; test case 1
(move ["1" 0 0 0]
      ["2" 16 0 16])
(ensureIslandsCount 1)
(expectIslandWith ["1" "2"])

; "3rd peer must be part of its own island"
(move ["3", 200, 0, 200])
(ensureIslandsCount 2)
(expectIslandsWith [["1" "2"] ["3"]])

; "add 4th peer, should be part of first island"
(move ["4" 50 0 0])
(ensureIslandsCount 2)
(expectIslandsWith [["1" "2" "4"] ["3"]])

; "move the 3rd closer, should bridge islands"
(move ["3", 100, 0, 10])
(ensureIslandsCount 1)
(expectIslandWith ["1" "2" "3" "4"])

; "disconnect 4th peer"
(disconnect ["4"])
(ensureIslandsCount 2)
(expectIslandsWith [["1" "2"] ["3"]])

(move ["4" 150 0 10])
(ensureIslandsCount 2)
(expectIslandsWith [["1" "2"] ["3" "4"]])