package main

type Piece int8

const (
	Empty Piece = iota
	King
	Queen
	Rook
	Bishop
	Knight
)

type Board [9]Piece

func isValidPos(r, c int) bool {
	return r >= 0 && r <= 2 && c >= 0 && c <= 2
}

func getLineMoves(startIdx int, board Board, directions [][2]int) []int {
	moves := make([]int, 0, 4)
	r := startIdx / 3
	c := startIdx % 3

	for _, dir := range directions {
		currR := r + dir[0]
		currC := c + dir[1]
		for isValidPos(currR, currC) {
			idx := currR*3 + currC
			if board[idx] != Empty {
				break
			}
			moves = append(moves, idx)
			currR += dir[0]
			currC += dir[1]
		}
	}
	return moves
}

func GetValidMoves(board Board, idx int) []int {
	piece := board[idx]
	if piece == Empty {
		return nil
	}

	r := idx / 3
	c := idx % 3
	moves := make([]int, 0, 8)

	switch piece {
	case Knight:
		dirs := [][2]int{{-2, -1}, {-2, 1}, {-1, -2}, {-1, 2}, {1, -2}, {1, 2}, {2, -1}, {2, 1}}
		for _, dir := range dirs {
			currR, currC := r+dir[0], c+dir[1]
			if isValidPos(currR, currC) {
				if board[currR*3+currC] == Empty {
					moves = append(moves, currR*3+currC)
				}
			}
		}
	case Rook:
		dirs := [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
		moves = append(moves, getLineMoves(idx, board, dirs)...)
	case Bishop:
		dirs := [][2]int{{-1, -1}, {-1, 1}, {1, -1}, {1, 1}}
		moves = append(moves, getLineMoves(idx, board, dirs)...)
	case Queen:
		dirs := [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}, {-1, -1}, {-1, 1}, {1, -1}, {1, 1}}
		moves = append(moves, getLineMoves(idx, board, dirs)...)
	case King:
		dirs := [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}, {-1, -1}, {-1, 1}, {1, -1}, {1, 1}}
		for _, dir := range dirs {
			currR, currC := r+dir[0], c+dir[1]
			if isValidPos(currR, currC) {
				if board[currR*3+currC] == Empty {
					moves = append(moves, currR*3+currC)
				}
			}
		}
	}
	return moves
}
