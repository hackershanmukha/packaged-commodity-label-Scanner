import hashlib
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT


def generate_notice_number(scan_id: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    id_part = f"{scan_id}" if scan_id else os.urandom(2).hex().upper()
    rand_suffix = os.urandom(2).hex().upper()
    return f"LM/ENF/SCN/{now.strftime('%Y%m%d')}/{id_part}{rand_suffix[:2]}"


def compute_notice_hash(notice_data: dict) -> str:
    payload = json.dumps(notice_data, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def generate_show_cause_notice(
    scan_data: dict,
    violations: List[dict],
    extracted_fields: dict,
    output_dir: str,
    notice_number: Optional[str] = None,
    inspector_name: Optional[str] = None,
    deadline_days: int = 15,
) -> str:
    """
    Generate statutory Rule 32 Show-Cause Notice in exact official format:
    - Ministry Header & Notice Ref/Date
    - TO: Manufacturer & Retailer
    - STATUTORY SHOW-CAUSE NOTICE UNDER RULE 32
    - Product / Commodity particulars table
    - Itemized Contraventions table (Sl, Statutory Provision, Nature of Contravention, Legal Consequence)
    - NOW THEREFORE 15-day summon & compounding under Sec 48
    - Issued by signature & Janch National Portal hash footer
    """
    os.makedirs(output_dir, exist_ok=True)
    scan_id = scan_data.get("scan_id") or scan_data.get("id") or 1
    if not notice_number:
        notice_number = f"LM/ENF/SCN/{datetime.now(timezone.utc).strftime('%Y%m%d')}/{scan_id}B"

    pdf_filename = f"{notice_number.replace('/', '_')}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
    )

    styles = getSampleStyleSheet()

    # --- Typography Styles ---
    h1_style = ParagraphStyle(
        'H1_Govt',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a'),
    )
    h2_style = ParagraphStyle(
        'H2_Ministry',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a'),
    )
    h3_style = ParagraphStyle(
        'H3_Dept',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#475569'),
    )
    title_red = ParagraphStyle(
        'TitleRed',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#8b1e1e'),
        spaceBefore=6,
        spaceAfter=4,
    )
    subject_style = ParagraphStyle(
        'SubjectStyle',
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        'NoticeBody',
        fontName='Helvetica',
        fontSize=8.5,
        leading=13,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4,
    )
    meta_label = ParagraphStyle(
        'MetaLabel',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0f172a'),
    )
    meta_val = ParagraphStyle(
        'MetaVal',
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b'),
    )
    table_hdr = ParagraphStyle(
        'TableHdr',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        alignment=TA_LEFT,
        textColor=colors.white,
    )
    cell_text = ParagraphStyle(
        'CellText',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#0f172a'),
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#0f172a'),
    )
    sig_style = ParagraphStyle(
        'SigStyle',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=TA_LEFT,
        textColor=colors.HexColor('#0f172a'),
    )
    footer_style = ParagraphStyle(
        'FooterStyle',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),
    )

    elements = []

    # 1. Header
    elements.append(Paragraph("GOVERNMENT OF INDIA", h1_style))
    elements.append(Paragraph("MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION", h2_style))
    elements.append(Paragraph("DEPARTMENT OF CONSUMER AFFAIRS — LEGAL METROLOGY DIVISION", h3_style))
    elements.append(Paragraph("OFFICE OF THE CONTROLLER OF LEGAL METROLOGY", h3_style))
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1e293b'), spaceBefore=2, spaceAfter=5))

    # 2. Notice No & Date
    now_utc = datetime.now(timezone.utc)
    issue_date_str = now_utc.strftime("%d %B %Y")
    deadline_date_str = (now_utc + timedelta(days=deadline_days)).strftime("%d %B %Y")

    ref_table = Table(
        [
            [
                Paragraph(f"<b>Notice No:</b> {notice_number}", meta_val),
                Paragraph(f"<b>Date of Issue:</b> {issue_date_str}", ParagraphStyle('RDate', parent=meta_val, alignment=TA_RIGHT)),
            ]
        ],
        colWidths=[10.5 * cm, 7.5 * cm]
    )
    ref_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(ref_table)
    elements.append(Spacer(1, 2 * mm))

    # 3. TO Block
    mfg_info = extracted_fields.get("manufacturer") or {}
    violator_name = (
        mfg_info.get("value")
        or scan_data.get("manufacturer_name")
        or (scan_data.get("barcode_audit") or {}).get("master_name")
        or "M/s MFD: 'Packaged Commodity Brand Owner'"
    )
    clean_violator = violator_name.replace('\n', ', ')

    store_name = scan_data.get("store_name") or "Retail Establishment"
    store_loc = scan_data.get("store_address") or "Inspection Location"

    to_markup = (
        "<b>TO:</b><br/>"
        f"<b>1. M/s {clean_violator}</b> (Manufacturer / Packer / Brand Owner)<br/>"
        f"<b>2. M/s {store_name}, {store_loc}</b> (Retailer / Person in Possession)"
    )
    elements.append(Paragraph(to_markup, body_style))
    elements.append(Spacer(1, 3 * mm))

    # 4. Red Title
    elements.append(Paragraph("STATUTORY SHOW-CAUSE NOTICE UNDER RULE 32", title_red))
    elements.append(Spacer(1, 1 * mm))

    # 5. Subject
    subject_markup = (
        "<b>SUBJECT:</b> Notice for Contravention of the Legal Metrology (Packaged Commodities) Rules, 2011 read with "
        "Sections 18 and 36 of the Legal Metrology Act, 2009 regarding non-compliant packaging declarations."
    )
    elements.append(Paragraph(subject_markup, subject_style))
    elements.append(Spacer(1, 1.5 * mm))

    # 6. WHEREAS Clause 1
    inspect_date = scan_data.get("created_at") or issue_date_str
    if len(inspect_date) > 10 and "-" in inspect_date[:10]:
        try:
            inspect_date = datetime.strptime(inspect_date[:10], "%Y-%m-%d").strftime("%d %B %Y")
        except Exception:
            pass

    whereas1 = (
        f"WHEREAS, during an official inspection conducted by the authorized Legal Metrology Inspector on {inspect_date} "
        f"at the premises of M/s {store_name}, packages of the commodity detailed hereunder were examined for statutory "
        "compliance under the provisions of the Legal Metrology (Packaged Commodities) Rules, 2011."
    )
    elements.append(Paragraph(whereas1, body_style))
    elements.append(Spacer(1, 2 * mm))

    # 7. Product Particulars Table
    prod_name = extracted_fields.get("common_name") or scan_data.get("product_name") or "Packaged Commodity"
    barcode_val = scan_data.get("barcode") or scan_data.get("barcode_detected") or "N/A"
    
    # Net quantity
    net_qty_raw = (extracted_fields.get("net_quantity") or {}).get("raw")
    if not net_qty_raw:
        nq = extracted_fields.get("net_quantity")
        net_qty_raw = f"{nq.get('value', '')} {nq.get('unit', '')}".strip() if isinstance(nq, dict) else (str(nq) if nq else "N/A")

    # MRP
    mrp_raw = (extracted_fields.get("mrp") or {}).get("raw")
    if not mrp_raw:
        m = extracted_fields.get("mrp")
        mrp_raw = f"Rs. {m.get('value', 0):.2f}" if isinstance(m, dict) and m.get('value') else (str(m) if m else "N/A")

    scan_ref = f"SCN-SCAN-{scan_id}"

    product_table_data = [
        [Paragraph("Product / Commodity Name:", meta_label), Paragraph(str(prod_name), meta_val)],
        [Paragraph("Barcode (GTIN):", meta_label), Paragraph(str(barcode_val), meta_val)],
        [Paragraph("Declared Net Quantity:", meta_label), Paragraph(str(net_qty_raw), meta_val)],
        [Paragraph("Declared Retail Price (MRP):", meta_label), Paragraph(str(mrp_raw), meta_val)],
        [Paragraph("Scan Reference ID:", meta_label), Paragraph(str(scan_ref), meta_val)],
    ]

    prod_table = Table(product_table_data, colWidths=[6.0 * cm, 12.0 * cm])
    prod_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 3 * mm))

    # 8. AND WHEREAS Clause 2
    whereas2 = (
        "AND WHEREAS, upon physical inspection and verification against the central statutory standards, the following specific "
        "contraventions of law have been recorded:"
    )
    elements.append(Paragraph(whereas2, body_style))
    elements.append(Spacer(1, 2 * mm))

    # 9. Contraventions Table
    contra_data = [
        [
            Paragraph("<b>Sl.</b>", table_hdr),
            Paragraph("<b>Statutory Provision</b>", table_hdr),
            Paragraph("<b>Nature of Contravention</b>", table_hdr),
            Paragraph("<b>Legal Consequence</b>", table_hdr),
        ]
    ]

    if violations and len(violations) > 0:
        for idx, v in enumerate(violations, 1):
            rule_ref = v.get("section_reference") or v.get("rule_code") or "Rule 6"
            rule_title = v.get("rule_name") or "Mandatory Declaration"
            prov_cell = f"<b>{rule_ref}</b><br/>{rule_title}"

            desc = v.get("description") or "Mandatory packaging declaration missing or non-compliant."
            status_prefix = "MISSING: " if "missing" in desc.lower() else ("REVIEW REQUIRED: " if "review" in desc.lower() else "")
            if status_prefix and desc.lower().startswith(status_prefix.lower()):
                clean_desc = desc
            else:
                clean_desc = f"{status_prefix}{desc}" if status_prefix else desc

            exp = v.get("expected_value") or "Present on label"
            fnd = v.get("actual_value") or "Not found"

            nature_cell = (
                f"{clean_desc}<br/>"
                f"<b>Expected:</b> {exp}<br/>"
                f"<b>Found:</b> {fnd}"
            )

            consequence_cell = "Offence punishable under<br/>Sec 36(1) of LM Act, 2009"

            contra_data.append([
                Paragraph(str(idx), cell_text),
                Paragraph(prov_cell, cell_text),
                Paragraph(nature_cell, cell_text),
                Paragraph(consequence_cell, cell_text),
            ])
    else:
        contra_data.append([
            Paragraph("1", cell_text),
            Paragraph("<b>Rule 6(1)</b><br/>Mandatory Declaration", cell_text),
            Paragraph("MISSING: Mandatory declarations required on packaged commodity.<br/><b>Expected:</b> Present on label<br/><b>Found:</b> Not found", cell_text),
            Paragraph("Offence punishable under<br/>Sec 36(1) of LM Act, 2009", cell_text),
        ])

    contra_table = Table(contra_data, colWidths=[1.0 * cm, 4.8 * cm, 7.7 * cm, 4.5 * cm], repeatRows=1)
    contra_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#701A1A')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(contra_table)
    elements.append(Spacer(1, 4 * mm))

    # 10. Conclusion Block (NOW THEREFORE & Compounding)
    conclusion_elements = []

    now_therefore = (
        f"NOW THEREFORE, you are hereby called upon to <b>SHOW CAUSE</b> within <b>15 (fifteen) days</b> from the receipt of this notice "
        f"(i.e. on or before <b>{deadline_date_str}</b>), as to why prosecution proceedings should not be initiated against you under "
        f"<b>Section 36 of the Legal Metrology Act, 2009</b> (punishable with fine up to <b>Rs. 25,000/-</b> for first offence, <b>Rs. 50,000/-</b> for "
        f"second offence, and imprisonment for subsequent offences)."
    )
    conclusion_elements.append(Paragraph(now_therefore, body_style))
    conclusion_elements.append(Spacer(1, 3 * mm))

    compounding = (
        "You are further afforded an opportunity to apply for <b>Compounding of Offence</b> under Section 48 of the Act by depositing "
        "the prescribed compounding fees, failing which legal proceedings in the competent Court of Law shall be instituted "
        "without further notice."
    )
    conclusion_elements.append(Paragraph(compounding, body_style))
    conclusion_elements.append(Spacer(1, 6 * mm))

    # 11. Issued by Signature Block
    officer_name = inspector_name or scan_data.get("inspector_name") or "harsh"
    sig_block = (
        "<b>Issued by:</b><br/>"
        f"<b>{officer_name}</b><br/>"
        "Inspector of Legal Metrology<br/>"
        "Enforcement & Standards Division<br/>"
        "Dept. of Consumer Affairs"
    )

    sig_table = Table(
        [
            ["", Paragraph(sig_block, sig_style)]
        ],
        colWidths=[10.5 * cm, 7.5 * cm]
    )
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    conclusion_elements.append(sig_table)
    conclusion_elements.append(Spacer(1, 8 * mm))

    # 12. Footer with Hash
    notice_hash = compute_notice_hash({
        "notice_number": notice_number,
        "issue_date": issue_date_str,
        "violator": clean_violator,
        "violations": len(violations),
        "deadline": deadline_date_str,
    })

    footer_text = f"Statutory Notice Hash: {notice_hash} | Digitally generated via Janch National Portal"
    conclusion_elements.append(Paragraph(footer_text, footer_style))

    elements.append(KeepTogether(conclusion_elements))

    doc.build(elements)
    return pdf_path
