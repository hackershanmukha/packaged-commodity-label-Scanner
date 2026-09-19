import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import Settings
from app.models.models import User, ManufacturerLabel, ComplianceStatus, UserRole
from app.schemas.schemas import ManufacturerLabelResponse, ManufacturerLabelCreate
from app.api.routes.auth import get_current_user, require_roles
from app.services.ocr_service import run_ocr
from app.services.field_extractor import extract_all_fields
from app.services.compliance_engine import check_compliance

from typing import Optional
from starlette.concurrency import run_in_threadpool

settings = Settings()
router = APIRouter(prefix="/manufacturer", tags=["Manufacturer Portal"])


@router.post("/check-label", response_model=ManufacturerLabelResponse)
async def check_label_compliance(
    images: list[UploadFile] = File(default=[]),
    image: Optional[UploadFile] = File(None),
    product_name: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Collect all uploaded files (supports both multiple 'images' and legacy single 'image')
    all_files: list[UploadFile] = []
    if images and len(images) > 0:
        all_files.extend([f for f in images if f and f.filename])
    if image and image.filename:
        all_files.append(image)

    if not all_files:
        raise HTTPException(status_code=400, detail="Please upload at least one label image.")

    valid_extensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"]
    saved_images: list[str] = []
    ocr_sections: list[str] = []

    for idx, img in enumerate(all_files):
        ext = os.path.splitext(img.filename)[1].lower() if img.filename else ".jpg"
        if ext not in valid_extensions:
            if img.content_type and img.content_type.startswith("image/"):
                ext = ".jpg"
            else:
                continue

        filename = f"mfg_{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)

        content = await img.read()
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{img.filename}' too large (max 10MB)")

        with open(filepath, "wb") as f:
            f.write(content)

        saved_images.append(filepath.replace("\\", "/"))

        ocr_result = await run_in_threadpool(run_ocr, filepath)
        raw_angle_text = ocr_result.get("text", "").strip()
        if raw_angle_text:
            ocr_sections.append(f"--- [PANEL / ANGLE {idx + 1}] ---\n{raw_angle_text}")

    if not saved_images:
        raise HTTPException(status_code=400, detail="Invalid file type(s). Please upload images (PNG, JPG, WebP).")

    raw_text = "\n\n".join(ocr_sections) if ocr_sections else ""
    extracted_fields = extract_all_fields(raw_text)
    compliance = check_compliance(extracted_fields)

    primary_image_path = saved_images[0]
    label = ManufacturerLabel(
        user_id=user.id,
        product_name=product_name,
        label_image_path=primary_image_path,
        compliance_status=ComplianceStatus(compliance["status"]),
        compliance_result={
            "extracted_fields": extracted_fields,
            "compliance": compliance,
            "ocr_text": raw_text,
            "images": saved_images,
            "panel_count": len(saved_images),
        },
    )
    db.add(label)
    await db.commit()
    await db.refresh(label)

    return ManufacturerLabelResponse.model_validate(label)


@router.get("/labels", response_model=list[ManufacturerLabelResponse])
async def list_my_labels(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ManufacturerLabel)
        .where(ManufacturerLabel.user_id == user.id)
        .order_by(ManufacturerLabel.submitted_at.desc())
    )
    labels = result.scalars().all()
    return [ManufacturerLabelResponse.model_validate(l) for l in labels]


@router.get("/labels/{label_id}", response_model=ManufacturerLabelResponse)
async def get_label(
    label_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ManufacturerLabel).where(ManufacturerLabel.id == label_id)
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    if label.user_id != user.id and user.role not in (UserRole.ADMIN, UserRole.SUPERVISOR):
        raise HTTPException(status_code=403, detail="Not authorized")
    return ManufacturerLabelResponse.model_validate(label)
