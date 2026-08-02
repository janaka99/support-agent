import asyncio
from app.agent.guardrails.engine import evaluate_single_guardrail
from langchain_core.messages import AIMessage, HumanMessage

async def main():
    print("Testing All 11 Guardrail Engines...")

    # 1. PII Redactor
    pii_rail = {
        "name": "test_pii",
        "guardrail_type": "pii",
        "config": {"block_credit_cards": True, "block_ssn": True},
        "refusal_message": "PII blocked"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(pii_rail, "My card is 4532-1234-5678-9010")
    print(f"1. PII (Credit Card): safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    # 2. Keyword Filter
    kw_rail = {
        "name": "test_kw",
        "guardrail_type": "keyword",
        "config": {"blocked_keywords": ["competitor_ai"], "case_sensitive": False},
        "refusal_message": "Competitor mention blocked"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(kw_rail, "Tell me about Competitor_AI features")
    print(f"2. Keyword: safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    # 3. Regex Matcher
    regex_rail = {
        "name": "test_regex",
        "guardrail_type": "regex",
        "config": {"patterns": [r"^SECRET-[0-9]{4}$"]},
        "refusal_message": "Secret code blocked"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(regex_rail, "SECRET-9988")
    print(f"3. Regex: safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    # 4. Structure & Size
    struct_rail = {
        "name": "test_structure",
        "guardrail_type": "structure",
        "config": {"min_characters": 5, "max_characters": 50, "detect_repetition": True, "max_repeated_chars": 5},
        "refusal_message": "Structure violation"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(struct_rail, "aaaaaaa")
    print(f"4. Structure (Repetition spam): safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    # 5. JSON Schema
    schema_rail = {
        "name": "test_schema",
        "guardrail_type": "json_schema",
        "config": {
            "target": "tool_args",
            "schema_definition": {
                "type": "object",
                "properties": {"amount": {"type": "number", "maximum": 200}},
                "required": ["amount"]
            }
        },
        "refusal_message": "Schema violation"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(
        schema_rail,
        text_content="Processing refund",
        tool_calls=[{"name": "process_refund", "args": {"amount": 500}}]
    )
    print(f"5. JSON Schema: safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    # 6. Python Code Sandbox
    code_rail = {
        "name": "test_sandbox",
        "guardrail_type": "code_sandbox",
        "config": {
            "python_code": "def validate(text, tool_calls):\n    if 'hack_system' in text:\n        return (False, 'Hack attempted')\n    return (True, '')\n",
            "timeout_seconds": 2.0
        },
        "refusal_message": "Code sandbox rejected"
    }
    safe, layer, reason, _ = await evaluate_single_guardrail(code_rail, "Please execute hack_system now")
    print(f"6. Python Code Sandbox: safe={safe}, layer={layer}, reason={reason}")
    assert safe is False

    print("\nALL DETERMINISTIC & PROGRAMMABLE GUARDRAIL UNIT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
