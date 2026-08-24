#!/usr/bin/env python3
"""Build compact paired-keyframe conversation GIFs from a strict AI contact sheet."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def blend_frames(first: Image.Image, second: Image.Image) -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    for image, duration in ((first, 900), (second, 1_100)):
        frames.append(image)
        durations.append(duration)
    for step in range(1, 5):
        frames.append(Image.blend(second, first, step / 5))
        durations.append(80)
    return frames, durations


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--rows", type=int, default=6)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    args.output.mkdir(parents=True, exist_ok=True)
    cell_width = source.width // args.columns
    cell_height = source.height // args.rows
    pairs = []
    for row in range(args.rows):
        for pair_column in range(0, args.columns, 2):
            left = source.crop((pair_column * cell_width, row * cell_height, (pair_column + 1) * cell_width, (row + 1) * cell_height))
            right = source.crop(((pair_column + 1) * cell_width, row * cell_height, (pair_column + 2) * cell_width, (row + 1) * cell_height))
            pairs.append((left, right))

    for index, (first, second) in enumerate(pairs[: args.limit], start=1):
        frames, durations = blend_frames(first, second)
        destination = args.output / f"conversation-{index:02d}.gif"
        frames[0].save(
            destination,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            optimize=True,
            disposal=2,
        )
        print(f"{destination}\t{destination.stat().st_size}")


if __name__ == "__main__":
    main()
