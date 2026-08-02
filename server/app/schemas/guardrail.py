from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Literal
from uuid import UUID
from datetime import datetime

# Guardrail Enums / Literals - Complete 11-Engine Suite
GuardrailType = Literal[
    "pii",
    "keyword",
    "regex",
    "structure",
    "moderation",
    "embedding",
    "llm_judge",
    "hallucination",
    "json_schema",
    "code_sandbox",
    "webhook",
]
GuardrailStage = Literal["ingress", "pre_tool", "egress"]
GuardrailAction = Literal["block_and_respond", "escalate_to_human", "mask_and_continue"]

# ==========================================
# Config Schemas for all 11 Engine Types
# ==========================================

# 1. PII Redactor / Blocker
class PIIConfig(BaseModel):
    enabled: bool = Field(default=True, description="Enable deterministic PII checking")
    block_credit_cards: bool = Field(default=True, description="Detect and block 13-19 digit credit card numbers")
    block_ssn: bool = Field(default=True, description="Detect and block US Social Security Numbers")
    block_emails: bool = Field(default=False, description="Detect and block email addresses")
    block_phone_numbers: bool = Field(default=False, description="Detect and block phone numbers")

# 2. Keyword Filter
class KeywordConfig(BaseModel):
    blocked_keywords: List[str] = Field(default_factory=list, description="Keywords or phrases to block")
    case_sensitive: bool = Field(default=False, description="Whether matching is case sensitive")

# 3. Custom Regex
class RegexConfig(BaseModel):
    patterns: List[str] = Field(default_factory=list, description="Regex patterns to match against")
    description: Optional[str] = Field(default=None, description="Pattern description")

# 4. Structure & Size Limits
class StructureConfig(BaseModel):
    min_characters: Optional[int] = Field(default=None, ge=1, description="Minimum allowed message length")
    max_characters: Optional[int] = Field(default=4000, ge=10, description="Maximum allowed message length")
    detect_repetition: bool = Field(default=True, description="Detect character or token repetition spam loops")
    max_repeated_chars: int = Field(default=15, ge=3, description="Threshold for consecutive repeating characters")
    max_newlines: int = Field(default=20, ge=1, description="Maximum allowed consecutive or total line breaks")

# 5. Content Moderation (OpenAI Moderation API)
class ModerationConfig(BaseModel):
    categories: List[str] = Field(
        default=["hate", "harassment", "self-harm", "sexual", "violence"],
        description="Flagged violation categories to enforce"
    )
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Score threshold to trigger violation")

# 6. Semantic Embedding Distance
class EmbeddingConfig(BaseModel):
    forbidden_topics: List[str] = Field(
        default_factory=list,
        description="Text descriptions of prohibited topic clusters (e.g., 'medical diagnosis', 'cryptocurrency investment')"
    )
    similarity_threshold: float = Field(
        default=0.75,
        ge=0.1,
        le=0.99,
        description="Cosine similarity threshold above which a query is deemed off-topic"
    )
    model: str = Field(default="text-embedding-3-small", description="Embedding model to use")

# 7. LLM Policy & Jailbreak Judge
class LLMJudgeConfig(BaseModel):
    prompt_injection_shield: bool = Field(default=True, description="Detect adversarial jailbreak attempts")
    rules: List[str] = Field(default_factory=list, description="Natural language policy rules")
    model: str = Field(default="gpt-4o-mini", description="LLM model used for judging")

# 8. Hallucination / Fact Groundedness Checker
class HallucinationConfig(BaseModel):
    strictness: Literal["strict", "moderate"] = Field(
        default="moderate",
        description="Strictness level for detecting ungrounded statements"
    )
    require_grounding: bool = Field(
        default=True,
        description="Require that factual claims must strictly match retrieved context"
    )
    model: str = Field(default="gpt-4o-mini", description="LLM model for groundedness checking")

# 9. JSON Schema Validator
class JsonSchemaConfig(BaseModel):
    schema_definition: Dict[str, Any] = Field(
        default_factory=dict,
        description="JSON Schema Draft-7 definition object"
    )
    target: Literal["tool_args", "assistant_output"] = Field(
        default="tool_args",
        description="Target payload to validate against schema"
    )

# 10. Custom Python Code Sandbox
class CodeSandboxConfig(BaseModel):
    python_code: str = Field(
        default="def validate(text: str, tool_calls: list) -> tuple[bool, str]:\n    # return (is_safe, violation_reason)\n    return (True, '')\n",
        description="Python code snippet with a validate(text, tool_calls) function"
    )
    timeout_seconds: float = Field(default=2.0, ge=0.1, le=10.0, description="Execution timeout in seconds")

# 11. Remote Webhook Validator
class WebhookConfig(BaseModel):
    url: str = Field(..., description="External verification service endpoint")
    method: str = Field(default="POST", description="HTTP method")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Custom headers e.g. API key")
    timeout_seconds: float = Field(default=3.0, description="Request timeout in seconds")

# ==========================================
# First-Class Guardrail Schemas
# ==========================================

class GuardrailBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Slug identifier (e.g. payment_pii_redactor)")
    display_name: str = Field(..., min_length=2, max_length=150, description="Display name for UI")
    description: Optional[str] = Field(default="", description="Purpose and behavior of this safety guardrail")
    guardrail_type: GuardrailType = Field(default="pii", description="Type of guardrail check")
    stage: GuardrailStage = Field(default="ingress", description="Execution pipeline stage: ingress, pre_tool, or egress")
    config: Dict[str, Any] = Field(default_factory=dict, description="Configuration parameters for the specific guardrail type")
    action_on_violation: GuardrailAction = Field(default="block_and_respond", description="Action taken when triggered")
    refusal_message: Optional[str] = Field(
        default="I am unable to fulfill this request as it violates safety guidelines or exceeds authorized limits.",
        description="Message presented to user upon violation"
    )
    is_active: bool = Field(default=True, description="Whether guardrail is currently active")

class GuardrailCreate(GuardrailBase):
    pass

class GuardrailUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    guardrail_type: Optional[GuardrailType] = None
    stage: Optional[GuardrailStage] = None
    config: Optional[Dict[str, Any]] = None
    action_on_violation: Optional[GuardrailAction] = None
    refusal_message: Optional[str] = None
    is_active: Optional[bool] = None

class GuardrailSummary(BaseModel):
    id: UUID
    name: str
    display_name: str
    description: Optional[str] = None
    guardrail_type: GuardrailType
    stage: GuardrailStage
    action_on_violation: GuardrailAction
    is_active: bool
    created_at: datetime
    linked_bots_count: Optional[int] = 0
    linked_agents_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class GuardrailResponse(GuardrailBase):
    id: UUID
    org_id: UUID
    created_at: datetime
    linked_bots_count: Optional[int] = 0
    linked_agents_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

# Legacy & Sandbox Testing Schemas
class GuardrailConfig(BaseModel):
    enabled: bool = Field(default=True, description="Master switch for guardrails")
    prompt_injection_shield: bool = Field(default=True, description="Analyze and block prompt injection")
    pii_detection: Optional[PIIConfig] = Field(default_factory=PIIConfig, description="PII detection settings")
    blocked_keywords: List[str] = Field(default_factory=list, description="List of prohibited keywords")
    custom_rules: List[str] = Field(default_factory=list, description="Custom safety rules")
    action_on_violation: GuardrailAction = Field(default="block_and_respond")
    refusal_message: str = Field(
        default="I am unable to fulfill this request as it violates safety guidelines or exceeds authorized limits."
    )

class GuardrailTestRequest(BaseModel):
    test_message: str = Field(..., min_length=1, description="Sample user query or proposed action to test")
    guardrail_id: Optional[UUID] = Field(default=None, description="Optional existing guardrail ID to test against")
    guardrail: Optional[GuardrailCreate] = Field(default=None, description="Optional inline guardrail definition to test")
    guardrails: Optional[GuardrailConfig] = Field(default=None, description="Legacy config support")
    proposed_tool_calls: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional tool calls to simulate")
    simulated_rag_context: Optional[str] = Field(default=None, description="Optional RAG knowledge context to test hallucination checking")

class GuardrailTestResponse(BaseModel):
    passed: bool
    violation_layer: Optional[str] = None
    violation_reason: Optional[str] = None
    suggested_action: str
    rendered_response: str
