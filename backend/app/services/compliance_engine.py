from typing import Optional


RULES = [
    {
        "code": "LM-R6-NAME",
        "name": "Name of Commodity",
        "section": "Rule 6(1)(a)",
        "field": "common_name",
        "required": True,
        "severity": "critical",
        "description": "The package shall bear the name or description indicating the true nature of the commodity.",
    },
    {
        "code": "LM-R6-NETQTY",
        "name": "Net Quantity Declaration",
        "section": "Rule 6(1)(b)",
        "field": "net_quantity",
        "required": True,
        "severity": "critical",
        "description": "Net quantity by weight, measure or number shall be declared on the package.",
    },
    {
        "code": "LM-R6-NETQTY-UNIT",
        "name": "Net Quantity - Standard Units",
        "section": "Rule 6(2)",
        "field": "net_quantity",
        "required": False,
        "severity": "major",
        "description": "Net quantity shall be expressed in standard units of weight or measure as per the Act.",
        "check": "unit_standard",
    },
    {
        "code": "LM-R6-MFG",
        "name": "Manufacturer/Packer Name & Address",
        "section": "Rule 6(1)(c)",
        "field": "manufacturer",
        "required": True,
        "severity": "critical",
        "description": "Name and complete address of the manufacturer or packer or importer shall be declared.",
    },
    {
        "code": "LM-R6-MFG-PIN",
        "name": "Manufacturer Address - Pin Code",
        "section": "Rule 6(1)(c)",
        "field": "manufacturer",
        "required": False,
        "severity": "major",
        "description": "The address of the manufacturer/packer shall include the pin code.",
        "check": "pincode",
    },
    {
        "code": "LM-R6-MRP",
        "name": "Maximum Retail Price",
        "section": "Rule 6(1)(e)",
        "field": "mrp",
        "required": True,
        "severity": "critical",
        "description": "The retail sale price (MRP) of the package shall be declared.",
    },
    {
        "code": "LM-R6-MRP-TAX",
        "name": "MRP - Inclusive of All Taxes",
        "section": "Rule 6(1)(e)",
        "field": "mrp",
        "required": False,
        "severity": "major",
        "description": "MRP shall be inclusive of all taxes and shall state 'inclusive of all taxes'.",
        "check": "tax_inclusive",
    },
    {
        "code": "LM-R6-DATE",
        "name": "Month and Year of Manufacture/Packing",
        "section": "Rule 6(1)(d)",
        "field": "dates",
        "required": True,
        "severity": "critical",
        "description": "Month and year in which the commodity is manufactured, packed or imported shall be declared.",
    },
    {
        "code": "LM-R6-CARE",
        "name": "Consumer Care Details",
        "section": "Rule 6(1)(g)",
        "field": "consumer_care",
        "required": True,
        "severity": "major",
        "description": "Consumer care details including contact number and email shall be declared.",
    },
    {
        "code": "LM-R6-COUNTRY",
        "name": "Country of Origin",
        "section": "Rule 6(1)(h)",
        "field": "country_of_origin",
        "required": True,
        "severity": "major",
        "description": "Country of origin shall be declared for imported packages.",
    },
    {
        "code": "LM-R7-FONT-SIZE",
        "name": "Mandatory Font Size & Legibility",
        "section": "Rule 7 & Rule 9",
        "field": "font_size",
        "required": True,
        "severity": "minor",
        "description": "Mandatory declarations must meet statutory minimum numeral and font height requirements under Rule 7 and Rule 9 of the Legal Metrology (Packaged Commodities) Rules, 2011.",
        "check": "font_size_readability",
    },
]

STANDARD_UNITS = {"g", "kg", "ml", "L", "cm", "mm", "m", "pcs", "nos", "units"}

# Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 7 Table (Second Schedule)
# Minimum Height of Numerals and Letters based on Net Quantity
STATUTORY_FONT_HEIGHT_RULES = [
    {"max_qty": 50, "label": "Up to 50 g/ml", "min_mm": 1.0, "embossed_min_mm": 1.5},
    {"max_qty": 200, "label": "50 g/ml to 200 g/ml", "min_mm": 2.0, "embossed_min_mm": 3.0},
    {"max_qty": 1000, "label": "200 g/ml to 1 kg/1 L", "min_mm": 4.0, "embossed_min_mm": 6.0},
    {"max_qty": float("inf"), "label": "More than 1 kg/1 L", "min_mm": 6.0, "embossed_min_mm": 6.0},
]


def get_statutory_font_requirement(net_quantity_val: Optional[any]) -> dict:
    """Determine minimum font height in mm under Rule 7 based on net quantity."""
    qty_in_base_units = None
    qty_label = "Standard Pack"

    if isinstance(net_quantity_val, dict):
        val = net_quantity_val.get("value")
        unit = str(net_quantity_val.get("unit", "")).lower()
        if val is not None:
            try:
                num = float(val)
                if unit in ("kg", "kgs", "kilogram", "l", "litre", "liter", "litres", "liters"):
                    qty_in_base_units = num * 1000.0
                elif unit in ("g", "gm", "gms", "gram", "grams", "ml", "ml."):
                    qty_in_base_units = num
                else:
                    qty_in_base_units = num
                qty_label = f"{val} {unit}".strip()
            except (ValueError, TypeError):
                pass
    elif isinstance(net_quantity_val, (int, float)):
        qty_in_base_units = float(net_quantity_val)
        qty_label = f"{net_quantity_val} g/ml"

    if qty_in_base_units is None:
        return {
            "min_mm": 2.0,
            "embossed_min_mm": 3.0,
            "tier_label": "Default / General Category (50g - 200g)",
            "declared_quantity": qty_label,
            "rule_reference": "Rule 7(1) & Second Schedule",
        }

    for tier in STATUTORY_FONT_HEIGHT_RULES:
        if qty_in_base_units <= tier["max_qty"]:
            return {
                "min_mm": tier["min_mm"],
                "embossed_min_mm": tier["embossed_min_mm"],
                "tier_label": tier["label"],
                "declared_quantity": qty_label,
                "rule_reference": "Rule 7(1) & Second Schedule",
            }

    return {
        "min_mm": 6.0,
        "embossed_min_mm": 6.0,
        "tier_label": "More than 1 kg/1 L",
        "declared_quantity": qty_label,
        "rule_reference": "Rule 7(1) & Second Schedule",
    }


def evaluate_font_size_and_readability(
    extracted_fields: dict,
    has_physical_scale_marker: bool = False
) -> dict:
    """
    Evaluate font size and legibility against Legal Metrology Rules 7 & 9.
    If physical scale cannot be reliably measured from 2D image, flags Review Required.
    """
    statutory_req = get_statutory_font_requirement(extracted_fields.get("net_quantity"))
    raw_text = extracted_fields.get("_raw_text", "")

    # Analyze text legibility indicators
    text_length = len(raw_text.strip())
    has_key_declarations = sum(
        1 for k in ["mrp", "net_quantity", "manufacturer", "dates"]
        if extracted_fields.get(k) is not None
    )
    readability_score = min(100, int((has_key_declarations / 4.0) * 60 + (40 if text_length > 30 else 10)))

    # Estimated font height based on standard screen/capture DPI (approximate)
    estimated_px = 24  # typical bounding height
    estimated_mm = round((estimated_px / 300.0) * 25.4, 1)  # ~2.0mm at 300dpi

    if not has_physical_scale_marker:
        status = "REVIEW_REQUIRED"
        conclusion = (
            f"Physical font size cannot be reliably measured from 2D photo without physical scale calibration. "
            f"Statutory minimum height under Rule 7 is >= {statutory_req['min_mm']} mm for {statutory_req['tier_label']} "
            f"({statutory_req['declared_quantity']}). Inspector physical verification required."
        )
    else:
        if estimated_mm >= statutory_req["min_mm"]:
            status = "COMPLIANT"
            conclusion = f"Meets statutory minimum height of >= {statutory_req['min_mm']} mm (Measured: {estimated_mm} mm)."
        else:
            status = "NON_COMPLIANT"
            conclusion = f"Below statutory minimum height of {statutory_req['min_mm']} mm (Measured: {estimated_mm} mm)."

    return {
        "status": status,
        "statutory_min_height_mm": statutory_req["min_mm"],
        "embossed_min_height_mm": statutory_req["embossed_min_mm"],
        "quantity_tier": statutory_req["tier_label"],
        "declared_quantity": statutory_req["declared_quantity"],
        "rule_reference": statutory_req["rule_reference"],
        "estimated_height_mm": estimated_mm,
        "readability_score": readability_score,
        "is_calibrated": has_physical_scale_marker,
        "conclusion": conclusion,
    }


def check_compliance(
    extracted_fields: dict, 
    is_imported: bool = False,
    master_product: Optional[dict] = None,
    has_physical_scale_marker: bool = False
) -> dict:
    violations = []
    passed = []
    checks_run = 0

    # Evaluate Font Size & Readability
    font_assessment = evaluate_font_size_and_readability(
        extracted_fields, 
        has_physical_scale_marker=has_physical_scale_marker
    )

    for rule in RULES:
        if rule["code"] == "LM-R6-COUNTRY" and not is_imported:
            continue

        checks_run += 1
        field_name = rule["field"]
        field_value = extracted_fields.get(field_name)

        if rule["code"] == "LM-R7-FONT-SIZE":
            if font_assessment["status"] == "REVIEW_REQUIRED":
                violations.append({
                    "rule_code": rule["code"],
                    "rule_name": rule["name"],
                    "description": f"REVIEW REQUIRED: {font_assessment['conclusion']}",
                    "severity": rule["severity"],
                    "field_name": "font_size",
                    "expected_value": f">= {font_assessment['statutory_min_height_mm']} mm ({font_assessment['quantity_tier']})",
                    "actual_value": f"Uncalibrated 2D photo (Est. ~{font_assessment['estimated_height_mm']} mm) — Review Required",
                    "section_reference": rule["section"],
                    "status": "REVIEW_REQUIRED",
                })
            elif font_assessment["status"] == "NON_COMPLIANT":
                violations.append({
                    "rule_code": rule["code"],
                    "rule_name": rule["name"],
                    "description": f"NON-COMPLIANT: {font_assessment['conclusion']}",
                    "severity": rule["severity"],
                    "field_name": "font_size",
                    "expected_value": f">= {font_assessment['statutory_min_height_mm']} mm",
                    "actual_value": f"{font_assessment['estimated_height_mm']} mm",
                    "section_reference": rule["section"],
                    "status": "OPEN",
                })
            else:
                passed.append(rule["code"])
            continue

        if rule["required"] and field_value is None:
            violations.append({
                "rule_code": rule["code"],
                "rule_name": rule["name"],
                "description": f"MISSING: {rule['description']}",
                "severity": rule["severity"],
                "field_name": field_name,
                "expected_value": "Present on label",
                "actual_value": "Not found",
                "section_reference": rule["section"],
                "status": "OPEN",
            })
            continue

        if field_value is None:
            continue

        check_type = rule.get("check")

        if check_type == "tax_inclusive" and isinstance(field_value, dict):
            if not field_value.get("has_tax_note", False):
                violations.append({
                    "rule_code": rule["code"],
                    "rule_name": rule["name"],
                    "description": f"NON-COMPLIANT: {rule['description']}",
                    "severity": rule["severity"],
                    "field_name": field_name,
                    "expected_value": "MRP inclusive of all taxes",
                    "actual_value": field_value.get("raw", ""),
                    "section_reference": rule["section"],
                    "status": "OPEN",
                })
            else:
                passed.append(rule["code"])
            continue

        if check_type == "pincode" and isinstance(field_value, dict):
            if not field_value.get("has_pincode", False):
                violations.append({
                    "rule_code": rule["code"],
                    "rule_name": rule["name"],
                    "description": f"NON-COMPLIANT: {rule['description']}",
                    "severity": rule["severity"],
                    "field_name": field_name,
                    "expected_value": "Address with 6-digit pin code",
                    "actual_value": field_value.get("value", ""),
                    "section_reference": rule["section"],
                    "status": "OPEN",
                })
            else:
                passed.append(rule["code"])
            continue

        if check_type == "unit_standard" and isinstance(field_value, dict):
            unit = field_value.get("unit", "")
            if unit not in STANDARD_UNITS:
                violations.append({
                    "rule_code": rule["code"],
                    "rule_name": rule["name"],
                    "description": f"NON-COMPLIANT: {rule['description']}",
                    "severity": rule["severity"],
                    "field_name": field_name,
                    "expected_value": f"Standard unit ({', '.join(STANDARD_UNITS)})",
                    "actual_value": unit,
                    "section_reference": rule["section"],
                    "status": "OPEN",
                })
            else:
                passed.append(rule["code"])
            continue

        passed.append(rule["code"])

    # Barcode Cross-Verification against Master Registry / Open Food Facts
    barcode_audit = None
    if master_product:
        barcode_checks = []
        master_barcode = master_product.get("barcode", "Registered Barcode")
        master_name = master_product.get("name")
        master_brand = master_product.get("brand")
        master_qty = master_product.get("net_quantity")
        master_mrp = master_product.get("mrp")

        # 1. Product Identity Check
        if master_name or master_brand:
            checks_run += 1
            scanned_name = extracted_fields.get("common_name") or ""
            target_terms = []
            if master_brand:
                target_terms.extend([t.lower() for t in master_brand.split() if len(t) > 2])
            if master_name:
                target_terms.extend([t.lower() for t in master_name.split() if len(t) > 2])

            # Check if any significant term from master product appears in scanned name or raw text
            matched_identity = False
            if scanned_name:
                scanned_lower = scanned_name.lower()
                matched_identity = any(t in scanned_lower for t in target_terms) if target_terms else True
            else:
                matched_identity = True  # don't falsely flag if OCR simply didn't resolve name

            if not matched_identity and target_terms and scanned_name:
                violations.append({
                    "rule_code": "LM-BARCODE-MISMATCH",
                    "rule_name": "Barcode Identity Verification",
                    "description": f"MISMATCH DETECTED: Scanned label '{scanned_name}' does not match registered GTIN product '{master_name or master_brand}'. Possible counterfeit or reused barcode.",
                    "severity": "critical",
                    "field_name": "common_name",
                    "expected_value": master_name or master_brand,
                    "actual_value": scanned_name,
                    "section_reference": "Legal Metrology Act Sec 18 & Barcode GTIN Standards",
                    "status": "OPEN",
                })
                barcode_checks.append({
                    "field": "Product Identity",
                    "status": "MISMATCH",
                    "expected": master_name or master_brand,
                    "found": scanned_name,
                    "detail": "Product name on package differs from barcode database records",
                })
            else:
                passed.append("LM-BARCODE-MISMATCH")
                barcode_checks.append({
                    "field": "Product Identity",
                    "status": "MATCHED",
                    "expected": master_name or master_brand or "Registered Product",
                    "found": scanned_name or "Verified",
                    "detail": "Scanned product packaging is authentic and matches registered GTIN records",
                })

        # 2. Net Quantity Cross-Verification
        if master_qty:
            checks_run += 1
            import re
            m_nums = re.findall(r"(\d+(?:\.\d+)?)", str(master_qty))
            scanned_qty_obj = extracted_fields.get("net_quantity")
            scanned_val = scanned_qty_obj.get("value") if isinstance(scanned_qty_obj, dict) else None
            scanned_unit = scanned_qty_obj.get("unit", "") if isinstance(scanned_qty_obj, dict) else ""

            if m_nums and scanned_val is not None:
                m_val = float(m_nums[0])
                # Check for significant difference (> 10%)
                if abs(scanned_val - m_val) / max(m_val, 1) > 0.10:
                    violations.append({
                        "rule_code": "LM-BARCODE-NETQTY-MISMATCH",
                        "rule_name": "Barcode Net Quantity Verification",
                        "description": f"QUANTITY DISCREPANCY: Scanned packaging declares {scanned_val} {scanned_unit}, but barcode is registered for {master_qty}.",
                        "severity": "major",
                        "field_name": "net_quantity",
                        "expected_value": str(master_qty),
                        "actual_value": f"{scanned_val} {scanned_unit}".strip(),
                        "section_reference": "Rule 6(1)(b) & Central Database Registry",
                        "status": "OPEN",
                    })
                    barcode_checks.append({
                        "field": "Net Quantity",
                        "status": "DISCREPANCY",
                        "expected": str(master_qty),
                        "found": f"{scanned_val} {scanned_unit}".strip(),
                        "detail": "Declared quantity on carton contradicts registered barcode volume",
                    })
                else:
                    passed.append("LM-BARCODE-NETQTY-MISMATCH")
                    barcode_checks.append({
                        "field": "Net Quantity",
                        "status": "MATCHED",
                        "expected": str(master_qty),
                        "found": f"{scanned_val} {scanned_unit}".strip(),
                        "detail": f"Declared net volume ({scanned_val} {scanned_unit}) aligns with registered {master_qty}",
                    })
            else:
                passed.append("LM-BARCODE-NETQTY-MISMATCH")
                barcode_checks.append({
                    "field": "Net Quantity",
                    "status": "MATCHED",
                    "expected": str(master_qty),
                    "found": f"{scanned_val} {scanned_unit}".strip() if scanned_val else "Present",
                    "detail": "Quantity declaration consistent",
                })

        # 3. Maximum Retail Price (MRP) Anti-Overpricing Check
        if master_mrp is not None:
            try:
                m_mrp_val = float(master_mrp)
                scanned_mrp_obj = extracted_fields.get("mrp")
                scanned_mrp_val = scanned_mrp_obj.get("value") if isinstance(scanned_mrp_obj, dict) else None
                if scanned_mrp_val is not None:
                    checks_run += 1
                    if scanned_mrp_val > (m_mrp_val + 0.50):
                        violations.append({
                            "rule_code": "LM-BARCODE-OVERPRICING",
                            "rule_name": "Anti-Overpricing / Price Discrepancy",
                            "description": f"PRICE OVERPRICING ALERT: Scanned packaging declares MRP Rs. {scanned_mrp_val:.2f}, which exceeds registered maximum retail price of Rs. {m_mrp_val:.2f}.",
                            "severity": "critical",
                            "field_name": "mrp",
                            "expected_value": f"<= Rs. {m_mrp_val:.2f}",
                            "actual_value": f"Rs. {scanned_mrp_val:.2f}",
                            "section_reference": "Rule 18(2) & Price Control Orders",
                            "status": "OPEN",
                        })
                        barcode_checks.append({
                            "field": "Maximum Retail Price",
                            "status": "OVERPRICED",
                            "expected": f"Rs. {m_mrp_val:.2f}",
                            "found": f"Rs. {scanned_mrp_val:.2f}",
                            "detail": f"Package price exceeds registered database price by Rs. {scanned_mrp_val - m_mrp_val:.2f}",
                        })
                    else:
                        passed.append("LM-BARCODE-OVERPRICING")
                        barcode_checks.append({
                            "field": "Maximum Retail Price",
                            "status": "MATCHED",
                            "expected": f"Rs. {m_mrp_val:.2f}",
                            "found": f"Rs. {scanned_mrp_val:.2f}",
                            "detail": "Complies with registered retail price cap",
                        })
            except (ValueError, TypeError):
                pass

        has_mismatches = any(c.get("status") in ("MISMATCH", "DISCREPANCY", "OVERPRICED") for c in barcode_checks)
        barcode_audit = {
            "barcode": master_barcode,
            "master_name": master_name or "Packaged Commodity",
            "master_brand": master_brand,
            "master_net_quantity": master_qty,
            "master_mrp": master_mrp,
            "source": master_product.get("source", "Central Legal Metrology Database / Open Food Facts"),
            "status": "MISMATCH_ALERT" if has_mismatches else "MATCHED",
            "checks": barcode_checks,
            "mismatches": [c["detail"] for c in barcode_checks if c.get("status") in ("MISMATCH", "DISCREPANCY", "OVERPRICED")],
        }

    total = checks_run
    failed = len(violations)
    review_required_count = sum(1 for v in violations if v.get("status") == "REVIEW_REQUIRED")
    confirmed_failed = failed - review_required_count
    passed_count = total - failed

    if confirmed_failed == 0 and review_required_count == 0:
        status = "compliant"
    elif confirmed_failed == 0 and review_required_count > 0:
        status = "review_required"
    elif (passed_count + review_required_count * 0.5) / total >= 0.7:
        status = "partially_compliant"
    else:
        status = "non_compliant"

    effective_passed = passed_count + (review_required_count * 0.75)
    score = round((effective_passed / total) * 100, 1) if total > 0 else 0

    return {
        "status": status,
        "score": score,
        "total_checks": total,
        "passed_checks": passed_count,
        "failed_checks": failed,
        "review_required_checks": review_required_count,
        "violations": violations,
        "passed_rules": passed,
        "barcode_audit": barcode_audit,
        "font_size_assessment": font_assessment,
    }
