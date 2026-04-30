from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import AppSettings

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    newsapi_key: Optional[str] = None
    base_url: Optional[str] = None


def _get(db: Session, key: str) -> Optional[str]:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else None


def _set(db: Session, key: str, value: str):
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))
    db.commit()


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    keys = [
        "smtp_host", "smtp_port", "smtp_user", "from_name",
        "from_email", "base_url", "newsapi_key",
    ]
    result = {}
    for k in keys:
        result[k] = _get(db, k) or ""
    result["anthropic_api_key"] = "***" if _get(db, "anthropic_api_key") else ""
    result["smtp_pass"] = "***" if _get(db, "smtp_pass") else ""
    return result


@router.post("/")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    import os
    mapping = data.dict(exclude_none=True)
    for key, value in mapping.items():
        if value:
            _set(db, key, value)
            env_key = key.upper()
            os.environ[env_key] = value
    return {"status": "saved"}
