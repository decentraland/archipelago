(def archipielago
  (init { joinDistance 64 * 64
          leaveDistance 80 * 80 }))

(move "1" 0 0 0)
(move "2" 16 0 16)

(assert "there should be one island"
  (equals (get islands "length") 1))

(assert "the island should contain both peers"
  (islandWith ["1" "2"]))

; "ateste"
(disconnect "2")

(assert "there should be one island"
  (equals (get islands "length") 1))

(assert "the island should contain only one peer"
  (islandWith ["1"]))