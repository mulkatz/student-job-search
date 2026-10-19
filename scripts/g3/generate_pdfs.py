"""Generate private synthetic G3 PDFs and extract actual page text without OCR.

Run the TypeScript fixture-check before this authoring command. This is an offline
fixture tool, not a production parser or evidence of any model's performance.
"""

import argparse
import hashlib
import io
import json
import logging
import os
import re
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "experiments/g3/model-corpus.json"


def write_private(path, contents):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        output.write(contents)


def make_pdf(document):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4, invariant=1, pageCompression=1)
    pdf.setTitle("Synthetic G3 fixture - not a real applicant")
    pdf.setAuthor("Job Search synthetic fixture generator")
    width, height = A4
    for page_number, page in enumerate(document["pages"], 1):
        if document["kind"] == "scan_only":
            # Raster content only: no PDF text operators or hidden OCR layer.
            image = Image.new("RGB", (1240, 1754), "white")
            draw = ImageDraw.Draw(image)
            font = ImageFont.load_default(size=25)
            lines = [
                "SYNTHETIC G3 FIXTURE - NOT A REAL APPLICANT",
                page["heading"],
                "",
                *page["lines"],
                "",
                "Scan-only input. OCR is intentionally not enabled.",
            ]
            y = 110
            for line in lines:
                for wrapped in textwrap.wrap(line, width=65) or [""]:
                    draw.text((90, y), wrapped, fill="#172236", font=font)
                    y += 44
            if y > 1650:
                raise ValueError("Scan fixture would overflow its page.")
            pdf.drawImage(ImageReader(image), 0, 0, width=width, height=height)
        else:
            pdf.setFillColorRGB(0.12, 0.2, 0.3)
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(
                48, height - 52, "SYNTHETIC G3 FIXTURE - NOT A REAL APPLICANT"
            )
            pdf.setFont("Helvetica-Bold", 17)
            pdf.drawString(48, height - 94, page["heading"])
            pdf.setFont("Helvetica", 11)
            y = height - 134
            for line in page["lines"]:
                if not line.isascii():
                    raise ValueError("Fixture font supports ASCII source lines only.")
                for wrapped in textwrap.wrap(line, width=77) or [""]:
                    pdf.drawString(48, y, wrapped)
                    y -= 18
                y -= 9
            if y < 84:
                raise ValueError("Text fixture would overflow its page.")
            pdf.setFont("Helvetica", 9)
            pdf.drawString(
                48, 45,
                f"{document['id']} | Page {page_number} | Synthetic facts only",
            )
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def normalized(text):
    return " ".join(text.split())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output_dir = args.output.resolve()
    private_root = (ROOT / ".local/g3").resolve()
    if private_root not in output_dir.parents:
        parser.error("Output must be a new directory beneath .local/g3/.")
    source_bytes = CORPUS.read_bytes()
    corpus = json.loads(source_bytes)
    if corpus.get("version") != 1 or corpus.get("synthetic") is not True:
        raise ValueError("Only the version-1 synthetic corpus is supported.")
    documents = corpus["documents"]
    if len(documents) != 5:
        raise ValueError("Expected exactly five fixture documents.")
    for document in documents:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", document["id"]):
            raise ValueError("Invalid document identifier.")
    # Exclusive creation prevents silently replacing evidence from a prior run.
    output_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
    manifest = {
        "version": 1,
        "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
        "note": "Offline PDF generation and local parsing only; no model observations or approvals.",
        "documents": [],
    }
    for document in documents:
        file_name = document["fileName"]
        if Path(file_name).name != file_name or not file_name.endswith(".pdf"):
            raise ValueError("Invalid fixture filename.")
        malformed = document["kind"] == "malformed"
        contents = (
            b"%PDF-1.7\n% Intentionally incomplete synthetic fixture: no objects or trailer.\n"
            if malformed
            else make_pdf(document)
        )
        path = output_dir / file_name
        write_private(path, contents)
        pages = []
        if malformed:
            logging.getLogger("pypdf").setLevel(logging.ERROR)
            try:
                PdfReader(io.BytesIO(contents), strict=True)
            except PdfReadError:
                outcome = "parse_failed"
            else:
                raise ValueError("Malformed input unexpectedly parsed.")
        else:
            reader = PdfReader(io.BytesIO(contents), strict=True)
            pages = [
                {"page": number, "text": page.extract_text() or ""}
                for number, page in enumerate(reader.pages, 1)
            ]
            if len(pages) != len(document["pages"]):
                raise ValueError("Generated page count differs from source.")
            if document["kind"] == "scan_only":
                if any(page["text"].strip() for page in pages):
                    raise ValueError("Scan-only fixture contains extractable text.")
                outcome = "needs_review"
            else:
                for fact in document["expectedFacts"]:
                    actual = pages[fact["page"] - 1]["text"]
                    if normalized(fact["quote"]) not in normalized(actual):
                        raise ValueError("A labeled quote is absent from extracted PDF text.")
                outcome = "text_extracted"
        write_private(
            output_dir / f"{document['id']}.pages.json",
            (json.dumps(pages, indent=2) + "\n").encode(),
        )
        manifest["documents"].append(
            {
                "documentId": document["id"],
                "fileName": file_name,
                "sha256": hashlib.sha256(contents).hexdigest(),
                "pages": len(pages),
                "localOutcome": outcome,
            }
        )
    write_private(
        output_dir / "manifest.json",
        (json.dumps(manifest, indent=2) + "\n").encode(),
    )
    print(
        "Generated five synthetic PDF fixtures; "
        "text/page evidence verified locally, without OCR."
    )


if __name__ == "__main__":
    main()
