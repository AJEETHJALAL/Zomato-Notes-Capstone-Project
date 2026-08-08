import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv(
    dotenv_path=os.path.join(os.path.dirname(__file__), ".env")
)

# -----------------------------
# PostgreSQL
# -----------------------------

POSTGRES_URL = os.getenv("DATABASE_URL")

if not POSTGRES_URL:
    raise RuntimeError("DATABASE_URL is not configured")

if POSTGRES_URL.startswith("postgres://"):
    POSTGRES_URL = POSTGRES_URL.replace(
        "postgres://",
        "postgresql://",
        1
    )

postgres_engine = create_engine(
    POSTGRES_URL,
    pool_pre_ping=True,
)

PostgresSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=postgres_engine,
)


# -----------------------------
# SQLite
# -----------------------------

SQLITE_URL = "sqlite:///./zomato_notes.db"

sqlite_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
)

SQLiteSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sqlite_engine,
)


# -----------------------------
# SQLAlchemy models
# -----------------------------

Base = declarative_base()


def get_db():
    """
    Primary database: PostgreSQL
    """
    db = PostgresSessionLocal()

    try:
        yield db
    finally:
        db.close()


def get_sqlite_db():
    """
    Secondary database: SQLite
    """
    db = SQLiteSessionLocal()

    try:
        yield db
    finally:
        db.close()
