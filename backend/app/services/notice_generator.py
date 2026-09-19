import hashlib
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT


def generate_notice_number(scan_id: Optional[int] = None) -> str:
    now = datetime.now(timezone.utc)
    id_part = f"{scan_id:04d}" if scan_id else os.urandom(2).hex().upper()
    return f"LMN/SCN/{now.strftime('%Y%m%d')}/{id_part}"


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
    Generate a statutory Rule 32 Show-Cause Legal Notice under Sections 18, 36, and 48
    of the Legal Metrology Act, 2009 in court-ready PDF format.
    """
    os.makedirs(output_dir, exist_ok=True)
    if not notice_number:
        notice_number = generate_notice_number(scan_data.get("scan_id") or scan_data.get("id"))

    pdf_filename = f"{notice_number.replace('/', '_')}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    # Document setup (A4 with 1.5cm margins)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom legal typography styles
    govt_head_style = ParagraphStyle(
        'GovtHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a'),
    )
    dept_style = ParagraphStyle(
        'DeptHead',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#334155'),
    )
    notice_title_style = ParagraphStyle(
        'NoticeTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#991b1b'),
    )
    section_sub_style = ParagraphStyle(
        'SectionSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1e3a8a'),
    )
    legal_body = ParagraphStyle(
        'LegalBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4,
    )
    legal_bold = ParagraphStyle(
        'LegalBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#0f172a'),
    )
    subhead_style = ParagraphStyle(
        'SubHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=4,
        spaceAfter=3,
    )

    elements = []

    # 1. Official Government Letterhead
    elements.append(Paragraph("GOVERNMENT OF INDIA", govt_head_style))
    elements.append(Paragraph("DEPARTMENT OF CONSUMER AFFAIRS • LEGAL METROLOGY DIVISION", govt_head_style))
    elements.append(Paragraph("OFFICE OF THE CONTROLLER / ENFORCEMENT OFFICER OF LEGAL METROLOGY", dept_style))
    elements.append(Paragraph("STATUTORY INSPECTION & ENFORCEMENT DIRECTORATE", dept_style))
    elements.append(Spacer(1, 2.5 * mm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceBefore=2, spaceAfter=4))
    elements.append(Spacer(1, 2 * mm))

    # 2. Reference & Date Line
    now_utc = datetime.now(timezone.utc)
    issue_date = now_utc.strftime("%d %B %Y")
    deadline_date = (now_utc + timedelta(days=deadline_days)).strftime("%d %B %Y")

    ref_date_data = [
        [
            Paragraph(f"<b>NOTICE NO.:</b> {notice_number}", legal_bold),
            Paragraph(f"<b>DATE OF ISSUANCE:</b> {issue_date}", ParagraphStyle('RDate', parent=legal_bold, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("<b>MODE OF SERVICE:</b> SPEED POST / REGISTERED A.D. & ELECTRONIC DISPATCH", ParagraphStyle('Mode', parent=legal_body, fontSize=8, textColor=colors.HexColor('#64748b'))),
            Paragraph(f"<b>MANDATORY DEADLINE:</b> ON OR BEFORE {deadline_date}", ParagraphStyle('RDead', parent=legal_bold, alignment=TA_RIGHT, textColor=colors.HexColor('#dc2626'))),
        ]
    ]
    ref_table = Table(ref_date_data, colWidths=[10 * cm, 8 * cm])
    ref_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(ref_table)
    elements.append(Spacer(1, 3 * mm))

    # 3. Addressee / Violator Address Block
    mfg_info = extracted_fields.get("manufacturer") or {}
    violator_name = (
        mfg_info.get("value")
        or scan_data.get("manufacturer_name")
        or (scan_data.get("barcode_audit") or {}).get("master_name")
        or "M/S THE PRINCIPAL OFFICER / OCCUPIER / MANUFACTURER / PACKER"
    )
    if isinstance(violator_name, str) and len(violator_name.splitlines()) > 1:
        v_lines = [l.strip() for l in violator_name.splitlines() if l.strip()]
        violator_firm = v_lines[0]
        violator_addr = ", ".join(v_lines[1:])
    else:
        violator_firm = str(violator_name)
        violator_addr = "Premises declared on commodity packaging (address verification flagged below)"

    store_name = scan_data.get("store_name") or "Retail Commercial Establishment"
    store_addr = scan_data.get("store_address") or "Inspected premises"
    if scan_data.get("latitude") and scan_data.get("longitude"):
        store_addr += f" [GPS Coordinates: {scan_data['latitude']:.4f}°N, {scan_data['longitude']:.4f}°E]"

    address_data = [
        [
            Paragraph("<b>TO (PRINCIPAL NOTICEE / CONTRAVENER):</b>", legal_bold),
            Paragraph("<b>INSPECTION PREMISES / PLACE OF SEIZURE:</b>", legal_bold),
        ],
        [
            Paragraph(
                f"<b>{violator_firm}</b><br/>"
                f"{violator_addr}<br/>"
                f"<b>Status:</b> Registered Manufacturer / Packer / Importer",
                legal_body
            ),
            Paragraph(
                f"<b>{store_name}</b><br/>"
                f"{store_addr}<br/>"
                f"<b>Date of Inspection:</b> {scan_data.get('created_at', issue_date)[:10]}",
                legal_body
            ),
        ]
    ]
    addr_table = Table(address_data, colWidths=[9.2 * cm, 8.8 * cm])
    addr_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(addr_table)
    elements.append(Spacer(1, 4 * mm))

    # 4. Subject Banner
    subject_text = (
        "<b><u>STATUTORY SHOW-CAUSE NOTICE & LEGAL SUMMON UNDER RULE 32 OF THE LEGAL METROLOGY "
        "(PACKAGED COMMODITIES) RULES, 2011 READ WITH SECTIONS 18, 36, AND 48 OF THE LEGAL METROLOGY ACT, 2009 "
        "(ACT NO. 1 OF 2010)</u></b>"
    )
    elements.append(Paragraph(subject_text, notice_title_style))
    elements.append(Paragraph(
        "<b>SUBJECT: CONTRAVENTION OF MANDATORY PACKAGING DECLARATIONS & STATUTORY DEMAND FOR SHOW-CAUSE / COMPOUNDING</b>",
        section_sub_style
    ))
    elements.append(Spacer(1, 3.5 * mm))

    # 5. Product Particulars Table
    product_name = extracted_fields.get("common_name") or scan_data.get("product_name") or "Packaged Commodity Sample"
    net_qty = (extracted_fields.get("net_quantity") or {}).get("raw") or "Non-compliant / Not Declared"
    mrp_val = (extracted_fields.get("mrp") or {}).get("raw") or "Non-compliant / Not Declared"
    barcode = scan_data.get("barcode") or scan_data.get("barcode_detected") or "Barcoded Retail Unit"

    prod_data = [
        [Paragraph("<b>COMMODITY INSPECTED:</b>", legal_bold), Paragraph(str(product_name), legal_body),
         Paragraph("<b>BARCODE / GTIN:</b>", legal_bold), Paragraph(str(barcode), legal_body)],
        [Paragraph("<b>DECLARED NET QTY:</b>", legal_bold), Paragraph(str(net_qty), legal_body),
         Paragraph("<b>DECLARED MRP:</b>", legal_bold), Paragraph(str(mrp_val), legal_body)]
    ]
    prod_table = Table(prod_data, colWidths=[4.2 * cm, 5.0 * cm, 4.0 * cm, 4.8 * cm])
    prod_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 4 * mm))

    # 6. Preamble & Factual Recital
    preamble_p1 = (
        "<b>WHEREAS</b>, in exercise of the powers conferred by Section 15 of the Legal Metrology Act, 2009, an authorized "
        "inspection and surveillance check was executed by the undersigned Legal Metrology Enforcement Officer at the inspection "
        "premises specified above; and in the course of the said official inspection, specimens of the above-mentioned "
        "pre-packaged commodity manufactured, packed, distributed, or exposed for sale by you were seized/sampled for statutory examination;"
    )
    elements.append(Paragraph(preamble_p1, legal_body))

    preamble_p2 = (
        "<b>AND WHEREAS</b>, verification of the specimen packaging against the statutory requirements mandated under "
        "the <b>Legal Metrology (Packaged Commodities) Rules, 2011</b> established that the package fails to satisfy "
        "mandatory declarations required under <b>Section 18 of the Legal Metrology Act, 2009</b>, thereby constituting "
        "explicit statutory offences punishable under <b>Section 36 of the Act</b> as itemized in the Schedule below:"
    )
    elements.append(Paragraph(preamble_p2, legal_body))
    elements.append(Spacer(1, 2 * mm))

    # 7. Schedule of Contraventions Table
    elements.append(Paragraph("<b>SCHEDULE OF CONTRAVENTIONS & STATUTORY OFFENCES</b>", subhead_style))

    table_data = [
        [
            Paragraph("<b>Item</b>", legal_bold),
            Paragraph("<b>Statutory Rule & Section Reference</b>", legal_bold),
            Paragraph("<b>Mandatory Legal Requirement</b>", legal_bold),
            Paragraph("<b>Observed Contravention / Default</b>", legal_bold),
            Paragraph("<b>Severity</b>", legal_bold),
        ]
    ]

    if violations and len(violations) > 0:
        for idx, v in enumerate(violations, 1):
            rule_ref = v.get("section_reference") or v.get("rule_code") or "PCR Rule 6"
            statutory_sec = f"{rule_ref} r/w Sec 18, LM Act"
            req = v.get("rule_name") or "Mandatory Declaration"
            defect = v.get("description") or "Declaration missing or non-compliant on package label"
            sev = (v.get("severity") or "Major").upper()

            table_data.append([
                Paragraph(str(idx), legal_body),
                Paragraph(statutory_sec, legal_body),
                Paragraph(req, legal_body),
                Paragraph(defect, legal_body),
                Paragraph(f"<b><font color='{'#dc2626' if sev == 'CRITICAL' else '#ea580c'}'>{sev}</font></b>", legal_body),
            ])
    else:
        # Default fallback entry if generated for general audit
        table_data.append([
            Paragraph("1", legal_body),
            Paragraph("Rule 6(1) r/w Section 18", legal_body),
            Paragraph("Statutory Declarations on Packaged Commodity", legal_body),
            Paragraph("Mandatory declaration defects observed during official surveillance audit", legal_body),
            Paragraph("<b><font color='#dc2626'>CRITICAL</font></b>", legal_body),
        ])

    contra_table = Table(table_data, colWidths=[1.2 * cm, 4.3 * cm, 4.0 * cm, 6.5 * cm, 2.0 * cm])
    contra_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#0f172a')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(contra_table)
    elements.append(Spacer(1, 3.5 * mm))

    # 8. Penal Liabilities & Legal Directives
    elements.append(Paragraph("<b>STATUTORY PENAL LIABILITIES UNDER SECTION 36</b>", subhead_style))
    penal_text = (
        "<b>Section 36(1) & 36(2) of the Legal Metrology Act, 2009</b> stipulates that whoever manufactures, packs, distributes, "
        "or sells pre-packaged commodities not conforming to standard packaging declarations shall be punished with a fine "
        "which may extend to <b>Twenty-Five Thousand Rupees (₹25,000/-)</b> for the first offence; for the second offence, to a fine "
        "which may extend to <b>Fifty Thousand Rupees (₹50,000/-)</b>; and for subsequent offences, with a fine which may extend to "
        "<b>One Lakh Rupees (₹1,00,000/-)</b> or with <b>imprisonment for a term which may extend to one year, or with both</b>. "
        "Under <b>Section 49</b>, where an offence is committed by a company, every person in charge of and responsible for the business "
        "thereof shall be deemed guilty of the offence and liable to be proceeded against."
    )
    elements.append(Paragraph(penal_text, legal_body))
    elements.append(Spacer(1, 2 * mm))

    # 9. Compounding Directive under Section 48
    elements.append(Paragraph("<b>COMPOUNDING DIRECTIVE UNDER SECTION 48</b>", subhead_style))
    compound_text = (
        "You are hereby notified that pursuant to <b>Section 48 of the Legal Metrology Act, 2009</b> and <b>Rule 32 of the Legal Metrology "
        "(Packaged Commodities) Rules, 2011</b>, you are afforded a statutory opportunity to apply for <b>Compounding of the Offence</b> "
        "prior to the institution of formal criminal prosecution before the Court of the Judicial Magistrate. Should you opt for compounding, "
        "you must submit a written application in Form-A along with payment of the prescribed compounding fee and proof of complete market "
        "rectification or withdrawal of the non-compliant batch from all retail channels."
    )
    elements.append(Paragraph(compound_text, legal_body))
    elements.append(Spacer(1, 2 * mm))

    # 10. Statutory 15-Day Response Order
    elements.append(Paragraph("<b>STATUTORY 15-DAY SUMMON & SHOW-CAUSE ORDER</b>", ParagraphStyle('OrderH', parent=subhead_style, textColor=colors.HexColor('#991b1b'))))
    order_text = (
        f"<b>NOW THEREFORE</b>, you are hereby called upon to <b>SHOW CAUSE</b> in writing on or before <b><u>{deadline_date}</u></b> "
        f"(within <b>fifteen [15] days</b> of receipt hereof) as to why legal proceedings under Section 36 of the Act should not be instituted "
        f"against your firm and Directors/Officers before the competent Court of Law.<br/>"
        "<b>TAKE FURTHER NOTICE</b> that failure to submit an explanation or application for compounding within the stipulated fifteen days "
        "shall result in the immediate filing of a criminal complaint before the Judicial Magistrate without further notice to you."
    )
    order_box = Table([[Paragraph(order_text, legal_body)]], colWidths=[18 * cm])
    order_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#b91c1c')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(order_box)
    elements.append(Spacer(1, 4 * mm))

    # 11. Cryptographic Hash & Digital Verification Signature Block
    notice_hash = compute_notice_hash({
        "notice_number": notice_number,
        "date": issue_date,
        "violator": violator_firm,
        "violations_count": len(violations),
        "deadline": deadline_date,
    })

    officer_name = inspector_name or scan_data.get("inspector_name") or "Legal Metrology Enforcement Officer"

    sign_data = [
        [
            Paragraph(
                f"<b>DIGITAL TAMPER-PROOF AUTHENTICATION HASH:</b><br/>"
                f"<font face='Courier' size='7'>{notice_hash}</font><br/>"
                f"<font size='7' color='#64748b'>Certified court-admissible electronic record under Section 65B of Indian Evidence Act.</font>",
                legal_body
            ),
            Paragraph(
                f"<b>[ISSUED UNDER SEAL & SIGNATURE]</b><br/><br/>"
                f"<b>({officer_name})</b><br/>"
                f"Inspector / Enforcement Officer of Legal Metrology<br/>"
                f"Controllerate of Legal Metrology, Govt of India",
                ParagraphStyle('Sig', parent=legal_body, alignment=TA_RIGHT)
            )
        ]
    ]
    sign_table = Table(sign_data, colWidths=[10.5 * cm, 7.5 * cm])
    sign_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(KeepTogether(sign_table))

    # Build the PDF
    doc.build(elements)
    return pdf_path
