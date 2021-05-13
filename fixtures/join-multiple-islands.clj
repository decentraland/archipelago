(configure)

(move ["1" 0 0 0]
      ["2" 70 0 0]
      ["3" 70 0 70]
      ["4" 0 0 70])

(expectIslandsWith [["1"] ["2"] ["3"] ["4"]])

(move ["5" 35 0 35])
(expectIslandWith ["1" "2" "3" "4" "5"])

(disconnect ["5"])
(expectIslandWith ["1" "2" "3" "4"])

(move ["3" 81 0 81]
      ["4" 0 0 81])
 
(expectIslandsWith [["1" "2"] ["3"] ["4"]])

(move ["5" 35 0 35])
(expectIslandsWith [["1" "2" "4" "5"] ["3"]])