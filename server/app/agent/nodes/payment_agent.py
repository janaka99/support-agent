from app.agent.state import AgentState
from app.agent.tools.payment import check_payment_status
from langchain_openai import ChatOpenAI
from app.core.config import settings
from langchain_core.messages import SystemMessage



llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
llm_with_tools = llm.bind_tools([check_payment_status])



async def payment_specialist_node(state: AgentState) -> dict:
    system_message = SystemMessage(
        content="You are a payment specialist. Help the customer with payment issues using the available tools."
    )

    response = await llm_with_tools.ainvoke([system_message] + list(state["messages"]))

    return {"messages": [response]}
