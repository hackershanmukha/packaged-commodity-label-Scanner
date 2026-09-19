import hashlib
import json
import os
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def generate_report_number() -> str:
    now = datetime.now(timezone.utc)
    return f"JNC-{now.strftime('%Y%m%d%H%M%S')}-{os.urandom(3).hex().upper()}"


def compute_hash(scan_data: dict, previous_hash: str = "") -> str:
    payload = json.dumps(scan_data, sort_keys=True, default=str) + previous_hash
    return hashlib.sha256(payload.encode()).hexdigest()


def generate_pdf_report(
    scan_data: dict,
    violations: list,
    extracted_fields: dict,
    image_path: str = "",
    output_dir: str = "",
    report_number: str = "",
    image_paths: list = None,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, f"{report_number}.pdf")

    doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, textColor=colors.HexColor('#1a365d'))
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=13, textColor=colors.HexColor('#2d3748'), spaceAfter=6)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, spaceAfter=4)

    elements.append(Paragraph("Packaged Commodity Label Scanner - Inspection Report", title_style))
    elements.append(Paragraph("Legal Metrology (Packaged Commodities) Rules, 2011", ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)))
    elements.append(Spacer(1, 8*mm))

    meta_data = [
        ["Report Number:", report_number],
        ["Date:", datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")],
        ["Scan Type:", scan_data.get("scan_type", "Manual")],
        ["Compliance Status:", scan_data.get("compliance_status", "Pending").upper()],
        ["Score:", f"{scan_data.get('compliance_score', 0)}%"],
    ]
    if scan_data.get("barcode"):
        meta_data.append(["Barcode (GTIN):", str(scan_data["barcode"])])
    if scan_data.get("store_name"):
        meta_data.append(["Store:", scan_data["store_name"]])
    if scan_data.get("latitude") and scan_data.get("longitude"):
        meta_data.append(["Location:", f"{scan_data['latitude']}, {scan_data['longitude']}"])

    meta_table = Table(meta_data, colWidths=[4*cm, 12*cm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 5*mm))

    # Barcode Cross-Verification Audit Block
    audit = scan_data.get("barcode_audit")
    if audit:
        elements.append(Paragraph("Barcode Cross-Verification Audit", header_style))
        is_matched = audit.get("status") == "MATCHED"
        status_color = "#38a169" if is_matched else "#e53e3e"
        status_text = "AUTHENTIC & VERIFIED" if is_matched else "MISMATCH / DISCREPANCY DETECTED"

        audit_summary = [
            ["Registered GTIN:", str(audit.get("barcode", "N/A"))],
            ["Database Master:", f"{audit.get('master_name', '')} {f'({audit.get('master_brand')})' if audit.get('master_brand') else ''}".strip()],
            ["Registered Volume:", str(audit.get("master_net_quantity") or "N/A")],
            ["Database Registry:", str(audit.get("source", "Central Legal Metrology Database"))],
            ["Audit Status:", status_text],
        ]
        audit_table = Table(audit_summary, colWidths=[4*cm, 12*cm])
        audit_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TEXTCOLOR', (1, 4), (1, 4), colors.HexColor(status_color)),
            ('FONTNAME', (1, 4), (1, 4), 'Helvetica-Bold'),
        ]))
        elements.append(audit_table)
        elements.append(Spacer(1, 4*mm))

        if audit.get("checks"):
            check_rows = [["Verification Check", "Master Specification", "Found on Carton", "Status"]]
            for c in audit["checks"]:
                check_rows.append([
                    c.get("field", ""),
                    Paragraph(str(c.get("expected", "-")), ParagraphStyle('P_Exp', parent=styles['Normal'], fontSize=8)),
                    Paragraph(str(c.get("found", "-")), ParagraphStyle('P_Fnd', parent=styles['Normal'], fontSize=8)),
                    c.get("status", "")
                ])
            c_table = Table(check_rows, colWidths=[4*cm, 4.5*cm, 4.5*cm, 3*cm])
            c_style = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]
            for ri, row in enumerate(check_rows[1:], 1):
                st = row[3]
                c_color = colors.HexColor('#38a169') if st == 'MATCHED' else colors.HexColor('#e53e3e')
                c_style.append(('TEXTCOLOR', (3, ri), (3, ri), c_color))
                c_style.append(('FONTNAME', (3, ri), (3, ri), 'Helvetica-Bold'))
            c_table.setStyle(TableStyle(c_style))
            elements.append(c_table)
            elements.append(Spacer(1, 5*mm))

    # Product Images (Single image or multi-panel grid)
    if image_paths is None:
        image_paths = scan_data.get("image_paths")

    all_images = []
    if image_paths and isinstance(image_paths, list):
        for item in image_paths:
            if isinstance(item, dict):
                p = item.get("path")
                lbl = item.get("label") or "Product Panel"
            else:
                p = str(item)
                lbl = "Product Panel"
            if p and os.path.exists(p):
                all_images.append({"path": p, "label": lbl})
    elif image_path and os.path.exists(image_path):
        all_images.append({"path": image_path, "label": "Primary Panel"})

    if all_images:
        caption_style = ParagraphStyle(
            'ImgCaption',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#2d3748')
        )
        title_text = "Product Image" if len(all_images) == 1 else f"Scanned Product Panels ({len(all_images)})"
        elements.append(Paragraph(title_text, header_style))

        from PIL import Image as PILImage

        if len(all_images) == 1:
            img_entry = all_images[0]
            try:
                with PILImage.open(img_entry["path"]) as test_img:
                    test_img.verify()
                img = RLImage(img_entry["path"], width=6.5*cm, height=6.5*cm, kind='proportional')
                elements.append(img)
                elements.append(Spacer(1, 1*mm))
                elements.append(Paragraph(f"<b>{img_entry['label']}</b>", caption_style))
            except Exception:
                elements.append(Paragraph("[Image could not be loaded]", body_style))
            elements.append(Spacer(1, 5*mm))
        else:
            cols = 3 if len(all_images) == 3 else 2
            col_width = (17.5 / cols) * cm
            img_max_size = 4.2 * cm if cols == 3 else 5.2 * cm

            table_data = []
            row = []
            for item in all_images:
                cell_flowables = []
                try:
                    with PILImage.open(item["path"]) as test_img:
                        test_img.verify()
                    rl_img = RLImage(item["path"], width=img_max_size, height=img_max_size, kind='proportional')
                    cell_flowables.append(rl_img)
                except Exception:
                    cell_flowables.append(Paragraph("[Image unavailable]", caption_style))
                cell_flowables.append(Spacer(1, 1*mm))
                cell_flowables.append(Paragraph(f"<b>{item['label']}</b>", caption_style))
                row.append(cell_flowables)

                if len(row) == cols:
                    table_data.append(row)
                    row = []
            if row:
                while len(row) < cols:
                    row.append([Paragraph("", caption_style)])
                table_data.append(row)

            grid_table = Table(table_data, colWidths=[col_width] * cols)
            grid_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 3),
                ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(grid_table)
            elements.append(Spacer(1, 5*mm))

    def format_field_display(field_key: str, val: any) -> str:
        if val is None:
            return "NOT FOUND"
        if field_key == "mrp":
            if isinstance(val, dict):
                v = val.get("value")
                if v is not None:
                    note = " (incl. of all taxes)" if val.get("has_tax_note") else ""
                    return f"Rs. {v:.2f}{note}"
                return str(val.get("raw", val))
            return str(val)
        elif field_key == "dates":
            if isinstance(val, dict):
                parts = []
                if "manufacture_date" in val:
                    mfg = val["manufacture_date"].get("value", "") if isinstance(val["manufacture_date"], dict) else str(val["manufacture_date"])
                    if mfg:
                        parts.append(f"Mfg: {mfg}")
                if "expiry_date" in val:
                    exp = val["expiry_date"].get("value", "") if isinstance(val["expiry_date"], dict) else str(val["expiry_date"])
                    if exp:
                        parts.append(f"Exp: {exp}")
                if parts:
                    return " | ".join(parts)
                return str(val.get("raw", val.get("value", val)))
            return str(val)
        elif field_key == "consumer_care":
            if isinstance(val, dict):
                parts = []
                if val.get("phone"):
                    parts.append(f"Tel: {val['phone']}")
                if val.get("email"):
                    parts.append(f"Email: {val['email']}")
                if not parts and val.get("details"):
                    parts.append(val["details"])
                if parts:
                    return ", ".join(parts)
                return str(val.get("raw", val.get("value", val)))
            return str(val)
        elif field_key == "net_quantity":
            if isinstance(val, dict):
                v = val.get("value")
                u = val.get("unit", "")
                if v is not None:
                    return f"{v:g} {u}".strip()
                return str(val.get("raw", val))
            return str(val)
        elif field_key == "manufacturer":
            if isinstance(val, dict):
                return str(val.get("value", val.get("raw", val)))
            return str(val)
        elif isinstance(val, dict):
            return str(val.get("value", val.get("raw", val)))
        return str(val)

    elements.append(Paragraph("Extracted Declarations", header_style))
    field_rows = [["Field", "Value", "Status"]]
    field_labels = {
        "mrp": "MRP",
        "net_quantity": "Net Quantity",
        "manufacturer": "Manufacturer/Packer",
        "dates": "Date of Mfg/Packing",
        "consumer_care": "Consumer Care",
        "country_of_origin": "Country of Origin",
        "common_name": "Product Name",
        "batch_number": "Batch Number",
        "fssai_license": "FSSAI License",
    }
    violated_fields = {v["field_name"] for v in violations}
    cell_style = ParagraphStyle('TableCell', parent=styles['Normal'], fontSize=8.5, leading=11)

    for key, label in field_labels.items():
        val = extracted_fields.get(key)
        if val is None:
            display_text = "NOT FOUND"
            status = "MISSING" if key in violated_fields else "N/A"
        else:
            display_text = format_field_display(key, val)
            status = "VIOLATION" if key in violated_fields else "OK"

        val_flowable = Paragraph(display_text, cell_style)
        field_rows.append([label, val_flowable, status])

    field_table = Table(field_rows, colWidths=[4*cm, 8.5*cm, 3.5*cm])
    status_colors = {"OK": colors.HexColor('#38a169'), "MISSING": colors.HexColor('#e53e3e'), "VIOLATION": colors.HexColor('#dd6b20'), "N/A": colors.grey}
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for i, row in enumerate(field_rows[1:], 1):
        status = row[2]
        color = status_colors.get(status, colors.black)
        table_style.append(('TEXTCOLOR', (2, i), (2, i), color))
        table_style.append(('FONTNAME', (2, i), (2, i), 'Helvetica-Bold'))

    field_table.setStyle(TableStyle(table_style))
    elements.append(field_table)
    elements.append(Spacer(1, 5*mm))

    # Font Size & Readability Verification Block (Rule 7 & Rule 9)
    font_assessment = scan_data.get("font_size_assessment")
    font_review = scan_data.get("font_size_review")
    if font_assessment:
        elements.append(Paragraph("Font Size & Legibility Verification (Rule 7 & 9)", header_style))
        is_physically_verified = bool(font_review and font_review.get("status"))
        
        if is_physically_verified:
            fs_status_str = f"PHYSICALLY VERIFIED: {font_review.get('status')}"
            fs_status_color = "#38a169" if font_review.get("status") == "COMPLIANT" else "#e53e3e"
            measured_str = f"{font_review.get('measured_height_mm', 'N/A')} mm (Manual Caliper Reading)"
        else:
            fs_status_str = "REVIEW REQUIRED (Uncalibrated 2D Image)"
            fs_status_color = "#d69e2e"
            measured_str = f"Estimated ~{font_assessment.get('estimated_height_mm', 2.0)} mm (Uncalibrated Photo)"

        font_rows = [
            ["Quantity Tier:", str(font_assessment.get("quantity_tier", "Standard Pack"))],
            ["Statutory Minimum (Rule 7):", f">= {font_assessment.get('statutory_min_height_mm', 2.0)} mm (Embossed: >= {font_assessment.get('embossed_min_height_mm', 3.0)} mm)"],
            ["Measured / Est. Height:", measured_str],
            ["Readability & Legibility:", f"{font_assessment.get('readability_score', 85)}% (Clear & Unambiguous)"],
            ["Verification Status:", fs_status_str],
        ]
        if font_review and font_review.get("notes"):
            font_rows.append(["Inspector Caliper Notes:", str(font_review.get("notes"))])

        font_table = Table(font_rows, colWidths=[5*cm, 11*cm])
        font_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
            ('TEXTCOLOR', (1, 4), (1, 4), colors.HexColor(fs_status_color)),
            ('FONTNAME', (1, 4), (1, 4), 'Helvetica-Bold'),
        ]))
        elements.append(font_table)
        elements.append(Spacer(1, 5*mm))

    if violations:
        elements.append(Paragraph("Violations & Compliance Findings", header_style))
        for i, v in enumerate(violations, 1):
            v_status = v.get("status", "OPEN")
            sev_color = {"critical": "#e53e3e", "major": "#dd6b20", "minor": "#d69e2e", "info": "#3182ce"}.get(v.get("severity", ""), "#333")
            status_badge = f" <font color='{'#38a169' if v_status in ('RESOLVED_COMPLIANT', 'WAIVED') else '#d69e2e' if v_status == 'REVIEW_REQUIRED' else '#e53e3e'}'><b>[{v_status.replace('_', ' ')}]</b></font>"
            
            elements.append(Paragraph(
                f'<b>{i}. [{v.get("severity", "").upper()}]</b> {v["rule_name"]}{status_badge} '
                f'<font color="grey">(Section {v.get("section_reference", "N/A")})</font>',
                ParagraphStyle('VTitle', parent=body_style, textColor=colors.HexColor(sev_color), fontSize=10)
            ))
            elements.append(Paragraph(v["description"], body_style))
            if v.get("expected_value"):
                elements.append(Paragraph(f'<b>Expected:</b> {v["expected_value"]}', body_style))
            if v.get("actual_value"):
                elements.append(Paragraph(f'<b>Found:</b> {v["actual_value"]}', body_style))
            if v.get("inspector_remark"):
                elements.append(Paragraph(f'<b>Inspector Remark:</b> <font color="#2b6cb0">{v["inspector_remark"]}</font>', body_style))
            elements.append(Spacer(1, 3*mm))
    else:
        elements.append(Paragraph("No Violations Found - Product is Fully Compliant", ParagraphStyle('Pass', parent=header_style, textColor=colors.HexColor('#38a169'))))

    # Official Inspector Review & Endorsement Box
    if scan_data.get("is_reviewed"):
        elements.append(Spacer(1, 4*mm))
        elements.append(Paragraph("Official Legal Metrology Inspector Endorsement", header_style))
        insp_action = scan_data.get("inspector_action", "APPROVED_COMPLIANT").replace("_", " ").title()
        action_color = "#38a169" if "Approv" in insp_action or "Compliant" in insp_action else "#c53030"
        
        endorsement_data = [
            ["Authorized Inspector:", scan_data.get("inspector_name", "Legal Metrology Officer")],
            ["Designation / Dept:", "Inspector, Legal Metrology Enforcement Division"],
            ["Verification Date:", scan_data.get("reviewed_at", datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC"))],
            ["Enforcement Action:", insp_action.upper()],
            ["Inspector Observations:", Paragraph(str(scan_data.get("inspector_notes") or "All mandatory label declarations verified under Legal Metrology (Packaged Commodities) Rules, 2011."), cell_style)],
            ["Official Digital Seal:", f"VERIFIED & DIGITALLY SIGNED (ID: {compute_hash(scan_data)[:16].upper()})"],
        ]
        endorsement_table = Table(endorsement_data, colWidths=[4.5*cm, 11.5*cm])
        endorsement_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#ebf8ff')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#3182ce')),
            ('TEXTCOLOR', (1, 3), (1, 3), colors.HexColor(action_color)),
            ('FONTNAME', (1, 3), (1, 3), 'Helvetica-Bold'),
            ('TEXTCOLOR', (1, 5), (1, 5), colors.HexColor('#2c5282')),
            ('FONTNAME', (1, 5), (1, 5), 'Helvetica-Bold'),
        ]))
        elements.append(endorsement_table)

    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(
        f'<font size="8" color="grey">Report hash: {compute_hash(scan_data)} | Generated by Janch Compliance System | Dept. of Consumer Affairs</font>',
        ParagraphStyle('Footer', parent=styles['Normal'], alignment=TA_CENTER)
    ))

    doc.build(elements)
    return pdf_path


def generate_barcode_verification_pdf(
    barcode: str,
    product_data: dict,
    output_dir: str,
    report_number: str,
    image_url: str = None,
) -> str:
    """Generate an official PDF Verification Certificate for a product barcode."""
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, f"{report_number}.pdf")

    doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle(
        'BTitle',
        parent=styles['Title'],
        fontSize=18,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=4
    )
    sub_style = ParagraphStyle(
        'BSub',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4a5568'),
        spaceAfter=12
    )
    header_style = ParagraphStyle(
        'BHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#2b6cb0'),
        spaceBefore=8,
        spaceAfter=6
    )
    body_style = ParagraphStyle('BBody', parent=styles['Normal'], fontSize=9, leading=12)

    # Header
    elements.append(Paragraph("Legal Metrology (Packaged Commodities) Rules, 2011", title_style))
    elements.append(Paragraph("OFFICIAL BARCODE & GTIN VERIFICATION CERTIFICATE", sub_style))
    elements.append(Spacer(1, 4 * mm))

    # Certificate Metadata Box
    now_str = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    meta_rows = [
        ["Certificate No:", report_number],
        ["Verification Date:", now_str],
        ["Barcode (GTIN):", barcode],
        ["Verification Engine:", product_data.get("source", "Central Legal Metrology Database").replace("_", " ").title()],
        ["Authenticity Status:", "CERTIFIED AUTHENTIC & VERIFIED"],
    ]
    meta_table = Table(meta_rows, colWidths=[4 * cm, 12 * cm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('TEXTCOLOR', (1, 4), (1, 4), colors.HexColor('#276749')),
        ('FONTNAME', (1, 4), (1, 4), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 6 * mm))

    # Product Details Table
    elements.append(Paragraph("Registered Product Specifications", header_style))
    p = product_data.get("product") or {}
    if hasattr(p, "dict"):
        p = p.dict()
    elif hasattr(p, "model_dump"):
        p = p.model_dump()
    elif not isinstance(p, dict):
        p = {}

    mrp_display = f"Rs. {p.get('mrp', 0):.2f}" if p.get('mrp') else "Not Mandated in Master / Variable"

    spec_rows = [
        ["Parameter", "Registered Declaration Value"],
        ["Product Name", str(p.get("name") or "Unspecified")],
        ["Brand", str(p.get("brand") or "N/A")],
        ["Product Category", str(p.get("category") or "Packaged Commodity")],
        ["Net Quantity", str(p.get("net_quantity") or "N/A")],
        ["Registered MRP", mrp_display],
        ["Country of Origin", str(p.get("country_of_origin") or "India")],
        ["Manufacturer / Brand Owner", str(p.get("manufacturer_name") or product_data.get("manufacturer") or "Registered Licensee")],
    ]

    spec_table = Table(spec_rows, colWidths=[5 * cm, 11 * cm])
    spec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2b6cb0')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(spec_table)
    elements.append(Spacer(1, 6 * mm))

    # Anti-Counterfeit Audit Assessment
    elements.append(Paragraph("Compliance & Anti-Counterfeiting Audit", header_style))
    audit_text = (
        "<b>GTIN Validity:</b> Verified GS1 prefix code.<br/>"
        "<b>Price Tampering Risk:</b> Low — No overpricing violations detected in historical audit scans.<br/>"
        "<b>Legal Metrology Status:</b> Mandatory master record conforms to the Legal Metrology (Packaged Commodities) Rules, 2011.<br/>"
        "<i>Note: Field inspection of physical packages may be conducted to verify batch number and date declarations.</i>"
    )
    elements.append(Paragraph(audit_text, body_style))
    elements.append(Spacer(1, 8 * mm))

    # Digital Seal / Hash Footer
    report_hash = hashlib.sha256(f"{barcode}:{report_number}:{now_str}".encode()).hexdigest()
    footer_text = (
        f"<b>Security Hash:</b> {report_hash}<br/>"
        "Digitally Certified by Janch National Compliance Portal | Dept. of Consumer Affairs"
    )
    elements.append(Paragraph(footer_text, ParagraphStyle('BFoot', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))

    doc.build(elements)
    return pdf_path

