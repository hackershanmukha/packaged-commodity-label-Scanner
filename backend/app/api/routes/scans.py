import os
import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.config import Settings
from app.models.models import User, Product, Scan, Violation, Report, ComplianceStatus, ViolationSeverity, UserRole
from app.schemas.schemas import ScanResponse, ScanCreate, InspectorReviewRequest
from app.api.routes.auth import get_current_user
from app.services.ocr_service import run_ocr, detect_barcode, estimate_font_sizes
from app.services.field_extractor import extract_all_fields
from app.services.compliance_engine import check_compliance
from app.services.report_generator import generate_report_number, generate_pdf_report, compute_hash

from starlette.concurrency import run_in_threadpool

settings = Settings()
router = APIRouter(prefix="/scans", tags=["Scanning"])


@router.post("/", response_model=ScanResponse)
@router.post("", response_model=ScanResponse)
async def create_scan(
    images: list[UploadFile] = File(default=[]),
    image: Optional[UploadFile] = File(None),
    image_labels: Optional[str] = Form(None),
    scan_type: str = Form("manual"),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    store_name: Optional[str] = Form(None),
    store_address: Optional[str] = Form(None),
    barcode: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Parse labels if provided
    labels = []
    if image_labels:
        try:
            parsed = json.loads(image_labels)
            if isinstance(parsed, list):
                labels = [str(x) for x in parsed]
        except Exception:
            labels = [l.strip() for l in image_labels.split(",") if l.strip()]

    # Collect files to process
    files_to_process: list[tuple[UploadFile, str]] = []
    if images and len(images) > 0:
        for idx, img in enumerate(images):
            if img.filename:
                lbl = labels[idx] if idx < len(labels) else f"Angle {idx + 1}"
                files_to_process.append((img, lbl))

    # Backward compatibility with single 'image' field
    if not files_to_process and image and image.filename:
        lbl = labels[0] if labels else "Front"
        files_to_process.append((image, lbl))

    if not files_to_process:
        raise HTTPException(status_code=400, detail="No image provided. Please upload at least one product label photo.")

    valid_extensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"]
    saved_images: list[dict] = []
    ocr_sections: list[str] = []
    barcode_detected = barcode

    for img, label in files_to_process:
        ext = os.path.splitext(img.filename)[1].lower() if img.filename else ".jpg"
        if ext not in valid_extensions:
            if img.content_type and img.content_type.startswith("image/"):
                ext = ".jpg"
            else:
                continue

        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)

        content = await img.read()
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{img.filename}' too large (max 10MB)")

        with open(filepath, "wb") as f:
            f.write(content)

        # Store with web-friendly forward slashes
        web_path = filepath.replace("\\", "/")
        saved_images.append({
            "label": label,
            "path": web_path,
            "filename": filename,
        })

        # Run OCR on this image angle
        ocr_result = await run_in_threadpool(run_ocr, filepath)
        angle_text = ocr_result.get("text", "").strip()
        if angle_text:
            ocr_sections.append(f"--- [{label.upper()}] ---\n{angle_text}")

        # Check for barcode if not yet detected
        if not barcode_detected:
            detected = await run_in_threadpool(detect_barcode, filepath)
            if detected:
                barcode_detected = detected

    if not saved_images:
        raise HTTPException(status_code=400, detail="Invalid file type(s). Please upload images (JPG, PNG, WebP).")

    primary_image_path = saved_images[0]["path"]
    raw_text = "\n\n".join(ocr_sections) if ocr_sections else ""

    # Master Product Resolution & Cross-Verification
    product = None
    master_product_dict = None
    if barcode_detected:
        barcode_detected = barcode_detected.strip()
        result = await db.execute(select(Product).where(Product.barcode == barcode_detected))
        product = result.scalar_one_or_none()
        
        if product and (product.name or product.mrp or product.net_quantity):
            master_product_dict = {
                "barcode": product.barcode,
                "name": product.name,
                "brand": product.brand,
                "net_quantity": product.net_quantity,
                "mrp": product.mrp,
                "manufacturer_name": product.manufacturer_name,
                "source": "Central Legal Metrology Database",
            }
        else:
            # Query Open Food Facts public registry
            from app.api.routes.products import fetch_open_food_facts
            off_data = await fetch_open_food_facts(barcode_detected)
            if off_data:
                master_product_dict = {
                    "barcode": barcode_detected,
                    "name": off_data.get("name"),
                    "brand": off_data.get("brand"),
                    "net_quantity": off_data.get("net_quantity"),
                    "mrp": None,
                    "manufacturer_name": off_data.get("brand"),
                    "source": "Open Food Facts Global Registry",
                }
                if not product:
                    product = Product(
                        barcode=barcode_detected,
                        name=off_data.get("name"),
                        brand=off_data.get("brand"),
                        net_quantity=off_data.get("net_quantity"),
                    )
                    db.add(product)
                    await db.flush()

    extracted_fields = extract_all_fields(raw_text, master_product=master_product_dict)

    # If product record didn't exist, create it with extracted fields as fallback
    if barcode_detected and not product:
        product = Product(
            barcode=barcode_detected,
            name=extracted_fields.get("common_name"),
            manufacturer_name=extracted_fields.get("manufacturer", {}).get("value") if isinstance(extracted_fields.get("manufacturer"), dict) else None,
            net_quantity=extracted_fields.get("net_quantity", {}).get("raw") if isinstance(extracted_fields.get("net_quantity"), dict) else None,
            mrp=extracted_fields.get("mrp", {}).get("value") if isinstance(extracted_fields.get("mrp"), dict) else None,
        )
        db.add(product)
        await db.flush()

    compliance = check_compliance(extracted_fields, master_product=master_product_dict)

    if compliance.get("barcode_audit"):
        extracted_fields["barcode_audit"] = compliance["barcode_audit"]

    scan = Scan(
        user_id=user.id,
        product_id=product.id if product else None,
        image_path=primary_image_path,
        image_paths=saved_images,
        scan_type=scan_type,
        latitude=latitude,
        longitude=longitude,
        store_name=store_name,
        store_address=store_address,
        raw_ocr_text=raw_text,
        extracted_fields=extracted_fields,
        barcode_detected=barcode_detected,
        compliance_status=ComplianceStatus(compliance["status"]),
        compliance_score=compliance["score"],
        total_checks=compliance["total_checks"],
        passed_checks=compliance["passed_checks"],
        failed_checks=compliance["failed_checks"],
        font_size_assessment=compliance.get("font_size_assessment"),
    )
    db.add(scan)
    await db.flush()

    for v in compliance["violations"]:
        violation = Violation(
            scan_id=scan.id,
            rule_code=v["rule_code"],
            rule_name=v["rule_name"],
            description=v["description"],
            severity=ViolationSeverity(v["severity"]),
            field_name=v.get("field_name"),
            expected_value=v.get("expected_value"),
            actual_value=v.get("actual_value"),
            section_reference=v.get("section_reference"),
            status=v.get("status", "OPEN"),
        )
        db.add(violation)

    report_number = generate_report_number()
    scan_data = {
        "scan_id": scan.id,
        "compliance_status": compliance["status"],
        "compliance_score": compliance["score"],
        "scan_type": scan_type,
        "store_name": store_name,
        "latitude": latitude,
        "longitude": longitude,
        "barcode": barcode_detected,
        "master_product": master_product_dict,
        "barcode_audit": compliance.get("barcode_audit"),
        "font_size_assessment": compliance.get("font_size_assessment"),
        "image_paths": saved_images,
    }

    pdf_path = await run_in_threadpool(
        generate_pdf_report,
        scan_data=scan_data,
        violations=compliance["violations"],
        extracted_fields=extracted_fields,
        image_path=primary_image_path,
        output_dir=settings.REPORTS_DIR,
        report_number=report_number,
        image_paths=saved_images,
    )

    report = Report(
        scan_id=scan.id,
        report_number=report_number,
        pdf_path=pdf_path,
        hash_chain=compute_hash(scan_data),
    )
    db.add(report)

    await db.commit()

    result = await db.execute(
        select(Scan).options(selectinload(Scan.violations)).where(Scan.id == scan.id)
    )
    scan = result.scalar_one()

    return ScanResponse.model_validate(scan)


@router.get("/", response_model=list[ScanResponse])
@router.get("", response_model=list[ScanResponse])
async def list_scans(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Scan).options(selectinload(Scan.violations)).order_by(Scan.created_at.desc())

    if user.role.value in ("consumer", "manufacturer"):
        query = query.where(Scan.user_id == user.id)

    if status:
        query = query.where(Scan.compliance_status == ComplianceStatus(status))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    scans = result.scalars().all()
    return [ScanResponse.model_validate(s) for s in scans]


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan).options(selectinload(Scan.violations)).where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if user.role.value in ("consumer", "manufacturer") and getattr(scan, "user_id", None) != getattr(user, "id", None):
        raise HTTPException(status_code=403, detail="Not authorized")
    return ScanResponse.model_validate(scan)


@router.post("/{scan_id}/review", response_model=ScanResponse)
@router.put("/{scan_id}/review", response_model=ScanResponse)
async def review_scan(
    scan_id: int,
    review_data: InspectorReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan).options(selectinload(Scan.violations)).where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    corrections_log = dict(scan.inspector_corrections or {})

    # 1. Update Extracted Fields if corrected
    if review_data.corrected_fields:
        current_fields = dict(scan.extracted_fields or {})
        for k, v in review_data.corrected_fields.items():
            if current_fields.get(k) != v:
                corrections_log[k] = {
                    "previous": current_fields.get(k),
                    "corrected": v,
                    "corrected_at": datetime.now(timezone.utc).isoformat(),
                }
            current_fields[k] = v
        scan.extracted_fields = current_fields

    # 2. Update Font Size Verification if submitted
    if review_data.font_size_verification:
        scan.font_size_review = review_data.font_size_verification
        fs_status = review_data.font_size_verification.get("status", "COMPLIANT")
        measured_mm = review_data.font_size_verification.get("measured_height_mm")
        notes = review_data.font_size_verification.get("notes", "")

        for v in scan.violations:
            if v.rule_code == "LM-R7-FONT-SIZE":
                if fs_status == "COMPLIANT":
                    v.status = "RESOLVED_COMPLIANT"
                    v.inspector_remark = f"Inspector Caliper Verification: {measured_mm} mm — Verified Compliant with Rule 7. {notes}".strip()
                elif fs_status == "NON_COMPLIANT":
                    v.status = "VERIFIED_VIOLATION"
                    v.inspector_remark = f"Inspector Caliper Measurement: {measured_mm} mm — Non-Compliant with Rule 7. {notes}".strip()
                elif fs_status == "WAIVED":
                    v.status = "WAIVED"
                    v.inspector_remark = f"Waived by Inspector: {notes}".strip()

    # 3. Resolve / Update specific violations
    if review_data.resolved_violations:
        v_map = {v.id: v for v in scan.violations}
        for res in review_data.resolved_violations:
            if res.id in v_map:
                v_target = v_map[res.id]
                v_target.status = res.status
                if res.inspector_remark is not None:
                    v_target.inspector_remark = res.inspector_remark

    # 4. Re-calculate compliance score and status
    open_or_verified = [
        v for v in scan.violations
        if v.status in ("OPEN", "VERIFIED_VIOLATION")
    ]
    review_req_items = [
        v for v in scan.violations
        if v.status == "REVIEW_REQUIRED"
    ]
    resolved_or_waived = [
        v for v in scan.violations
        if v.status in ("RESOLVED_COMPLIANT", "WAIVED")
    ]

    total = scan.total_checks if scan.total_checks > 0 else (len(scan.violations) + 5)
    failed = len(open_or_verified)
    passed_count = max(0, total - failed - len(review_req_items))

    if review_data.final_compliance_status:
        scan.compliance_status = ComplianceStatus(review_data.final_compliance_status)
    else:
        if failed == 0 and len(review_req_items) == 0:
            scan.compliance_status = ComplianceStatus.COMPLIANT
        elif failed == 0 and len(review_req_items) > 0:
            scan.compliance_status = ComplianceStatus.REVIEW_REQUIRED
        elif (passed_count + len(resolved_or_waived)) / total >= 0.7:
            scan.compliance_status = ComplianceStatus.PARTIALLY_COMPLIANT
        else:
            scan.compliance_status = ComplianceStatus.NON_COMPLIANT

    scan.failed_checks = failed
    scan.passed_checks = total - failed
    scan.compliance_score = round((scan.passed_checks / total) * 100, 1) if total > 0 else 100.0

    # 5. Inspector Metadata
    scan.is_reviewed = True
    scan.inspector_id = user.id
    scan.inspector_name = user.full_name or user.username
    scan.inspector_notes = review_data.inspector_notes
    scan.inspector_action = review_data.inspector_action or "APPROVED_COMPLIANT"
    scan.reviewed_at = datetime.now(timezone.utc)
    scan.inspector_corrections = corrections_log

    # 6. Re-generate PDF Report if finalized
    if review_data.finalize_report:
        report_res = await db.execute(select(Report).where(Report.scan_id == scan.id))
        report = report_res.scalar_one_or_none()
        report_number = report.report_number if report else generate_report_number()

        status_val = scan.compliance_status.value if hasattr(scan.compliance_status, "value") else str(scan.compliance_status)
        scan_data = {
            "scan_id": scan.id,
            "compliance_status": status_val,
            "compliance_score": scan.compliance_score,
            "scan_type": scan.scan_type,
            "store_name": scan.store_name,
            "latitude": scan.latitude,
            "longitude": scan.longitude,
            "barcode": scan.barcode_detected,
            "barcode_audit": (scan.extracted_fields or {}).get("barcode_audit"),
            "font_size_assessment": scan.font_size_assessment,
            "font_size_review": scan.font_size_review,
            "image_paths": scan.image_paths,
            "is_reviewed": scan.is_reviewed,
            "inspector_name": scan.inspector_name,
            "inspector_action": scan.inspector_action,
            "inspector_notes": scan.inspector_notes,
            "reviewed_at": scan.reviewed_at.strftime("%d %B %Y, %H:%M UTC") if scan.reviewed_at else None,
        }

        v_dicts = [
            {
                "rule_code": v.rule_code,
                "rule_name": v.rule_name,
                "description": v.description,
                "severity": v.severity.value if hasattr(v.severity, "value") else str(v.severity),
                "field_name": v.field_name,
                "expected_value": v.expected_value,
                "actual_value": v.actual_value,
                "section_reference": v.section_reference,
                "status": v.status,
                "inspector_remark": v.inspector_remark,
            }
            for v in scan.violations
        ]

        pdf_path = await run_in_threadpool(
            generate_pdf_report,
            scan_data=scan_data,
            violations=v_dicts,
            extracted_fields=scan.extracted_fields or {},
            image_path=scan.image_path or "",
            output_dir=settings.REPORTS_DIR,
            report_number=report_number,
            image_paths=scan.image_paths,
        )

        if not report:
            report = Report(
                scan_id=scan.id,
                report_number=report_number,
                pdf_path=pdf_path,
                hash_chain=compute_hash(scan_data),
            )
            db.add(report)
        else:
            report.pdf_path = pdf_path
            report.hash_chain = compute_hash(scan_data)
            report.generated_at = datetime.now(timezone.utc)

    await db.commit()

    refreshed = await db.execute(
        select(Scan).options(selectinload(Scan.violations)).where(Scan.id == scan.id)
    )
    scan = refreshed.scalar_one()
    return ScanResponse.model_validate(scan)


@router.get("/{scan_id}/report")
async def download_report(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from fastapi.responses import FileResponse

    result = await db.execute(select(Report).where(Report.scan_id == scan_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    pdf_path: Optional[str] = getattr(report, "pdf_path", None)
    if not pdf_path or not os.path.exists(pdf_path):
        scan_res = await db.execute(
            select(Scan).options(selectinload(Scan.violations)).where(Scan.id == scan_id)
        )
        scan = scan_res.scalar_one_or_none()
        if scan:
            status_val = scan.compliance_status.value if hasattr(scan.compliance_status, "value") else str(scan.compliance_status)
            scan_data = {
                "scan_id": scan.id,
                "compliance_status": status_val,
                "compliance_score": scan.compliance_score,
                "scan_type": scan.scan_type,
                "store_name": scan.store_name,
                "latitude": scan.latitude,
                "longitude": scan.longitude,
                "barcode": scan.barcode_detected,
                "barcode_audit": (scan.extracted_fields or {}).get("barcode_audit"),
                "font_size_assessment": scan.font_size_assessment,
                "font_size_review": scan.font_size_review,
                "image_paths": scan.image_paths,
                "is_reviewed": scan.is_reviewed,
                "inspector_name": scan.inspector_name,
                "inspector_action": scan.inspector_action,
                "inspector_notes": scan.inspector_notes,
                "reviewed_at": scan.reviewed_at.strftime("%d %B %Y, %H:%M UTC") if scan.reviewed_at else None,
            }
            v_dicts = [
                {
                    "rule_code": v.rule_code,
                    "rule_name": v.rule_name,
                    "description": v.description,
                    "severity": v.severity.value if hasattr(v.severity, "value") else str(v.severity),
                    "field_name": v.field_name,
                    "expected_value": v.expected_value,
                    "actual_value": v.actual_value,
                    "section_reference": v.section_reference,
                    "status": v.status,
                    "inspector_remark": v.inspector_remark,
                }
                for v in scan.violations
            ]
            pdf_path = await run_in_threadpool(
                generate_pdf_report,
                scan_data=scan_data,
                violations=v_dicts,
                extracted_fields=scan.extracted_fields or {},
                image_path=scan.image_path or "",
                output_dir=settings.REPORTS_DIR,
                report_number=report.report_number,
                image_paths=scan.image_paths,
            )
            report.pdf_path = pdf_path
            await db.commit()
        else:
            raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{report.report_number}.pdf",
    )
