package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"time"
)

type ReactPiece struct {
	Type string `json:"type"`
	Id   string `json:"id"`
}

type ReactLevel struct {
	Id           int           `json:"id"`
	StartBoard   []*ReactPiece `json:"startBoard"`
	TargetBoard  []*ReactPiece `json:"targetBoard"`
	OptimalMoves int           `json:"optimalMoves"`
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

func BoardToReact(b Board) []*ReactPiece {
	res := make([]*ReactPiece, 9)
	for i, p := range b {
		res[i] = PieceToReact(p)
	}
	return res
}

// Puzzle es un candidato interno antes de convertirlo a ReactLevel.
type Puzzle struct {
	Start        Board
	Target       Board
	OptimalMoves int
}

// dificultyBand clasifica la profundidad en easy/medium/hard.
func difficultyBand(depth int) string {
	switch {
	case depth <= 5:
		return "easy"
	case depth <= 8:
		return "medium"
	default:
		return "hard"
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())

	fmt.Println("═══════════════════════════════════════")
	fmt.Println(" Chess 3×3 Puzzle Generator")
	fmt.Println("═══════════════════════════════════════")

	// ── Paso 1: Explorar el grafo completo ──────────────────────────────────
	fmt.Println("\n[1/4] Explorando el grafo completo de estados...")
	seed := RandomBoard()
	allStates := ExploreAllStates(seed)
	fmt.Printf("      → %d estados únicos encontrados\n", len(allStates))

	// Agrupar estados por profundidad (profundidad desde el semilla)
	byDepth := make(map[int][]Board)
	for board, info := range allStates {
		byDepth[info.Depth] = append(byDepth[info.Depth], board)
	}

	depths := make([]int, 0)
	for d := range byDepth {
		depths = append(depths, d)
	}
	sort.Ints(depths)
	fmt.Println("      Distribución por profundidad:")
	for _, d := range depths {
		fmt.Printf("        depth %2d: %d estados\n", d, len(byDepth[d]))
	}

	// ── Paso 2: Construir pool de puzzles candidatos ─────────────────────────
	// Para cada estado `target`, tomamos el semilla como `startBoard` candidato
	// y calculamos la distancia real (start→target) si queremos puzzles exactos.
	// Más eficiente: para cada target a profundidad d desde semilla,
	// el puzzle será (semilla→target) con distancia d (dado que BFS garantiza mínima).
	fmt.Println("\n[2/4] Construyendo pool de puzzles candidatos...")

	type CandidatePuzzle struct {
		Puzzle
		Band string
	}
	var candidates []CandidatePuzzle

	// Incluir todos los estados a profundidad >= 3 (nuestra mínima)
	for board, info := range allStates {
		if info.Depth < 3 {
			continue
		}
		band := difficultyBand(info.Depth)
		candidates = append(candidates, CandidatePuzzle{
			Puzzle: Puzzle{
				Start:        seed,
				Target:       board,
				OptimalMoves: info.Depth,
			},
			Band: band,
		})
	}
	fmt.Printf("      → %d puzzles candidatos (depth ≥ 3)\n", len(candidates))

	// ── Paso 3: Selección Maximin proporcional ───────────────────────────────
	// Objetivo: 100 tarjetas — 20 easy / 50 medium / 30 hard
	quotas := map[string]int{
		"easy":   20,
		"medium": 50,
		"hard":   30,
	}
	selected := make(map[string][]Puzzle)

	fmt.Println("\n[3/4] Selección Maximin (máxima diversidad)...")

	for _, band := range []string{"easy", "medium", "hard"} {
		quota := quotas[band]
		fmt.Printf("      Seleccionando %d puzzles [%s]...\n", quota, band)

		// Filtrar candidatos de esta banda
		var pool []CandidatePuzzle
		for _, c := range candidates {
			if c.Band == band {
				pool = append(pool, c)
			}
		}

		if len(pool) == 0 {
			fmt.Printf("      ⚠ Sin candidatos en banda %s\n", band)
			continue
		}

		// Shuffle inicial para romper empates aleatoriamente
		rand.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })

		var chosenTargets []Board
		var chosenPuzzles []Puzzle

		// Seed inicial: el más alejado del semilla (mayor profundidad en la banda)
		best := pool[0]
		for _, c := range pool[1:] {
			if c.OptimalMoves > best.OptimalMoves {
				best = c
			}
		}
		chosenTargets = append(chosenTargets, best.Target)
		chosenPuzzles = append(chosenPuzzles, best.Puzzle)

		for len(chosenPuzzles) < quota && len(chosenPuzzles) < len(pool) {
			bestScore := -1
			bestIdx := -1

			for i, c := range pool {
				// Comprobar que no está ya seleccionado
				alreadyChosen := false
				for _, ct := range chosenTargets {
					if ct == c.Target {
						alreadyChosen = true
						break
					}
				}
				if alreadyChosen {
					continue
				}

				// Diversidad del target respecto a los ya elegidos
				score := BoardDiversity(c.Target, chosenTargets)
				if score > bestScore {
					bestScore = score
					bestIdx = i
				}
			}

			if bestIdx == -1 {
				break
			}

			chosenTargets = append(chosenTargets, pool[bestIdx].Target)
			chosenPuzzles = append(chosenPuzzles, pool[bestIdx].Puzzle)
		}

		selected[band] = chosenPuzzles
		fmt.Printf("        → %d seleccionados\n", len(chosenPuzzles))
	}

	// ── Paso 4: Ordenar, mezclar y exportar ─────────────────────────────────
	fmt.Println("\n[4/4] Exportando a JSON...")

	// Intercalar las bandas: easy → medium → hard → easy → medium → hard...
	// para que la progresión sea suave
	var allPuzzles []Puzzle
	maxLen := 0
	for _, band := range []string{"easy", "medium", "hard"} {
		if len(selected[band]) > maxLen {
			maxLen = len(selected[band])
		}
	}
	for i := 0; i < maxLen; i++ {
		for _, band := range []string{"easy", "medium", "hard"} {
			if i < len(selected[band]) {
				allPuzzles = append(allPuzzles, selected[band][i])
			}
		}
	}

	levels := make([]ReactLevel, len(allPuzzles))
	for i, p := range allPuzzles {
		levels[i] = ReactLevel{
			Id:           i + 1,
			StartBoard:   BoardToReact(p.Start),
			TargetBoard:  BoardToReact(p.Target),
			OptimalMoves: p.OptimalMoves,
		}
	}

	outPath := "../src/logic/generated_levels.json"
	file, err := os.Create(outPath)
	if err != nil {
		fmt.Printf("Error al crear archivo: %v\n", err)
		return
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(levels); err != nil {
		fmt.Printf("Error al escribir JSON: %v\n", err)
		return
	}

	total := len(levels)
	fmt.Printf("\n✓ %d tarjetas generadas → %s\n", total, outPath)
	fmt.Printf("  Easy:   %d\n", len(selected["easy"]))
	fmt.Printf("  Medium: %d\n", len(selected["medium"]))
	fmt.Printf("  Hard:   %d\n", len(selected["hard"]))
}
