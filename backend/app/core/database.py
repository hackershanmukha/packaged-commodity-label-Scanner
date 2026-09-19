from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import Settings

settings = Settings()

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


from sqlalchemy import text

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate existing tables for new columns safely
        migration_statements = [
            "ALTER TABLE scans ADD COLUMN image_paths JSON",
            "ALTER TABLE scans ADD COLUMN is_reviewed BOOLEAN DEFAULT 0",
            "ALTER TABLE scans ADD COLUMN inspector_id INTEGER REFERENCES users(id)",
            "ALTER TABLE scans ADD COLUMN inspector_name VARCHAR(255)",
            "ALTER TABLE scans ADD COLUMN inspector_notes TEXT",
            "ALTER TABLE scans ADD COLUMN inspector_action VARCHAR(100)",
            "ALTER TABLE scans ADD COLUMN reviewed_at DATETIME",
            "ALTER TABLE scans ADD COLUMN font_size_assessment JSON",
            "ALTER TABLE scans ADD COLUMN font_size_review JSON",
            "ALTER TABLE scans ADD COLUMN inspector_corrections JSON",
            "ALTER TABLE violations ADD COLUMN status VARCHAR(50) DEFAULT 'OPEN'",
            "ALTER TABLE violations ADD COLUMN inspector_remark TEXT",
        ]
        for stmt in migration_statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass

