(configure { "joinDistance" 4096 ; 64 * 64
             "leaveDistance" 6400 ; 80 * 80
            })


(move ["1" 0 0 0]
      ["2" 16 0 16]
      ["3" 200 0 100]
      ["4" 300 0 200]
      ["5" 320 0 200]
      ["6" 288 0 190])

(move ["wanderer" 10 0 10])
(expectIslandWith ["1" "2" "wanderer"])

(move ["wanderer" 60 0 60])
