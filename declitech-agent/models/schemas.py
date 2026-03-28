from typing import Optional
from pydantic import BaseModel, Field


class StartRequest(BaseModel):
    code: str = Field(..., description="Session code")
    student_id: str = Field(..., description="Student ID")
    device_id: str = Field(..., description="Device/PC ID")
    duration_min: int = Field(30, ge=1, le=240, description="Session duration in minutes")
    interval_min: int = Field(15, ge=1, le=60, description="Capture interval in minutes")
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


class ScreenAnalysisRequest(BaseModel):
    session_id: str = Field(..., description="Session code")
    student_login_identity: Optional[str] = Field(None, description="Student login identity")
    timestamp: str = Field(..., description="Capture timestamp (ISO format)")
    screenshot_base64: str = Field(..., description="Base64-encoded JPEG screenshot")
    page_url: Optional[str] = Field(None, description="Current page URL")
    dom_data: Optional[dict] = Field(None, description="Extracted DOM data from Vittascience")


class ScreenAnalysisResponse(BaseModel):
    status: str = Field(..., description="Analysis status")
    exercise_name: Optional[str] = Field(None, description="Detected exercise name")
    progress_level: Optional[str] = Field(None, description="NOT_STARTED, STARTING, IN_PROGRESS, NEAR_COMPLETE, COMPLETE")
    on_track: Optional[bool] = Field(None, description="Whether the student is on track")
    observations: Optional[str] = Field(None, description="AI observations about student work")
