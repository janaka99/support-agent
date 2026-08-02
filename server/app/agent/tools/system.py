from langchain_core.tools import tool

@tool
def escalate_to_human(reason: str) -> str:
    """Use this tool to escalate the conversation to a human agent when you cannot resolve the issue, or when the user explicitly asks for a human. You MUST provide a clear reason for the escalation."""
    return "Your conversation has been escalated to a human. Someone will be with you shortly."
