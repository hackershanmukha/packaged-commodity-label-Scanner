from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "consumer"
    organization: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: str
    organization: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ScanCreate(BaseModel):
    scan_type: str = "manual"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    barcode: Optional[str] = None


class ViolationResponse(BaseModel):
    id: int
    rule_code: str
    rule_name: str
    description: str
    severity: str
    field_name: Optional[str]
    expected_value: Optional[str]
    actual_value: Optional[str]
    section_reference: Optional[str]
    status: Optional[str] = "OPEN"
    inspector_remark: Optional[str] = None

    class Config:
        from_attributes = True


class ViolationResolution(BaseModel):
    id: int
    status: str  # OPEN, VERIFIED_VIOLATION, RESOLVED_COMPLIANT, WAIVED, REVIEW_REQUIRED
    inspector_remark: Optional[str] = None


class InspectorReviewRequest(BaseModel):
    corrected_fields: Optional[dict] = None
    resolved_violations: Optional[list[ViolationResolution]] = None
    font_size_verification: Optional[dict] = None
    inspector_action: Optional[str] = "APPROVED_COMPLIANT"
    inspector_notes: Optional[str] = None
    final_compliance_status: Optional[str] = None
    finalize_report: bool = True


class ScanResponse(BaseModel):
    id: int
    user_id: int
    product_id: Optional[int]
    image_path: str
    image_paths: Optional[list[dict]] = None
    scan_type: str
    latitude: Optional[float]
    longitude: Optional[float]
    store_name: Optional[str]
    raw_ocr_text: Optional[str]
    extracted_fields: Optional[dict]
    barcode_detected: Optional[str]
    compliance_status: str
    compliance_score: Optional[float]
    total_checks: int
    passed_checks: int
    failed_checks: int
    is_reviewed: Optional[bool] = False
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    inspector_notes: Optional[str] = None
    inspector_action: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    font_size_assessment: Optional[dict] = None
    font_size_review: Optional[dict] = None
    inspector_corrections: Optional[dict] = None
    created_at: datetime
    violations: list[ViolationResponse] = []

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: int
    barcode: Optional[str]
    name: Optional[str]
    brand: Optional[str]
    category: Optional[str]
    manufacturer_name: Optional[str]
    manufacturer_address: Optional[str]
    net_quantity: Optional[str]
    mrp: Optional[float]
    country_of_origin: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_scans: int
    compliant_count: int
    non_compliant_count: int
    partial_count: int
    compliance_rate: float
    top_violations: list[dict]
    recent_scans: list[ScanResponse]
    scans_by_type: dict
    violation_severity_breakdown: dict


class ManufacturerLabelCreate(BaseModel):
    product_name: str


class ManufacturerLabelResponse(BaseModel):
    id: int
    product_name: str
    label_image_path: str
    compliance_status: str
    compliance_result: Optional[dict]
    is_approved: bool
    submitted_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True
