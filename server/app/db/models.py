import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import declarative_base, relationship
from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID

Base = declarative_base()

class Org(Base):
    __tablename__ = "orgs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    users = relationship("User", back_populates="org")
    conversations = relationship("Conversation", back_populates="org")
    agents = relationship("Agent", back_populates="org")

class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    role = Column(String, nullable=False, default="member") # "admin" or "member"
    
    org = relationship("Org", back_populates="users")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    status = Column(String, nullable=False, default="open") # "open", "closed", etc.
    
    org = relationship("Org", back_populates="conversations")
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

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String, nullable=False)
    specialization = Column(String, nullable=False)
    system_prompt = Column(String, nullable=False)
    model = Column(String, nullable=False)
    tools = Column(JSONB, nullable=True)
    guardrails = Column(JSONB, nullable=True)
    routing_examples = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    org = relationship("Org", back_populates="agents")
    documents = relationship("Document", back_populates="agent")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    content = Column(String, nullable=False)
    embedding = Column(Vector(1536), nullable=False)
    
    agent = relationship("Agent", back_populates="documents")
