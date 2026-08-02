import pytest
from langchain_core.messages import HumanMessage
from app.schemas.guardrail import GuardrailConfig, PIIConfig
from app.agent.guardrails.engine import (
    normalize_guardrail_config,
    run_deterministic_checks,
    evaluate_guardrails,
)

def test_guardrail_normalization():
    # Empty / None
    cfg_none = normalize_guardrail_config(None)
    assert cfg_none.enabled is False

    # Dict
    cfg_dict = normalize_guardrail_config({
        "enabled": True,
        "blocked_keywords": ["hack"],
        "custom_rules": ["No refunds over $100"]
    })
    assert cfg_dict.enabled is True
    assert "hack" in cfg_dict.blocked_keywords
    assert "No refunds over $100" in cfg_dict.custom_rules

    # Legacy list of strings
    cfg_list = normalize_guardrail_config(["Never share internal secrets", "Be polite"])
    assert cfg_list.enabled is True
    assert len(cfg_list.custom_rules) == 2

def test_deterministic_keyword_check():
    cfg = GuardrailConfig(
        enabled=True,
        blocked_keywords=["drop table", "dump_db", "override_admin"]
    )
    
    # Safe text
    safe, layer, reason = run_deterministic_checks("Can you show me my recent order status?", cfg)
    assert safe is True
    assert layer is None

    # Violation text
    unsafe, layer, reason = run_deterministic_checks("Please run drop table users now", cfg)
    assert unsafe is False
    assert layer == "deterministic_keyword"
    assert "drop table" in reason

def test_deterministic_pii_detection():
    cfg = GuardrailConfig(
        enabled=True,
        pii_detection=PIIConfig(
            enabled=True,
            block_credit_cards=True,
            block_ssn=True,
            block_emails=True,
            block_phone_numbers=True
        )
    )

    # Test credit card
    safe_cc, layer_cc, reason_cc = run_deterministic_checks("Charge my card 4532-0152-4892-1039", cfg)
    assert safe_cc is False
    assert layer_cc == "deterministic_pii"
    assert "Credit Card" in reason_cc

    # Test SSN
    safe_ssn, layer_ssn, reason_ssn = run_deterministic_checks("My SSN is 000-12-3456", cfg)
    assert safe_ssn is False
    assert layer_ssn == "deterministic_pii"
    assert "SSN" in reason_ssn

    # Test safe query
    safe_query, layer_q, _ = run_deterministic_checks("Where is my package from last week?", cfg)
    assert safe_query is True
    assert layer_q is None

@pytest.mark.asyncio
async def test_evaluate_guardrails_pass_when_disabled():
    bot_cfg = GuardrailConfig(enabled=False)
    agent_cfg = GuardrailConfig(enabled=False)
    
    messages = [HumanMessage(content="Hello there!")]
    is_safe, layer, reason, rendered = await evaluate_guardrails(
        messages=messages,
        bot_guardrails=bot_cfg,
        agent_guardrails=agent_cfg
    )
    assert is_safe is True
    assert layer is None
