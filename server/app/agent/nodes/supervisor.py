from pydantic import BaseModel,Field
from langchain_core.messages import SystemMessage
from app.core.config import settings
from langchain_openai import ChatOpenAI
from app.agent.state import AgentState


# Define the expected output struture for the LLM
class RouteSelection(BaseModel):
    next: str = Field(
        description="The next agent to route to. Must be one of: 'order_agent', 'payment_agent', or 'unclear'."
    )

llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)

# Force the LLM to return data matching our Pydantic model
structured_llm = llm.with_structured_output(RouteSelection)

async def supervisor_node(state:AgentState) -> dict:
    system_message = SystemMessage(
        content=(
            "You are a supervisor router. Your job is to classify the user's latest message. "
            "If it's about an order, route to 'order_agent'. "
            "If it's about a payment, route to 'payment_agent'. "
            "If it's neither or unclear, route to 'unclear'."
        )
    )

    # get the route decision
    decision = await structured_llm.ainvoke([system_message] + list(state['messages']))

    # extract route decision
    return {"next_node": decision.next}


    