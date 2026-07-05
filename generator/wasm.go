//go:build js && wasm

package main

import (
	"syscall/js"
)

func getOptimalPathWrapper(this js.Value, args []js.Value) any {
	if len(args) != 2 {
		return nil
	}

	startJs := args[0]
	targetJs := args[1]

	var startBoard Board
	var targetBoard Board

	// Parse start board
	for i := 0; i < 9; i++ {
		startBoard[i] = parseReactPiece(startJs.Index(i))
	}
	// Parse target board
	for i := 0; i < 9; i++ {
		targetBoard[i] = parseReactPiece(targetJs.Index(i))
	}

	// We can use PuzzleDistance logic or a BFS to find the path from start to target.
	// We'll do a simple BFS from target to start to extract the path.
	path := computePath(startBoard, targetBoard)
	
	// Convert path to JS array of ReactPiece arrays
	jsPath := js.Global().Get("Array").New(len(path))
	for i, b := range path {
		jsBoard := js.Global().Get("Array").New(9)
		for j, p := range b {
			jsPiece := js.Global().Get("Object").New()
			rp := PieceToReact(p)
			if rp != nil {
				jsPiece.Set("type", rp.Type)
				jsPiece.Set("id", rp.Id)
				jsBoard.SetIndex(j, jsPiece)
			} else {
				jsBoard.SetIndex(j, js.Null())
			}
		}
		jsPath.SetIndex(i, jsBoard)
	}
	return jsPath
}

func parseReactPiece(val js.Value) Piece {
	if val.IsNull() || val.IsUndefined() {
		return Empty
	}
	t := val.Get("type").String()
	switch t {
	case "KING": return King
	case "QUEEN": return Queen
	case "ROOK": return Rook
	case "BISHOP": return Bishop
	case "KNIGHT": return Knight
	}
	return Empty
}

type ReactPiece struct {
	Type string `json:"type"`
	Id   string `json:"id"`
}

func PieceToReact(p Piece) *ReactPiece {
	switch p {
	case King:
		return &ReactPiece{Type: "KING", Id: "k1"}
	case Queen:
		return &ReactPiece{Type: "QUEEN", Id: "q1"}
	case Rook:
		return &ReactPiece{Type: "ROOK", Id: "r1"}
	case Bishop:
		return &ReactPiece{Type: "BISHOP", Id: "b1"}
	case Knight:
		return &ReactPiece{Type: "KNIGHT", Id: "n1"}
	default:
		return nil
	}
}

func computePath(start, target Board) []Board {
	if start == target {
		return []Board{start}
	}
	visited := make(map[Board]bool)
	visited[target] = true
	
	type Node struct {
		B Board
		Parent *Node
	}
	
	queue := []*Node{{B: target, Parent: nil}}

	var foundNode *Node
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		if curr.B == start {
			foundNode = curr
			break
		}

		for _, next := range GetNextStates(curr.B) {
			if !visited[next] {
				visited[next] = true
				queue = append(queue, &Node{B: next, Parent: curr})
			}
		}
	}
	
	if foundNode == nil {
		return nil
	}

	var path []Board
	curr := foundNode
	for curr != nil {
		path = append(path, curr.B)
		curr = curr.Parent
	}
	
	return path
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("getOptimalPathWasm", js.FuncOf(getOptimalPathWrapper))
	<-c
}
