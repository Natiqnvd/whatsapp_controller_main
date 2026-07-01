# backend/pdf_to_csv.py
"""
Extracts the "Outstanding Balances Report" produced by the NAVEED SONS / HBU
Technologies software into a CSV consumable by
`load_numbers_from_csv_due_bill` in whatsapp_controler.py (Name, Balance,
Number columns, no header).

Usage:
    python -m backend.pdf_to_csv <input.pdf> [-o output.csv]
"""
import argparse
import csv
import sys
from pathlib import Path

import pdfplumber

EXPECTED_HEADERS = {"account name": "Name", "balance": "Balance", "contact no": "Number"}


def extract_rows(pdf_path: Path):
    column_map = None  # header name -> cell index, discovered from whichever page has it
    rows = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if not tables:
                print(f"[WARNING]: No table detected on page {page_number}; its rows will be missing.")
                continue
            if len(tables) > 1:
                print(f"[WARNING]: Page {page_number} has {len(tables)} tables; only the first is used.")

            for row in tables[0]:
                if not row:
                    continue

                first_cell = (row[0] or "").strip()

                if column_map is None and any(
                    (cell or "").strip().lower() in EXPECTED_HEADERS for cell in row
                ):
                    column_map = {
                        EXPECTED_HEADERS[(cell or "").strip().lower()]: i
                        for i, cell in enumerate(row)
                        if (cell or "").strip().lower() in EXPECTED_HEADERS
                    }
                    continue

                # Only page 1 repeats the header row; other pages start straight
                # into data, so rows are identified by a numeric SNo instead of
                # by skipping a fixed number of leading rows.
                if not first_cell.isdigit():
                    continue

                rows.append(row)

    if column_map is None or len(column_map) != 3:
        print("[ERROR]: Could not locate Account Name / Balance / Contact No columns in the PDF.")
        sys.exit(1)

    sno_column = 0
    snos = [int((row[sno_column] or "").strip()) for row in rows]
    expected = list(range(1, len(rows) + 1))
    if snos != expected:
        print(f"[ERROR]: SNo sequence is not contiguous (got {snos[:5]}...{snos[-5:]}); "
              "table extraction likely missed or duplicated a row. Aborting rather than writing a bad CSV.")
        sys.exit(1)

    return rows, column_map


def clean_balance(raw: str) -> str:
    value = raw.replace(",", "").strip()
    if value.startswith("(") and value.endswith(")"):
        value = "-" + value[1:-1]
    try:
        float(value)
    except ValueError:
        print(f"[ERROR]: Could not parse balance value: {raw!r}")
        sys.exit(1)
    return value


def clean_number(raw: str) -> str:
    return raw.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_pdf", type=Path, help="Path to the balances report PDF")
    parser.add_argument("-o", "--output", type=Path, help="Output CSV path (defaults to input name with .csv)")
    args = parser.parse_args()

    if not args.input_pdf.exists():
        print(f"[ERROR]: File not found: {args.input_pdf}")
        sys.exit(1)

    output_path = args.output or args.input_pdf.with_suffix(".csv")

    rows, column_map = extract_rows(args.input_pdf)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for row in rows:
            name = " ".join(row[column_map["Name"]].split())
            balance = clean_balance(row[column_map["Balance"]])
            number = clean_number(row[column_map["Number"]])
            writer.writerow([name, balance, number])

    print(f"[SUCCESS]: Extracted {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
