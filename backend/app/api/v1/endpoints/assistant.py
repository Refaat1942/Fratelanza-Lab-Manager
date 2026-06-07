from fastapi import APIRouter

from app.api.deps import CurrentTenant, CurrentUser, DbSession
from app.schemas.assistant import AssistantMessage, AssistantResponse
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["Assistant"])


@router.post("/chat", response_model=AssistantResponse)
async def chat(
    data: AssistantMessage,
    db: DbSession,
    tenant: CurrentTenant,
    user: CurrentUser,
):
    result = await AssistantService(db).chat(tenant.id, data.message, data.locale)
    return AssistantResponse(**result)
