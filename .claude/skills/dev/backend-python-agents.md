---
name: backend-python-agents
description: >
  Build production-ready Python backends with FastAPI, Celery, and AI agent orchestration
  using the Anthropic SDK. Use this skill whenever building or documenting a Python backend
  that includes AI agents, async task queues, LLM integrations, tool definitions, or
  multi-agent orchestration systems. Triggers on: build the backend, FastAPI, Python agents,
  Celery workers, tool definition, agent orchestration, async pipeline, or any request
  involving Python server-side code for AI systems. Always use when the system involves
  Claude API calls, agent tools, shared state management, or background job processing.
---

# Backend Python — FastAPI + Celery + AI Agents

A skill for building production-grade Python backends for AI agent platforms. Covers project structure, FastAPI endpoints, Celery tasks, agent definitions, tool implementations, and shared state management.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app initialization
│   ├── config.py                  # Settings from environment variables
│   ├── database.py                # Supabase client setup
│   ├── storage.py                 # Cloudflare R2 client setup
│   │
│   ├── api/                       # FastAPI route handlers
│   │   ├── __init__.py
│   │   ├── projects.py
│   │   ├── executions.py
│   │   ├── assets.py
│   │   ├── campaigns.py
│   │   └── webhooks.py
│   │
│   ├── agents/                    # Agent definitions
│   │   ├── __init__.py
│   │   ├── base.py                # BaseAgent class
│   │   ├── orchestrator.py        # Main orchestrator
│   │   ├── product_analyzer.py
│   │   ├── market_researcher.py
│   │   ├── persona_builder.py
│   │   ├── angle_strategist.py
│   │   ├── campaign_strategist.py
│   │   ├── script_writer.py
│   │   ├── copy_writer.py
│   │   ├── character_generator.py
│   │   ├── keyframe_generator.py
│   │   ├── video_generator.py
│   │   ├── creative_director.py
│   │   ├── compliance_checker.py
│   │   ├── media_buyer_facebook.py
│   │   ├── media_buyer_google.py
│   │   ├── performance_analyst.py
│   │   └── scaler.py
│   │
│   ├── tools/                     # Tool implementations
│   │   ├── __init__.py
│   │   ├── registry.py            # Central tool registry
│   │   ├── web_search.py
│   │   ├── read_page.py
│   │   ├── extract_structured.py
│   │   ├── search_ad_library.py
│   │   ├── search_youtube.py
│   │   ├── transcribe_video.py
│   │   ├── generate_image.py
│   │   ├── generate_video.py
│   │   ├── render_video_ffmpeg.py
│   │   ├── facebook_ads.py
│   │   ├── google_ads.py
│   │   └── storage_r2.py
│   │
│   ├── orchestration/             # Execution engine
│   │   ├── __init__.py
│   │   ├── executor.py            # Main execution loop
│   │   ├── context_builder.py     # Context injection per agent
│   │   ├── state_manager.py       # Shared state read/write
│   │   ├── rate_limiter.py        # Per-API rate limiting
│   │   └── cost_tracker.py        # Token and cost tracking
│   │
│   ├── memory/                    # Knowledge base
│   │   ├── __init__.py
│   │   ├── niche_memory.py
│   │   ├── pattern_intelligence.py
│   │   └── approval_queue.py
│   │
│   ├── models/                    # Pydantic models
│   │   ├── __init__.py
│   │   ├── project.py
│   │   ├── execution.py
│   │   ├── asset.py
│   │   ├── campaign.py
│   │   └── state.py               # ExecutionState model
│   │
│   └── workers/                   # Celery tasks
│       ├── __init__.py
│       ├── celery_app.py
│       └── execution_tasks.py
│
├── tests/
├── .env
├── requirements.txt
└── docker-compose.yml
```

---

## BaseAgent Pattern

Every agent inherits from BaseAgent:

```python
# app/agents/base.py
from abc import ABC, abstractmethod
from typing import Any
import anthropic
from app.models.state import ExecutionState
from app.orchestration.cost_tracker import CostTracker

class BaseAgent(ABC):
    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.max_retries = 2
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Agent identifier used in logs and state."""
        pass
    
    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """The agent's role and behavioral instructions."""
        pass
    
    @property
    @abstractmethod
    def tools(self) -> list[dict]:
        """Tool definitions this agent can use."""
        pass
    
    @abstractmethod
    def build_context(self, state: ExecutionState) -> dict:
        """Extract only the fields this agent needs from shared state."""
        pass
    
    @abstractmethod
    def build_user_message(self, context: dict) -> str:
        """Construct the user message for this agent's task."""
        pass
    
    @abstractmethod
    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        """
        Evaluate if the output meets quality criteria.
        Returns: (passed: bool, failure_reason: str)
        """
        pass
    
    @abstractmethod
    def write_to_state(self, output: Any, state: ExecutionState) -> ExecutionState:
        """Write this agent's output to the appropriate state fields."""
        pass
    
    async def run(
        self, 
        state: ExecutionState, 
        cost_tracker: CostTracker,
        human_feedback: str | None = None
    ) -> tuple[ExecutionState, dict]:
        """
        Main execution loop with auto-evaluation and retry.
        Returns: (updated_state, run_metadata)
        """
        context = self.build_context(state)
        attempt_history = []
        
        for attempt in range(self.max_retries + 1):
            # Build message with attempt history if retrying
            user_message = self.build_user_message(context)
            if human_feedback and attempt == 0:
                user_message = f"Human feedback on previous attempt: {human_feedback}\n\n{user_message}"
            if attempt_history:
                history_summary = self._compress_attempt_history(attempt_history)
                user_message = f"{history_summary}\n\n{user_message}"
            
            # Call Claude
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                tools=self.tools,
                messages=[{"role": "user", "content": user_message}]
            )
            
            # Track cost
            cost_tracker.record(
                agent_name=self.name,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                model=self.model
            )
            
            # Parse output
            output = self._parse_response(response)
            
            # Evaluate
            passed, failure_reason = self.evaluate_output(output, context)
            
            attempt_history.append({
                "attempt": attempt + 1,
                "output_summary": self._summarize_output(output),
                "passed": passed,
                "failure_reason": failure_reason if not passed else None
            })
            
            if passed:
                state = self.write_to_state(output, state)
                return state, {
                    "attempts": len(attempt_history),
                    "auto_eval_passed": True,
                    "attempt_history": attempt_history
                }
        
        # Max retries reached — write best output with quality flag
        state = self.write_to_state(output, state)
        state.execution_meta.quality_warnings.append({
            "agent": self.name,
            "message": f"Max retries reached. Last failure: {failure_reason}"
        })
        return state, {
            "attempts": len(attempt_history),
            "auto_eval_passed": False,
            "attempt_history": attempt_history
        }
    
    def _compress_attempt_history(self, history: list[dict]) -> str:
        """Compress attempt history to a token-efficient summary."""
        lines = ["Previous attempts that did not meet quality criteria:"]
        for h in history:
            lines.append(f"Attempt {h['attempt']}: {h['failure_reason']}")
            lines.append(f"  Output was: {h['output_summary']}")
        lines.append("Avoid the above issues in your next attempt.")
        return "\n".join(lines)
    
    def _parse_response(self, response) -> Any:
        """Extract structured output from Claude's response."""
        # Override in subclass for tool-use parsing
        return response.content[0].text
    
    def _summarize_output(self, output: Any) -> str:
        """Create a brief summary of the output for history compression."""
        if isinstance(output, str):
            return output[:200] + "..." if len(output) > 200 else output
        return str(output)[:200]
```

---

## Tool Definition Pattern

```python
# app/tools/web_search.py
import anthropic
from typing import Any

# Tool definition for Claude's tool_use
WEB_SEARCH_TOOL = {
    "name": "search_web",
    "description": "Search the web for current information about a topic. Returns a list of results with titles, URLs, and snippets. Always use this tool before making any factual claims about markets, products, or audiences.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query. Be specific. 2-6 words for best results."
            },
            "num_results": {
                "type": "integer",
                "description": "Number of results to return. Default 5, max 10.",
                "default": 5
            }
        },
        "required": ["query"]
    }
}

async def execute_search_web(query: str, num_results: int = 5) -> list[dict]:
    """
    Execute web search and return structured results.
    Called by tool dispatcher when agent uses search_web tool.
    """
    # Implementation here
    pass
```

```python
# app/tools/registry.py
from app.tools.web_search import WEB_SEARCH_TOOL, execute_search_web
from app.tools.read_page import READ_PAGE_TOOL, execute_read_page

TOOL_DEFINITIONS = {
    "search_web": (WEB_SEARCH_TOOL, execute_search_web),
    "read_page": (READ_PAGE_TOOL, execute_read_page),
    # ... all tools
}

def get_tools_for_agent(agent_name: str) -> list[dict]:
    """Return tool definitions for a specific agent."""
    from app.agents.registry import AGENT_TOOL_MAP
    tool_names = AGENT_TOOL_MAP.get(agent_name, [])
    return [TOOL_DEFINITIONS[name][0] for name in tool_names]

async def dispatch_tool_call(tool_name: str, tool_input: dict) -> Any:
    """Execute a tool call and return the result."""
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(f"Unknown tool: {tool_name}")
    _, executor = TOOL_DEFINITIONS[tool_name]
    return await executor(**tool_input)
```

---

## Rate Limiter Pattern

```python
# app/orchestration/rate_limiter.py
import asyncio
from collections import defaultdict
from datetime import UTC, datetime, timedelta, timezone

class RateLimiter:
    """
    Per-API rate limiting. Each API has its own quota.
    Prevents different APIs from competing with each other.
    """
    
    def __init__(self):
        self.limits = {
            "facebook_ads": {"requests_per_hour": 200},
            "google_ads": {"requests_per_hour": 100},
            "youtube_data": {"units_per_day": 10000},
            "meta_ad_library": {"requests_per_hour": 60},
            "anthropic": {"requests_per_minute": 50},
        }
        self.usage = defaultdict(list)
    
    async def acquire(self, api_name: str, cost: int = 1) -> None:
        """
        Wait until the API quota allows this request.
        Raises an event so the UI can show waiting status.
        """
        while not self._can_proceed(api_name, cost):
            wait_time = self._seconds_until_available(api_name)
            # Emit event for UI tooltip
            await self._emit_waiting_event(api_name, wait_time)
            await asyncio.sleep(min(wait_time, 5))
        
        self.usage[api_name].append({
            "timestamp": datetime.now(UTC),
            "cost": cost
        })
    
    def get_status(self, api_name: str) -> dict:
        """Return current usage status for UI display."""
        return {
            "api": api_name,
            "used": self._current_usage(api_name),
            "limit": self.limits.get(api_name, {}),
            "queue_position": self._queue_position(api_name)
        }
```

---

## Celery Task Pattern

```python
# app/workers/execution_tasks.py
from app.workers.celery_app import celery_app
from app.orchestration.executor import ExecutionEngine
from app.database import get_supabase

@celery_app.task(
    bind=True,
    max_retries=0,  # We handle retries internally
    acks_late=True,  # Don't ack until task completes
    reject_on_worker_lost=True  # Re-queue if worker dies
)
def run_execution(self, execution_id: str) -> dict:
    """
    Main Celery task for running an execution.
    Completely decoupled from HTTP request lifecycle.
    State is persisted after each node — safe to resume after crash.
    """
    import asyncio
    return asyncio.run(_run_execution_async(execution_id))

async def _run_execution_async(execution_id: str) -> dict:
    engine = ExecutionEngine()
    
    try:
        result = await engine.run(execution_id)
        await _notify_completion(execution_id, result)
        return result
    except Exception as e:
        await _notify_failure(execution_id, str(e))
        raise
```

---

## Context Builder Pattern

```python
# app/orchestration/context_builder.py
from app.models.state import ExecutionState

class ContextBuilder:
    """
    Extracts only the fields each agent needs from shared state.
    Prevents token waste and context overflow.
    """
    
    def for_script_writer(self, state: ExecutionState) -> dict:
        return {
            "product_name": state.product.name,
            "main_promise": state.product_analysis.main_promise,
            "persona_summary": state.persona.summary,
            "angle_type": state.angle.angle_type,
            "selected_hook": state.angle.selected_hook,
            "emotional_trigger": state.angle.emotional_trigger,
            "pain_in_audience_words": state.persona.psychographic.primary_pain,
            "objections_to_break": state.persona.psychographic.objections[:3],
            "format": state.strategy.creative_format,
            "duration_seconds": state.strategy.video_duration_seconds,
            "narrative_structure": state.strategy.narrative_structure,
            "language": state.product.target_language,
            # Reference hooks from memory — top 3 by confidence
            "market_proven_hooks": state.benchmark_hooks[:3] if state.benchmark_hooks else []
        }
    
    def for_copy_writer(self, state: ExecutionState) -> dict:
        return {
            "product_name": state.product.name,
            "main_promise": state.product_analysis.main_promise,
            "persona_summary": state.persona.summary,
            "selected_hook": state.angle.selected_hook,
            "cta_from_vsl": state.product_analysis.offer_details.cta_text,
            "ad_platforms": state.product.ad_platforms,
            "language": state.product.target_language
        }
    
    def for_media_buyer_facebook(self, state: ExecutionState) -> dict:
        return {
            "affiliate_link": state.campaign.affiliate_link_with_utm,
            "daily_budget": state.strategy.daily_budget,
            "campaign_objective": state.strategy.campaign_objective,
            "target_country": state.product.target_country,
            "persona_demographics": state.persona.full_profile,
            "persona_interests": state.persona.psychographic.primary_pain,
            "ad_account_id": state.campaign.ad_account_id,
            "creative_asset_ids": [a.asset_id for a in state.creative_assets.video_clips if a.approved],
            "selected_headline": state.copy.selected_headline,
            "selected_body": state.copy.selected_body,
            "selected_cta": state.copy.selected_cta
        }
```

---

## FastAPI Endpoint Pattern

```python
# app/api/executions.py
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.models.execution import CreateExecutionRequest, ExecutionResponse
from app.workers.execution_tasks import run_execution
from app.database import get_supabase

router = APIRouter(prefix="/executions", tags=["executions"])

@router.post("/", response_model=ExecutionResponse)
async def create_execution(
    request: CreateExecutionRequest,
    background_tasks: BackgroundTasks
):
    """Create a new execution and queue it for processing."""
    supabase = get_supabase()
    
    # Create execution record
    execution = supabase.table("executions").insert({
        "project_id": str(request.project_id),
        "status": "pending",
        "node_config": request.node_config.dict(),
        "source_execution_ids": [str(id) for id in request.source_execution_ids or []]
    }).execute()
    
    execution_id = execution.data[0]["id"]
    
    # Queue Celery task — decoupled from request
    run_execution.delay(execution_id)
    
    return ExecutionResponse(
        id=execution_id,
        status="pending",
        message="Execution queued successfully"
    )

@router.post("/{execution_id}/approve-node")
async def approve_node(
    execution_id: str,
    node_id: str,
    feedback: str | None = None
):
    """Approve or reject a node output with optional feedback."""
    # Implementation
    pass

@router.get("/{execution_id}/cost")
async def get_execution_cost(execution_id: str):
    """Get real-time cost breakdown for an execution."""
    # Implementation
    pass
```

---

## Security: Credential Encryption

```python
# app/config.py
from cryptography.fernet import Fernet
import os

class CredentialManager:
    """
    Encrypts/decrypts API credentials at rest.
    Credentials are NEVER sent to frontend or logged.
    """
    
    def __init__(self):
        key = os.environ["CREDENTIAL_ENCRYPTION_KEY"]
        self.cipher = Fernet(key.encode())
    
    def encrypt(self, plaintext: str) -> str:
        return self.cipher.encrypt(plaintext.encode()).decode()
    
    def decrypt(self, ciphertext: str) -> str:
        return self.cipher.decrypt(ciphertext.encode()).decode()
    
    def get_api_key(self, key_name: str, user_id: str) -> str:
        """
        Retrieve and decrypt an API key for a user.
        Never returns the key to the frontend — only used server-side.
        """
        supabase = get_supabase()
        record = supabase.table("user_credentials") \
            .select("encrypted_value") \
            .eq("user_id", user_id) \
            .eq("key_name", key_name) \
            .single().execute()
        
        if not record.data:
            raise ValueError(f"Credential {key_name} not found for user {user_id}")
        
        return self.decrypt(record.data["encrypted_value"])
```

---

## Environment Variables (.env)

```bash
# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=

# Queue
REDIS_URL=redis://localhost:6379/0

# Security
CREDENTIAL_ENCRYPTION_KEY=  # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# AI (server-side only — never exposed to frontend)
ANTHROPIC_API_KEY=

# Environment
ENVIRONMENT=development  # or production
```

---

## Requirements

```txt
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
celery[redis]>=5.3.0
anthropic>=0.25.0
supabase>=2.3.0
boto3>=1.34.0  # For Cloudflare R2
cryptography>=42.0.0
pydantic>=2.6.0
pydantic-settings>=2.2.0
httpx>=0.27.0
python-multipart>=0.0.9
```
