from typing import Optional
from pydantic import BaseModel, Field


class StartRequest(BaseModel):
    code: str = Field(..., description="Session code")
    student_id: str = Field(..., description="Student ID")
    device_id: str = Field(..., description="Device/PC ID")
    duration_min: int = Field(30, ge=1, le=240, description="Session duration in minutes")
    interval_min: int = Field(15, ge=1, le=60, description="Capture interval in minutes (legacy)")
    interval_sec: Optional[int] = Field(
        None, ge=2, le=3600,
        description="Capture interval in seconds. When set, overrides interval_min.",
    )
    login_identity: str = Field(..., description="Student login identity (username/email)")


class StatusResponse(BaseModel):
    running: bool = Field(..., description="Whether the agent is currently running")
    session_id: Optional[str] = Field(None, description="Current session ID")
    last_error: Optional[str] = Field(None, description="Last error message, if any")
    login_identity: Optional[str] = Field(None, description="Current participant login identity")


class SessionValidationResponse(BaseModel):
    valid: bool = Field(..., description="Whether the session code is valid")
    reason: str = Field(..., description="Validation result reason")
    session: Optional[dict] = Field(None, description="Session details if valid")


class AgentControlResponse(BaseModel):
    status: str = Field(..., description="Operation status")
    session_id: Optional[str] = Field(None, description="Session ID (if started)")
