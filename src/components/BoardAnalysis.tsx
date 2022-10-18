import { ActionIcon, Button, Group, Stack, Switch } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import Chessground from "@react-chess/chessground";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight
} from "@tabler/icons";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { Chess, PartialMove } from "chess.ts";
import { useEffect, useState } from "react";
import {
  formatMove, moveToKey,
  toDests,
  VariationTree
} from "../utils/chess";
import BestMoves from "./BestMoves";
import GameNotation from "./GameNotation";

function BoardAnalysis({ initialFen }: { initialFen: string }) {
  const [engineOn, setEngineOn] = useState(false);
  const [engineMove, setEngineMove] = useState<string | null>(null);

  // Variation tree of all the previous moves
  const [tree, setTree] = useState<VariationTree>(
    buildVariationTree(new Chess(initialFen))
  );
  const chess = tree.position;

  // Board orientation
  const [orientation, setOrientation] = useState("w");

  // Retursn a tree of all the previous moves
  function buildVariationTree(chess: Chess): VariationTree {
    const tree = new VariationTree(null, chess);

    if (chess.history().length > 0) {
      const parent = chess.undo();
      if (parent) {
        tree.parent = buildVariationTree(chess);
      }
    }

    return tree;
  }

  function makeMove(move: PartialMove) {
    const newChess = tree.position.clone();
    newChess.move(move);
    const newTree = new VariationTree(tree, newChess);
    tree.children.push(newTree);
    setTree(newTree);
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
    }
  }

  function redoMove() {
    if (tree.children.length > 0) {
      setTree(tree.children[0]);
    }
  }

  function goToStart() {
    setTree(tree.getTopVariation());
  }

  function goToEnd() {
    setTree(tree.getBottomVariation());
  }

  function flipBoard() {
    setOrientation(orientation === "w" ? "b" : "w");
  }

  const turn = formatMove(chess.turn());
  const dests = toDests(chess);
  const lastMove = moveToKey(tree.getLastMove());

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
    ["f", () => flipBoard()],
  ]);

  async function waitForMove() {
    await listen("best_move", (event) => {
      setEngineMove(event.payload as string);
    });
  }

  useEffect(() => {
    waitForMove();
  }, []);

  useEffect(() => {
    if (engineOn) {
      invoke("get_best_moves", {
        engine:
          "/home/francisco/Documents/prog/en-croissant/src-tauri/engines/stockfish_15_linux_x64_bmi2/stockfish_15_x64_bmi2",
      });
    }
  }, [engineOn]);

  return (
    <>
      <Group grow align={"flex-start"}>
        <Stack>
          <div
            style={{
              width: "70vw",
              height: "70vw",
              maxHeight: "90vh",
              maxWidth: "90vh",
              margin: "auto",
            }}
          >
            <Chessground
              contained
              config={{
                orientation: formatMove(orientation),
                fen: chess.fen(),
                movable: {
                  free: false,
                  color: turn,
                  dests: dests,
                  events: {
                    after: (orig, dest) => {
                      makeMove({ from: orig, to: dest });
                    },
                  },
                },
                turnColor: turn,
                check: chess.inCheck(),
                lastMove,
              }}
            />
          </div>
          <Group position={"center"}>
            <Button onClick={() => flipBoard()}>Flip</Button>
            <Button
              onClick={() => setTree(buildVariationTree(new Chess(initialFen)))}
            >
              Reset
            </Button>
            <Switch
              checked={engineOn}
              onChange={(event) => setEngineOn(event.currentTarget.checked)}
              onLabel="On"
              offLabel="Off"
              size="lg"
            />
          </Group>
        </Stack>

        <Stack>
          <GameNotation tree={tree} setTree={setTree} />
          <MoveControls />
          <BestMoves engineMove={engineMove} />
        </Stack>
      </Group>
    </>
  );

  function MoveControls() {
    return (
      <Group grow>
        <ActionIcon onClick={() => goToStart()}>
          <IconChevronsLeft />
        </ActionIcon>
        <ActionIcon onClick={() => undoMove()}>
          <IconChevronLeft />
        </ActionIcon>
        <ActionIcon onClick={() => redoMove()}>
          <IconChevronRight />
        </ActionIcon>
        <ActionIcon onClick={() => goToEnd()}>
          <IconChevronsRight />
        </ActionIcon>
      </Group>
    );
  }
}

export default BoardAnalysis;
