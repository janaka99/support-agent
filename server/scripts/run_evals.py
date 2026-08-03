import asyncio
import json
import uuid
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.core.database import async_session_maker
from app.db.models import Org
from app.agent.graph import build_graph
from app.core.config import settings

class EvalJudgeResult(BaseModel):
    passed: bool
    reason: str

async def run_evals():
    dataset_path = os.path.join(os.path.dirname(__file__), "../evals/dataset.json")
    try:
        with open(dataset_path, "r") as f:
            scenarios = json.load(f)
    except FileNotFoundError:
        print("Dataset not found at", dataset_path)
        sys.exit(1)

    print(f"Loaded {len(scenarios)} scenarios.")

    async with async_session_maker() as session:
        result = await session.execute(select(Org).where(Org.name == "Admin Corp"))
        org = result.scalar_one_or_none()
        if not org:
            print("Default org not found. Please seed the database.")
            sys.exit(1)

        print("Building agent graph...")
        graph = await build_graph(str(org.id), session)
        
        from app.db.models import Conversation
        
        # Create a dummy conversation for evals
        dummy_conv_id = uuid.uuid4()
        session.add(Conversation(id=dummy_conv_id, org_id=org.id, title="Eval Conversation"))
        await session.commit()
        
        passed_count = 0
        failed_scenarios = []

        judge_llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)

        print("\n--- Running Evaluations ---\n")

        for idx, scenario in enumerate(scenarios, 1):
            input_text = scenario["input"]
            expected_route = scenario["expected_route"]
            # standardize expected route to match node names (supervisor handles direct responses)
            if expected_route in ("unclear", "clarify_node"):
                expected_route = "supervisor_node"
                
            eval_criterion = scenario["eval_criterion"]

            print(f"Scenario {idx}/{len(scenarios)} [{scenario['id']}]: '{input_text}'")

            # Run graph
            new_message = HumanMessage(content=input_text)
            state_input = {
                "messages": [new_message],
                "conversation_id": str(dummy_conv_id)
            }

            nodes_visited = []
            final_content = ""

            try:
                # Use astream to track nodes
                async for event in graph.astream(state_input):
                    for node_name, state_update in event.items():
                        nodes_visited.append(node_name)
                        if "messages" in state_update and len(state_update["messages"]) > 0:
                            last_msg = state_update["messages"][-1]
                            if hasattr(last_msg, "content") and last_msg.content:
                                final_content = last_msg.content
            except Exception as e:
                print(f"  [ERROR] Graph execution failed: {e}")
                failed_scenarios.append({
                    "id": scenario["id"],
                    "reason": f"Execution Error: {str(e)}"
                })
                continue

            # Determine actual route (first node after supervisor_node)
            actual_route = None
            for node in nodes_visited:
                if node != "supervisor_node" and node != "tools":
                    actual_route = node
                    break
            
            # Check Routing
            route_passed = (actual_route == expected_route)

            # Check Output using LLM Judge
            judge_prompt = (
                f"You are an impartial evaluator checking a customer support agent's response.\n\n"
                f"User Input: {input_text}\n"
                f"Agent Output: {final_content}\n\n"
                f"Evaluation Criterion: {eval_criterion}\n\n"
                f"Did the Agent Output satisfy the Evaluation Criterion? Respond with structured data."
            )
            
            structured_judge = judge_llm.with_structured_output(EvalJudgeResult)
            try:
                judge_result = await structured_judge.ainvoke([SystemMessage(content=judge_prompt)])
                output_passed = judge_result.passed
                judge_reason = judge_result.reason
            except Exception as e:
                output_passed = False
                judge_reason = f"Judge LLM failed: {e}"

            overall_passed = route_passed and output_passed

            if overall_passed:
                print(f"  [PASS] Route: {actual_route} | Output judged OK")
                passed_count += 1
            else:
                fail_reasons = []
                if not route_passed:
                    fail_reasons.append(f"Expected route '{expected_route}', but got '{actual_route}'")
                if not output_passed:
                    fail_reasons.append(f"Output failed criterion: {judge_reason}")
                
                print(f"  [FAIL] " + " | ".join(fail_reasons))
                failed_scenarios.append({
                    "id": scenario["id"],
                    "input": input_text,
                    "expected_route": expected_route,
                    "actual_route": actual_route,
                    "criterion": eval_criterion,
                    "final_content": final_content,
                    "judge_reason": judge_reason
                })

        print("\n--- Evaluation Summary ---")
        print(f"Total Scenarios: {len(scenarios)}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {len(scenarios) - passed_count}")
        print(f"Pass Rate: {(passed_count / len(scenarios)) * 100:.1f}%")

        if failed_scenarios:
            print("\nFailures:")
            for fail in failed_scenarios:
                print(f"  - [{fail['id']}] Input: '{fail.get('input', '')}'")
                print(f"    Expected Route: {fail.get('expected_route', '')} | Actual: {fail.get('actual_route', '')}")
                print(f"    Agent Output: {fail.get('final_content', '')}")
                print(f"    Judge Reason: {fail.get('judge_reason', '')}\n")

if __name__ == "__main__":
    # Disable tracebacks for cleaner CLI output
    sys.tracebacklimit = 0
    asyncio.run(run_evals())
