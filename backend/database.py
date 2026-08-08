import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# ============================================================
# Project directory
# ============================================================

BASE_DIR = Path(__file__).resolve().parent


# ============================================================
# Load .env for local development
# ============================================================

load_dotenv(BASE_DIR / ".env")


# ============================================================
# SQLite database
# ============================================================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'notes.db'}"
)


# ============================================================
# SQLite engine
# ============================================================

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    }
    if DATABASE_URL.startswith("sqlite")
    else {},
)


# ============================================================
# Session
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# Base
# ============================================================

Base = declarative_base()


# ============================================================
# Database dependency
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
