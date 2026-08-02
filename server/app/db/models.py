import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Integer, Float, Boolean, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import declarative_base, relationship
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID

Base = declarative_base()

# Many-to-Many Join Table: Agent <-> Tool
agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column("agent_id", UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_id", UUID(as_uuid=True), ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime, default=datetime.utcnow, nullable=False)
)

# Many-to-Many Join Table: Bot <-> Guardrail
bot_guardrails = Table(
    "bot_guardrails",
    Base.metadata,
    Column("bot_id", UUID(as_uuid=True), ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True),
    Column("guardrail_id", UUID(as_uuid=True), ForeignKey("guardrails.id", ondelete="CASCADE"), primary_key=True),
    Column("priority", Integer, default=0, nullable=False),
    Column("created_at", DateTime, default=datetime.utcnow, nullable=False)
)

# Many-to-Many Join Table: Agent <-> Guardrail
agent_guardrails = Table(
    "agent_guardrails",
    Base.metadata,
    Column("agent_id", UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("guardrail_id", UUID(as_uuid=True), ForeignKey("guardrails.id", ondelete="CASCADE"), primary_key=True),
    Column("priority", Integer, default=0, nullable=False),
    Column("created_at", DateTime, default=datetime.utcnow, nullable=False)
)

class Org(Base):
    __tablename__ = "orgs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    users = relationship("User", back_populates="org")
    conversations = relationship("Conversation", back_populates="org")
    agents = relationship("Agent", back_populates="org")
    bots = relationship("Bot", back_populates="org")
    tools = relationship("Tool", back_populates="org")
    guardrails = relationship("Guardrail", back_populates="org")

class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    role = Column(String, nullable=False, default="member") # "admin" or "member"
    
    org = relationship("Org", back_populates="users")

class Tool(Base):
    __tablename__ = "tools"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False) # slug identifier e.g. "fetch_order_status"
    display_name = Column(String, nullable=False) # e.g. "Fetch Order Details"
    description = Column(String, nullable=False) # Prompt explanation for LLM tool binding
    tool_type = Column(String, nullable=False, default="http_request") # "http_request", "webhook", "rag_retriever", "code_sandbox", "builtin"
    config = Column(JSONB, nullable=False, default=dict) # URL, method, headers, auth, body template, etc.
    parameters_schema = Column(JSONB, nullable=False, default=dict) # JSON Schema for LLM function arguments
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="tools")
    agents = relationship("Agent", secondary=agent_tools, back_populates="tools")

class Guardrail(Base):
    __tablename__ = "guardrails"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False) # slug identifier e.g. "payment_pii_redactor"
    display_name = Column(String, nullable=False) # e.g. "Payment PII Redactor"
    description = Column(String, nullable=False) # Explanation of the safety policy
    guardrail_type = Column(String, nullable=False, default="pii") # "pii", "keyword", "llm_judge", "regex", "webhook"
    stage = Column(String, nullable=False, default="ingress") # "ingress", "pre_tool", "egress"
    config = Column(JSONB, nullable=False, default=dict) # type-specific parameters
    action_on_violation = Column(String, nullable=False, default="block_and_respond") # "block_and_respond", "escalate_to_human", "mask_and_continue"
    refusal_message = Column(String, nullable=True) # Custom message presented upon violation
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="guardrails")
    bots = relationship("Bot", secondary=bot_guardrails, back_populates="attached_guardrails")
    agents = relationship("Agent", secondary=agent_guardrails, back_populates="attached_guardrails")

class BotAgent(Base):
    __tablename__ = "bot_agents"
    
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    routing_hint = Column(String, nullable=True) # Bot-specific override for when supervisor routes to this agent
    priority = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    bot = relationship("Bot", back_populates="bot_agents")
    agent = relationship("Agent", back_populates="bot_associations")

class Bot(Base):
    __tablename__ = "bots"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    greeting_message = Column(String, nullable=True, default="Hello! How can I help you today?")
    system_prompt = Column(String, nullable=True) # Global routing and persona instructions for supervisor
    model = Column(String, nullable=False, default="gpt-4o-mini")
    is_active = Column(Boolean, default=True, nullable=False)
    guardrails = Column(JSONB, nullable=True, default=dict) # legacy embedded config support
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="bots")
    bot_agents = relationship("BotAgent", back_populates="bot", cascade="all, delete-orphan")
    agents = relationship("Agent", secondary="bot_agents", viewonly=True)
    attached_guardrails = relationship("Guardrail", secondary=bot_guardrails, back_populates="bots")
    conversations = relationship("Conversation", back_populates="bot")

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    specialization = Column(String, nullable=False)
    system_prompt = Column(String, nullable=False)
    model = Column(String, nullable=False, default="gpt-4o-mini")
    temperature = Column(Float, default=0.2, nullable=False)
    guardrails = Column(JSONB, nullable=True) # legacy embedded config support
    routing_examples = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="agents")
    documents = relationship("Document", back_populates="agent")
    tools = relationship("Tool", secondary=agent_tools, back_populates="agents")
    attached_guardrails = relationship("Guardrail", secondary=agent_guardrails, back_populates="agents")
    bot_associations = relationship("BotAgent", back_populates="agent", cascade="all, delete-orphan")
    bots = relationship("Bot", secondary="bot_agents", viewonly=True)

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id"), nullable=True)
    status = Column(String, nullable=False, default="open") # "open", "closed", etc.
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="conversations")
    bot = relationship("Bot", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    role = Column(String, nullable=False) # "user", "assistant", "system"
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    conversation = relationship("Conversation", back_populates="messages")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    content = Column(String, nullable=False)
    embedding = Column(Vector(1536), nullable=False)
    
    agent = relationship("Agent", back_populates="documents")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    tool_name = Column(String, nullable=False)
    input = Column(JSONB, nullable=False)
    output = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Escalation(Base):
    __tablename__ = "escalations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org")
    conversation = relationship("Conversation")

class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    node_name = Column(String, nullable=True)
    model = Column(String, nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    cost_usd = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org")
    conversation = relationship("Conversation")
