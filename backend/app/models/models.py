import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime,
    ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    CONSUMER = "consumer"
    INSPECTOR = "inspector"
    SUPERVISOR = "supervisor"
    MANUFACTURER = "manufacturer"
    ADMIN = "admin"


class ComplianceStatus(str, enum.Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PARTIALLY_COMPLIANT = "partially_compliant"
    REVIEW_REQUIRED = "review_required"
    PENDING = "pending"


class ViolationSeverity(str, enum.Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    INFO = "info"


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(Enum(UserRole), default=UserRole.CONSUMER, nullable=False)
    organization = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    scans = relationship("Scan", back_populates="user", foreign_keys="Scan.user_id")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    manufacturer_name = Column(String(255), nullable=True)
    manufacturer_address = Column(Text, nullable=True)
    net_quantity = Column(String(100), nullable=True)
    mrp = Column(Float, nullable=True)
    country_of_origin = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    scans = relationship("Scan", back_populates="product")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    image_path = Column(String(500), nullable=False)
    image_paths = Column(JSON, nullable=True)
    scan_type = Column(String(50), default="manual")  # manual, live_camera, crowdsource
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    store_name = Column(String(255), nullable=True)
    store_address = Column(Text, nullable=True)

    raw_ocr_text = Column(Text, nullable=True)
    extracted_fields = Column(JSON, nullable=True)
    barcode_detected = Column(String(50), nullable=True)

    compliance_status = Column(Enum(ComplianceStatus), default=ComplianceStatus.PENDING)
    compliance_score = Column(Float, nullable=True)
    total_checks = Column(Integer, default=0)
    passed_checks = Column(Integer, default=0)
    failed_checks = Column(Integer, default=0)

    # Inspector Review & Font Size Verification Extensions
    is_reviewed = Column(Boolean, default=False)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    inspector_name = Column(String(255), nullable=True)
    inspector_notes = Column(Text, nullable=True)
    inspector_action = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    font_size_assessment = Column(JSON, nullable=True)
    font_size_review = Column(JSON, nullable=True)
    inspector_corrections = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="scans", foreign_keys=[user_id])
    inspector = relationship("User", foreign_keys=[inspector_id])
    product = relationship("Product", back_populates="scans")
    violations = relationship("Violation", back_populates="scan", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="scan", uselist=False)


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=False)
    rule_code = Column(String(50), nullable=False)
    rule_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Enum(ViolationSeverity), default=ViolationSeverity.MAJOR)
    field_name = Column(String(100), nullable=True)
    expected_value = Column(Text, nullable=True)
    actual_value = Column(Text, nullable=True)
    section_reference = Column(String(100), nullable=True)

    # Inspector status tracking & resolution
    status = Column(String(50), default="OPEN")  # OPEN, VERIFIED_VIOLATION, RESOLVED_COMPLIANT, WAIVED, REVIEW_REQUIRED
    inspector_remark = Column(Text, nullable=True)

    scan = relationship("Scan", back_populates="violations")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scans.id"), unique=True, nullable=False)
    report_number = Column(String(50), unique=True, nullable=False)
    pdf_path = Column(String(500), nullable=True)
    hash_chain = Column(String(128), nullable=True)
    previous_hash = Column(String(128), nullable=True)
    generated_at = Column(DateTime, default=utcnow)

    scan = relationship("Scan", back_populates="report")


class ManufacturerLabel(Base):
    __tablename__ = "manufacturer_labels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_name = Column(String(255), nullable=False)
    label_image_path = Column(String(500), nullable=False)
    compliance_status = Column(Enum(ComplianceStatus), default=ComplianceStatus.PENDING)
    compliance_result = Column(JSON, nullable=True)
    is_approved = Column(Boolean, default=False)
    submitted_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User")
