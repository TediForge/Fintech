from app.services.document.pdf import generate_pdf_buffer


def test_generate_pdf_buffer_renders_text_and_tables() -> None:
    pdf = generate_pdf_buffer(
        {
            "pageSize": "A4",
            "content": [
                {"text": "Account statement", "style": "title"},
                {
                    "table": {
                        "headerRows": 1,
                        "widths": ["*", 100],
                        "body": [["Date", "Amount"], ["2026-11-07", "NGN 42.00"]],
                    },
                    "layout": "lightHorizontalLines",
                },
            ],
            "styles": {"title": {"fontSize": 18, "bold": True}},
        }
    )

    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 500
