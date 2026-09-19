import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine, async_session, init_db
from app.models.models import User, UserRole, Scan, Violation, Report, ComplianceStatus
from app.services.compliance_engine import check_compliance, get_statutory_font_requirement, evaluate_font_size_and_readability
from app.services.report_generator import generate_pdf_report, generate_report_number
from app.core.config import Settings
from sqlalchemy import select
from sqlalchemy.orm import selectinload

settings = Settings()

async def run_tests():
    print("=== 1. Testing Statutory Font Height Rules (Rule 7) ===")
    req_50g = get_statutory_font_requirement({"value": 45, "unit": "g"})
    print(f"45g pack requirement: min_mm={req_50g['min_mm']}, tier={req_50g['tier_label']}")
    assert req_50g['min_mm'] == 1.0, f"Expected 1.0mm, got {req_50g['min_mm']}"

    req_200g = get_statutory_font_requirement({"value": 150, "unit": "g"})
    print(f"150g pack requirement: min_mm={req_200g['min_mm']}, tier={req_200g['tier_label']}")
    assert req_200g['min_mm'] == 2.0, f"Expected 2.0mm, got {req_200g['min_mm']}"

    req_1kg = get_statutory_font_requirement({"value": 1, "unit": "kg"})
    print(f"1kg pack requirement: min_mm={req_1kg['min_mm']}, tier={req_1kg['tier_label']}")
    assert req_1kg['min_mm'] == 4.0, f"Expected 4.0mm, got {req_1kg['min_mm']}"

    req_5kg = get_statutory_font_requirement({"value": 5, "unit": "kg"})
    print(f"5kg pack requirement: min_mm={req_5kg['min_mm']}, tier={req_5kg['tier_label']}")
    assert req_5kg['min_mm'] == 6.0, f"Expected 6.0mm, got {req_5kg['min_mm']}"

    print("\n=== 2. Testing Font Size Assessment on Uncalibrated 2D Photo ===")
    sample_fields = {
        "common_name": "Premium Basmati Rice",
        "mrp": {"value": 185.0, "has_tax_note": True, "raw": "MRP Rs. 185.00"},
        "net_quantity": {"value": 1.0, "unit": "kg", "raw": "1 kg"},
        "manufacturer": {"value": "Golden Harvest Foods Ltd, Delhi - 110001", "has_pincode": True},
        "dates": {"manufacture_date": {"value": "05/2026", "raw": "05/2026"}},
        "consumer_care": {"phone": "1800-111-222", "email": "care@goldenharvest.com"},
        "country_of_origin": "India",
        "_raw_text": "Golden Harvest Premium Basmati Rice Net Qty 1 kg MRP Rs 185 incl of all taxes Mfg 05/2026 Care 1800-111-222 Delhi 110001",
    }
    comp = check_compliance(sample_fields, has_physical_scale_marker=False)
    print(f"Compliance Status: {comp['status']}")
    print(f"Compliance Score: {comp['score']}%")
    print(f"Total Checks: {comp['total_checks']}, Failed: {comp['failed_checks']}, Review Required: {comp.get('review_required_checks')}")
    assert comp['font_size_assessment'] is not None
    assert comp['font_size_assessment']['status'] == 'REVIEW_REQUIRED'
    print(f"Font Assessment Conclusion: {comp['font_size_assessment']['conclusion']}")

    font_violations = [v for v in comp['violations'] if v['rule_code'] == 'LM-R7-FONT-SIZE']
    assert len(font_violations) == 1, "Expected LM-R7-FONT-SIZE violation"
    assert font_violations[0]['status'] == 'REVIEW_REQUIRED'
    print("LM-R7-FONT-SIZE successfully recorded with status REVIEW_REQUIRED.")

    print("\n=== 3. Testing Database Initialization & Alter Migrations ===")
    await init_db()
    print("Database schema successfully verified / migrated.")

    print("\n=== 4. Testing End-to-End PDF Report with Font Size & Inspector Endorsement ===")
    report_num = generate_report_number()
    test_scan_data = {
        "scan_id": 999,
        "compliance_status": "compliant",
        "compliance_score": 100.0,
        "scan_type": "manual",
        "store_name": "Test Store Delhi",
        "barcode": "8901234567890",
        "font_size_assessment": comp['font_size_assessment'],
        "font_size_review": {
            "measured_height_mm": 4.5,
            "status": "COMPLIANT",
            "notes": "Verified with digital vernier caliper on net quantity numerals.",
        },
        "is_reviewed": True,
        "inspector_name": "Rajesh Kumar",
        "inspector_action": "APPROVED_COMPLIANT",
        "inspector_notes": "Physical verification completed at store. All mandatory declarations under Legal Metrology Rules conform.",
        "reviewed_at": "19 September 2026, 21:30 UTC",
    }
    
    test_violations = [
        {
            "rule_code": "LM-R7-FONT-SIZE",
            "rule_name": "Mandatory Font Size & Legibility",
            "description": "Rule 7 Font Size compliance",
            "severity": "minor",
            "field_name": "font_size",
            "expected_value": ">= 4.0 mm",
            "actual_value": "4.5 mm (Caliper Verified)",
            "section_reference": "Rule 7 & 9",
            "status": "RESOLVED_COMPLIANT",
            "inspector_remark": "Verified 4.5mm with digital caliper.",
        }
    ]

    pdf_out = generate_pdf_report(
        scan_data=test_scan_data,
        violations=test_violations,
        extracted_fields=sample_fields,
        output_dir=settings.REPORTS_DIR,
        report_number=report_num,
    )
    print(f"Generated test PDF: {pdf_out}")
    assert os.path.exists(pdf_out), "PDF file was not created"
    assert os.path.getsize(pdf_out) > 1000, "PDF file is empty"
    print(f"PDF generated successfully ({os.path.getsize(pdf_out)} bytes).")

    print("\n=== All Font Size & Inspector Verification Tests Passed! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
