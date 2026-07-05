package main

import (
	"math/rand"
)

// RandomBoard genera un tablero aleatorio con exactamente Rey, Reina, Torre, Alfil y Caballo.
func RandomBoard() Board {
	pieces := []Piece{King, Queen, Rook, Bishop, Knight}
	positions := rand.Perm(9)
	var board Board
	for i, p := range pieces {
		board[positions[i]] = p
	}
	return board
}

// State representa un nodo en la cola BFS.
type State struct {
	Board Board
	Depth int
}

// GetNextStates devuelve todos los tableros alcanzables desde board en 1 movimiento.
func GetNextStates(board Board) []Board {
	var next []Board
	for i := 0; i < 9; i++ {
		if board[i] != Empty {
			moves := GetValidMoves(board, i)
			for _, m := range moves {
				nextBoard := board
				nextBoard[m] = board[i]
				nextBoard[i] = Empty
				next = append(next, nextBoard)
			}
		}
	}
	return next
}

// StateInfo contiene toda la información que queremos saber de un estado alcanzado.
type StateInfo struct {
	Depth  int
	Parent Board
}

// ExploreAllStates hace un BFS completo desde `seed` y devuelve un mapa
// de todos los estados alcanzables junto con su profundidad mínima desde seed.
func ExploreAllStates(seed Board) map[Board]StateInfo {
	result := make(map[Board]StateInfo)
	result[seed] = StateInfo{Depth: 0, Parent: seed}

	queue := []State{{Board: seed, Depth: 0}}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		for _, next := range GetNextStates(curr.Board) {
			if _, seen := result[next]; !seen {
				result[next] = StateInfo{Depth: curr.Depth + 1, Parent: curr.Board}
				queue = append(queue, State{Board: next, Depth: curr.Depth + 1})
			}
		}
	}
	return result
}

// PuzzleDistance calcula la distancia mínima (movimientos óptimos) entre start y target.
// Hace BFS desde target y busca start.
func PuzzleDistance(start, target Board) int {
	if start == target {
		return 0
	}
	visited := make(map[Board]bool)
	visited[target] = true
	queue := []State{{Board: target, Depth: 0}}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		for _, next := range GetNextStates(curr.Board) {
			if next == start {
				return curr.Depth + 1
			}
			if !visited[next] {
				visited[next] = true
				queue = append(queue, State{Board: next, Depth: curr.Depth + 1})
			}
		}
	}
	return -1 // inalcanzable (no debería ocurrir en nuestro grafo)
}

// BoardDiversity calcula cuán distinto es `b` de todos los boards en `selected`.
// La métrica es: número de piezas en posición diferente (0–5).
// Devuelve la distancia mínima de b a cualquier elemento de selected (distancia Maximin).
func BoardDiversity(b Board, selected []Board) int {
	if len(selected) == 0 {
		return 5 // máxima diversidad si no hay nada seleccionado aún
	}
	minDist := 5 + 1
	for _, s := range selected {
		dist := 0
		for i := 0; i < 9; i++ {
			if b[i] != s[i] {
				dist++
			}
		}
		if dist < minDist {
			minDist = dist
		}
	}
	return minDist
}

// GeneratePuzzle: versión simple para compatibilidad. Busca un puzzle a exactamente targetDepth.
func GeneratePuzzle(targetDepth int) (startBoard Board, target Board, moves int, found bool) {
	target = RandomBoard()
	visited := make(map[Board]bool)
	visited[target] = true
	queue := []State{{Board: target, Depth: 0}}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		if curr.Depth == targetDepth {
			return curr.Board, target, curr.Depth, true
		}

		nextStates := GetNextStates(curr.Board)
		for _, next := range nextStates {
			if !visited[next] {
				visited[next] = true
				queue = append(queue, State{Board: next, Depth: curr.Depth + 1})
			}
		}
	}
	return Board{}, Board{}, 0, false
}
