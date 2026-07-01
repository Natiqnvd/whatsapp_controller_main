# backend/pdf_extractor.py
"""Extracts a Name/Balance/Number table from an uploaded PDF (e.g. an
"Outstanding Balances Report"), returning the same shape produced by the
CSV upload endpoint: a list of {"name", "balance", "number"} dicts.

Uses word positions (x/y coordinates) rather than pdfplumber's table-line
detection, since many report-generator PDFs either lack reliable ruling
lines or emit their text stream column-by-column instead of row-by-row.
"""
import io

import pdfplumber

from backend.helper import clean_number


def _cluster_words_into_rows(words, y_tolerance=3):
    """Group words into visual rows by vertical position, then order each
    row left-to-right. This reconstructs correct row content even when the
    PDF's underlying text stream is ordered column-by-column rather than
    row-by-row (common with report-generator PDFs)."""
    rows = []
    for w in sorted(words, key=lambda w: w["top"]):
        for row in rows:
            if abs(row[0]["top"] - w["top"]) <= y_tolerance:
                row.append(w)
                break
        else:
            rows.append([w])
    rows.sort(key=lambda row: row[0]["top"])
    return [sorted(row, key=lambda w: w["x0"]) for row in rows]


def _find_balance_columns(page, rows):
    """Locate the x-position where each of the 4 columns (SNo, Account
    Name, Balance, Contact No) begins, so data rows can be split by
    position. Prefers real vertical ruling lines (reliable even when a
    header label is centered rather than left-aligned within its column);
    falls back to header-word positions for PDFs with no ruling lines."""
    v_line_xs = sorted({
        round(l["x0"], 1)
        for l in page.lines
        if abs(l["x0"] - l["x1"]) < 0.5 and page.bbox[0] + 5 < l["x0"] < page.bbox[2] - 5
    })
    if len(v_line_xs) >= 3:
        return {
            "sno": page.bbox[0],
            "name": v_line_xs[0],
            "balance": v_line_xs[1],
            "contact": v_line_xs[2],
        }

    for row in rows:
        starts = {w["text"]: w["x0"] for w in row}
        if "SNo" in starts and "Balance" in starts:
            name_x = starts.get("Account", starts.get("Name"))
            contact_x = starts.get("Contact", starts.get("No"))
            if name_x is not None and contact_x is not None:
                return {
                    "sno": starts["SNo"],
                    "name": name_x,
                    "balance": starts["Balance"],
                    "contact": contact_x,
                }
    return None


def _assign_row_to_columns(row, column_starts):
    """Bucket a row's words into sno/name/balance/contact based on which
    column start each word's x-position falls after."""
    ordered_cols = sorted(column_starts.items(), key=lambda item: item[1])
    buckets = {col: [] for col in column_starts}
    for w in row:
        col = ordered_cols[0][0]
        for label, x in ordered_cols:
            if w["x0"] + 1 >= x:
                col = label
        buckets[col].append(w["text"])
    return {col: " ".join(words).strip() for col, words in buckets.items()}


def extract_balances_from_pdf(contents: bytes) -> list:
    """Parse PDF bytes and return a list of {"name", "balance", "number"}
    dicts, or an empty list if no Name/Balance/Number table was found."""
    data = []
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        column_starts = None
        for page in pdf.pages:
            words = page.extract_words()
            if not words:
                continue

            rows = _cluster_words_into_rows(words)

            if column_starts is None:
                column_starts = _find_balance_columns(page, rows)
            if column_starts is None:
                continue

            for row in rows:
                texts = {w["text"] for w in row}
                if "SNo" in texts and "Balance" in texts:
                    continue  # header row

                cols = _assign_row_to_columns(row, column_starts)

                if not cols["sno"].isdigit() or not cols["name"]:
                    continue

                try:
                    balance = int(float(cols["balance"].replace(",", "")))
                except ValueError:
                    continue

                data.append({
                    "name": cols["name"].upper(),
                    "balance": balance,
                    "number": cols["contact"]
                })

    return data
