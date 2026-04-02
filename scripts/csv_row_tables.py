#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path


def escape_md(value: str) -> str:
    value = value.replace("|", "\\|")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\n", "<br>")
    return value


def to_markdown_tables(rows, headers, label_column):
    lines = []
    for idx, row in enumerate(rows, start=1):
        label = row.get(label_column) if label_column else None
        if label is None or label == "":
            label = f"Row {idx}"
        lines.append(f"## {escape_md(label)}")
        lines.append("")
        if headers:
            header_label = headers[0]
            header_value = row.get(header_label, "")
            lines.append(f"| {escape_md(header_label)} | {escape_md(header_value)} |")
            lines.append("| --- | --- |")
            body_headers = headers[1:]
        else:
            lines.append("|  |  |")
            lines.append("| --- | --- |")
            body_headers = []
        for header in body_headers:
            value = row.get(header, "")
            lines.append(f"| {escape_md(header)} | {escape_md(value)} |")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        rows = list(reader)
    return rows, headers


def main():
    parser = argparse.ArgumentParser(
        description="Convert a CSV into markdown tables, one per row."
    )
    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Path to the CSV input file.",
    )
    parser.add_argument(
        "-o",
        "--output",
        required=True,
        help="Path to the markdown output file.",
    )
    parser.add_argument(
        "--label-column",
        default="Field Label",
        help="Column used for the h2 header before each table.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    rows, headers = read_csv(input_path)
    label_column = args.label_column if args.label_column in headers else None
    markdown = to_markdown_tables(rows, headers, label_column)
    output_path.write_text(markdown, encoding="utf-8")


if __name__ == "__main__":
    main()
