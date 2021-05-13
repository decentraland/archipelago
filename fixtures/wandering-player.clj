(configure)


(move ["1" 0 0 0]
      ["2" 16 0 16]
      ["friend" 200 0 100]
      ["4" 300 0 200]
      ["5" 330 0 200]
      ["6" 288 0 190])

(move ["wanderer" 10 0 10])
(expectIslandWith ["1" "2" "wanderer"])

(move ["wanderer" 60 0 60])
(expectIslandWith ["1" "2" "wanderer"])


(move ["wanderer" 70 0 70])
(expectIslandWith ["1" "2" "wanderer"])

(move ["wanderer" 80 0 80])
(expectIslandsWith [["1" "2"] ["wanderer"] ["friend"] ["4" "5" "6"]])

(move ["wanderer" 90 0 90])
(expectIslandWith ["wanderer"])

(move ["wanderer" 100 0 100])
(expectIslandWith ["wanderer"])

(move ["wanderer" 150 0 100])
(expectIslandWith ["wanderer" "friend"])

(move ["wanderer" 170 0 120] ["friend" 220 0 120])
(expectIslandWith ["wanderer" "friend"])

(move ["wanderer" 200 0 150] ["friend" 220 0 150])
(expectIslandWith ["wanderer" "friend"])

(move ["wanderer" 230 0 180] ["friend" 250 0 180])
(expectIslandsWith [["1" "2"] ["wanderer" "friend" "4" "5" "6"]])

(disconnect ["4" "6"])
(expectIslandsWith [["1" "2"] ["wanderer" "friend"] ["5"]])

(move ["wanderer" 250 0 180] ["friend" 270 0 180])
(expectIslandsWith [["1" "2"] ["wanderer" "friend" "5"]])