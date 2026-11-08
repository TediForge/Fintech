"""PDF generation service for the document definitions used by the Node backend."""

from collections.abc import Mapping, Sequence
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_ALIGNMENTS = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}


def generate_pdf_buffer(document_definition: Mapping[str, Any]) -> bytes:
    """Render a supported pdfmake definition to PDF bytes."""
    if not isinstance(document_definition, Mapping):
        raise TypeError("document_definition must be a mapping")

    page_size = document_definition.get("pageSize", "A4")
    if page_size != "A4":
        raise ValueError(f"Unsupported PDF page size: {page_size}")
    pagesize = A4
    orientation = document_definition.get("pageOrientation", "portrait")
    if orientation == "landscape":
        pagesize = landscape(pagesize)
    elif orientation != "portrait":
        raise ValueError(f"Unsupported PDF page orientation: {orientation}")

    margins = document_definition.get("pageMargins", [40, 40, 40, 40])
    if (
        not isinstance(margins, Sequence)
        or isinstance(margins, (str, bytes))
        or len(margins) != 4
        or any(not isinstance(value, (int, float)) for value in margins)
    ):
        raise ValueError("pageMargins must contain four numbers")
    left, top, right, bottom = margins

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=pagesize,
        leftMargin=left,
        topMargin=top,
        rightMargin=right,
        bottomMargin=bottom,
    )
    style_map = document_definition.get("styles", {})
    default_style = document_definition.get("defaultStyle", {})
    if not isinstance(style_map, Mapping) or not isinstance(default_style, Mapping):
        raise ValueError("PDF styles must be mappings")
    styles = _make_styles(style_map, default_style)
    content = document_definition.get("content", [])
    if not isinstance(content, list):
        raise ValueError("PDF content must be a list")
    flowables = _render_blocks(
        content, styles, styles["default"], pagesize[0] - left - right
    )
    document.build(flowables)
    return output.getvalue()


def _make_styles(
    named_styles: Mapping[str, Any], default_style: Mapping[str, Any]
) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["BodyText"]
    styles = {
        "default": ParagraphStyle(
            "default",
            parent=base,
            fontName="Helvetica",
            fontSize=_positive_number(default_style.get("fontSize"), 9),
            leading=_positive_number(default_style.get("fontSize"), 9) * 1.25,
        )
    }
    for name, options in named_styles.items():
        if not isinstance(options, Mapping):
            raise ValueError(f"PDF style '{name}' must be a mapping")
        style = styles["default"].clone(str(name))
        style.fontSize = _positive_number(options.get("fontSize"), style.fontSize)
        style.leading = style.fontSize * 1.25
        style.alignment = _ALIGNMENTS.get(options.get("alignment"), TA_LEFT)
        if options.get("bold"):
            style.fontName = "Helvetica-Bold"
        if options.get("color"):
            style.textColor = _color(options["color"])
        margin = options.get("margin")
        if isinstance(margin, Sequence) and len(margin) == 4:
            style.spaceBefore = margin[1]
            style.spaceAfter = margin[3]
        styles[str(name)] = style
    return styles


def _render_blocks(
    blocks: Sequence[Any],
    styles: Mapping[str, ParagraphStyle],
    default_style: ParagraphStyle,
    available_width: float,
) -> list[Any]:
    rendered = []
    for block in blocks:
        if isinstance(block, str):
            rendered.append(Paragraph(escape(block), default_style))
            continue
        if not isinstance(block, Mapping):
            raise ValueError("PDF content blocks must be text or mappings")

        margin = block.get("margin", [0, 0, 0, 0])
        if isinstance(margin, Sequence) and not isinstance(margin, (str, bytes)):
            if len(margin) == 4:
                rendered.append(Spacer(1, margin[1]))
        if "table" in block:
            rendered.append(
                _render_table(
                    block["table"], block.get("layout", ""), available_width
                )
            )
        elif "columns" in block:
            rendered.append(
                _render_columns(block["columns"], default_style, available_width)
            )
        elif "text" in block:
            style_name = block.get("style")
            if style_name is not None and (
                not isinstance(style_name, str) or style_name not in styles
            ):
                raise ValueError(f"Unknown PDF style: {style_name}")
            style = styles[style_name] if isinstance(style_name, str) else default_style
            rendered.append(
                Paragraph(
                    _rich_text(block["text"], block),
                    style,
                    bulletText=block.get("marker"),
                )
            )
        elif block.get("pageBreak"):
            from reportlab.platypus import PageBreak

            rendered.append(PageBreak())
        else:
            raise ValueError(f"Unsupported PDF content block: {', '.join(block.keys())}")
        if isinstance(margin, Sequence) and not isinstance(margin, (str, bytes)):
            if len(margin) == 4 and margin[3]:
                rendered.append(Spacer(1, margin[3]))
    return rendered


def _render_table(table_spec: Any, layout: Any, available_width: float) -> Table:
    if not isinstance(table_spec, Mapping):
        raise ValueError("PDF table definition must be a mapping")
    body = table_spec.get("body")
    if not isinstance(body, list) or not body:
        raise ValueError("PDF table body must contain rows")
    rows = []
    for row in body:
        if not isinstance(row, list):
            raise ValueError("PDF table rows must be lists")
        rows.append([_table_cell(cell) for cell in row])
    widths = table_spec.get("widths")
    col_widths = None
    if isinstance(widths, list):
        fixed = [float(width) for width in widths if isinstance(width, (int, float))]
        star_count = sum(width == "*" for width in widths)
        if star_count:
            star_width = (available_width - sum(fixed)) / star_count
            col_widths = [
                star_width if width == "*" else width for width in widths
            ]
        elif len(widths) == len(rows[0]):
            col_widths = widths
    output = Table(rows, colWidths=col_widths, repeatRows=table_spec.get("headerRows", 0))
    rules = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if layout == "lightHorizontalLines":
        rules.extend(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#9aa9b8")),
                ("LINEBELOW", (0, 1), (-1, -1), 0.35, colors.HexColor("#e7edf4")),
            ]
        )
    if table_spec.get("headerRows", 0):
        rules.append(("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"))
        rules.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef3f8")))
    output.setStyle(TableStyle(rules))
    return output


def _render_columns(
    columns: Any, default_style: ParagraphStyle, available_width: float
) -> Table:
    if not isinstance(columns, list) or not columns:
        raise ValueError("PDF columns must be a non-empty list")
    cells = []
    widths = []
    for column in columns:
        if isinstance(column, Mapping):
            cells.append(Paragraph(_rich_text(column.get("text", ""), column), default_style))
            widths.append(column.get("width", "*"))
        else:
            cells.append(Paragraph(_rich_text(column, {}), default_style))
            widths.append("*")
    fixed_width = sum(width for width in widths if isinstance(width, (int, float)))
    stars = sum(width == "*" for width in widths)
    if stars:
        available = available_width - fixed_width
        widths = [available / stars if width == "*" else width for width in widths]
    return Table([cells], colWidths=widths, style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))


def _table_cell(value: Any) -> Paragraph:
    if isinstance(value, Mapping) and "text" in value:
        return Paragraph(_rich_text(value["text"], value), getSampleStyleSheet()["BodyText"])
    return Paragraph(_rich_text(value, {}), getSampleStyleSheet()["BodyText"])


def _rich_text(value: Any, options: Mapping[str, Any]) -> str:
    if isinstance(value, list):
        return "".join(_rich_text(part, {}) for part in value)
    if isinstance(value, Mapping):
        text_value = escape(str(value.get("text", ""))).replace("\n", "<br/>")
        if value.get("bold"):
            text_value = f"<b>{text_value}</b>"
        if value.get("italics"):
            text_value = f"<i>{text_value}</i>"
        if value.get("color"):
            text_value = f'<font color="{_color(value["color"]).hexval()}">{text_value}</font>'
        if value.get("link"):
            text_value = f'<link href="{escape(str(value["link"]), {chr(34): "&quot;"})}">{text_value}</link>'
        return text_value
    text_value = escape(str(value)).replace("\n", "<br/>")
    if options.get("link"):
        text_value = f'<link href="{escape(str(options["link"]))}">{text_value}</link>'
    return text_value


def _positive_number(value: Any, default: float) -> float:
    if value is None:
        return default
    if not isinstance(value, (int, float)) or value <= 0:
        raise ValueError("PDF font size must be a positive number")
    return float(value)


def _color(value: Any) -> colors.Color:
    if not isinstance(value, str):
        raise ValueError("PDF colors must be strings")
    try:
        return colors.HexColor(value)
    except ValueError as error:
        raise ValueError("Invalid PDF color") from error
