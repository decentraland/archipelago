; initialize the archipelago
(configure { "joinDistance" 4096 ; 64 * 64
             "leaveDistance" 6400 ; 80 * 80
            })

; "initial setup"
(move ["1" 0 0 0]
      ["2" 16 0 16])
(expectIslandWith ["1" "2"])

; "move 2nd apart and two islands should derive from first"
(move ["2" 200 0 200])
(expectIslandsWith [["1"] ["2"]])

; "move 2nd closer and the two islands should merge"
(move ["2" 16 0 16])
(expectIslandsWith [["1" "2"]])