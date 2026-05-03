from __future__ import annotations

from pathlib import Path

from docx import Document


def extract_docx_to_txt(docx_path: Path) -> Path:
    doc = Document(str(docx_path))
    lines: list[str] = []
    for para in doc.paragraphs:
        text = (para.text or "").replace("\u200b", "").strip()
        if text:
            lines.append(text)

    out_path = docx_path.with_suffix(".txt")
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_path


def main() -> None:
    base = Path(__file__).resolve().parent
    for docx_path in sorted(base.glob("*.docx")):
        out = extract_docx_to_txt(docx_path)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()

