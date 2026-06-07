from pydantic import BaseModel, Field


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    locale: str = "ar"


class AssistantLink(BaseModel):
    label: str
    href: str


class AssistantResponse(BaseModel):
    reply: str
    links: list[AssistantLink] = []
