from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name must not be empty or whitespace")
        return value.strip()


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    id: int
    name: str
    email: EmailStr


class UserEmailUpdate(BaseModel):
        email: EmailStr


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., min_length=1)
    tag: Optional[str] = Field(default="")
    owner_id: int


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    content: Optional[str] = Field(None, min_length=1)
    tag: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    tag: str
    owner_id: int
    created_at: datetime
    attachment_url: Optional[str] = None

    model_config = {
        "from_attributes": True,
    }


class AISuggestion(BaseModel):
    tags: List[str]
    summary: str


class NoteCreateResponse(NoteOut):
    ai_suggestion: Optional[AISuggestion] = None
