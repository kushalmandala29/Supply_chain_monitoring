from pydantic import BaseModel


class UserQuery(BaseModel):
    session_id: str
    query: str


class RoutedQuery(BaseModel):
    session_id: str
    query: str
    intent: str
    agents: list[str]
