"""Enhanced Chat Service with LLM integration and MCP tools.

Adapts AlgoQuest patterns for MindPulse with:
- LLM-based intent classification (Gemini/OpenAI)
- Tool-augmented context (calendar, slack, email)
- Streaming SSE responses
- 3-agent routing
"""

import json
import os
import asyncio
from typing import AsyncGenerator, Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass

# LLM client setup
try:
    from openai import OpenAI, AsyncOpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False
    OpenAI = None
    AsyncOpenAI = None

from app.core.supabase import get_supabase_client
from app.integrations.composio_mcp import augment_context_with_tools, mcp_manager

# Agent types
AGENT_FOCUS = "focus"
AGENT_BREAK = "break"
AGENT_ENERGY = "energy"
AGENT_GENERAL = "general"


@dataclass(frozen=True)
class ClassificationResult:
    """Intent classification result."""
    agent: str
    confidence: float
    reasoning: str
    is_followup: bool


class LLMIntentClassifier:
    """LLM-based intent classifier using Gemini or OpenAI.
    
    Adapted from AlgoQuest IntentClassifier.
    """
    
    _SYSTEM_PROMPT = """You are an intent classifier for MindPulse, a personal rhythm and focus assistant.

Classify user messages into exactly ONE of these agents:

### focus
For: Help concentrating, finding focus time, enabling focus mode, distraction issues
Keywords: focus, concentrate, distract, flow, deep work, attention, help me focus

### break  
For: Scheduling breaks, rest reminders, stretching, when to pause
Keywords: break, rest, stretch, pause, schedule break, remind me, take a break

### energy
For: Energy levels, burnout check, rhythm patterns, how am I doing
Keywords: energy, tired, burnout, rhythm, pattern, how am I, my energy, dip

### general
For: Greetings, questions about MindPulse, what can you do, casual chat
Keywords: hello, hi, what can you do, how does this work, who are you

Respond ONLY with JSON in this exact format:
{
    "agent": "focus|break|energy|general",
    "confidence": 0.0-1.0,
    "reasoning": "one sentence explaining why",
    "is_followup": true|false
}
"""
    
    def __init__(self):
        self._client = None
        self._model = None
        
        # Try Gemini first (free tier available)
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key and _OPENAI_AVAILABLE:
            try:
                self._client = OpenAI(
                    api_key=gemini_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
                self._model = "gemini-2.5-flash"
                return
            except Exception as e:
                print(f"Gemini init failed: {e}")
        
        # Fallback to OpenAI
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key and _OPENAI_AVAILABLE:
            try:
                self._client = OpenAI(api_key=openai_key)
                self._model = "gpt-4o-mini"
            except Exception as e:
                print(f"OpenAI init failed: {e}")
    
    @property
    def available(self) -> bool:
        """Check if LLM client is available."""
        return self._client is not None and _OPENAI_AVAILABLE
    
    async def classify(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]]
    ) -> ClassificationResult:
        """Classify user intent using LLM.
        
        Falls back to keyword-based if LLM unavailable.
        """
        if not self.available:
            # Fallback to keyword classification
            return self._keyword_classify(message)
        
        try:
            # Build messages
            messages = [
                {"role": "system", "content": self._SYSTEM_PROMPT},
                {"role": "user", "content": f"Classify this message: \"{message}\""}
            ]
            
            # Call LLM
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.chat.completions.create(
                    model=self._model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=150
                )
            )
            
            # Parse result
            content = response.choices[0].message.content
            result = json.loads(content)
            
            return ClassificationResult(
                agent=result.get("agent", AGENT_GENERAL),
                confidence=result.get("confidence", 0.7),
                reasoning=result.get("reasoning", ""),
                is_followup=result.get("is_followup", False)
            )
            
        except Exception as e:
            print(f"LLM classification failed: {e}")
            return self._keyword_classify(message)
    
    def _keyword_classify(self, message: str) -> ClassificationResult:
        """Fallback keyword-based classification."""
        msg_lower = message.lower()
        
        # Focus keywords
        if any(kw in msg_lower for kw in ["focus", "concentrat", "distract", "flow", "deep work", "attention"]):
            return ClassificationResult(AGENT_FOCUS, 0.85, "Keyword match: focus", False)
        
        # Break keywords
        if any(kw in msg_lower for kw in ["break", "rest", "stretch", "pause", "schedule"]):
            return ClassificationResult(AGENT_BREAK, 0.85, "Keyword match: break", False)
        
        # Energy keywords
        if any(kw in msg_lower for kw in ["energy", "tired", "burnout", "rhythm", "pattern", "how am I"]):
            return ClassificationResult(AGENT_ENERGY, 0.85, "Keyword match: energy", False)
        
        return ClassificationResult(AGENT_GENERAL, 0.7, "No keyword match", False)


class LLMResponseGenerator:
    """Generates streaming responses using LLM."""
    
    _AGENT_PROMPTS = {
        AGENT_FOCUS: """You are the Focus Assistant for MindPulse. Help users concentrate and find their flow.

Context you'll receive:
- User's current flow score (0-100)
- Recent typing patterns (WPM, errors)
- Calendar events (if connected)

Guidelines:
- Be encouraging but practical
- Suggest specific focus techniques (Pomodoro, time blocking)
- If calendar connected, suggest focus blocks around meetings
- Recommend focus mode if distraction detected
- Never use "stress" language — use "focus", "flow", "rhythm"

Tone: Warm, supportive, concise (2-3 sentences max).""",
        
        AGENT_BREAK: """You are the Break Planner for MindPulse. Suggest smart break reminders.

Context you'll receive:
- Time since last break
- Recent typing patterns (error rate trends)
- Break history (what worked before)

Guidelines:
- Suggest breaks based on rhythm, not rigid schedules
- Offer 2-minute micro-breaks or 5-minute resets
- If error rate rising, suggest cognitive reset
- Never say "you're stressed" — say "your rhythm suggests a pause"
- Be gentle, never demanding

Tone: Caring, non-judgmental, brief (2-3 sentences).""",
        
        AGENT_ENERGY: """You are the Energy Insights agent for MindPulse. Help users understand their patterns.

Context you'll receive:
- Historical energy scores
- Sleep data (if provided)
- Focus time vs break patterns

Guidelines:
- Share insights as observations, not diagnoses
- Use soft framing: "Your rhythm shows..." not "You're burned out"
- Celebrate wins: "You maintained good energy for 3 days"
- Suggest 1 small adjustment, not overwhelming changes
- If sleep data available, show correlations

Tone: Insightful, supportive, encouraging (3-4 sentences).""",
        
        AGENT_GENERAL: """You are MindPulse, a personal rhythm and focus companion.

Capabilities:
- Focus Assistant: Find peak hours, enable focus mode
- Break Planner: Smart break reminders
- Energy Insights: Pattern analysis, weekly reflections

Guidelines:
- Friendly but concise
- Direct users to specific agents when relevant
- Explain that you read typing rhythm (not content)
- Privacy-first: emphasize local processing

Tone: Helpful, welcoming, clear (2-3 sentences)."""
    }
    
    def __init__(self):
        self._client = None
        self._model = None
        
        # Try Gemini first
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key and _OPENAI_AVAILABLE:
            try:
                self._client = OpenAI(
                    api_key=gemini_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
                self._model = "gemini-2.5-flash"
                return
            except Exception as e:
                print(f"Gemini init failed: {e}")
        
        # Fallback to OpenAI
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key and _OPENAI_AVAILABLE:
            try:
                self._client = OpenAI(api_key=openai_key)
                self._model = "gpt-4o-mini"
            except Exception as e:
                print(f"OpenAI init failed: {e}")
    
    @property
    def available(self) -> bool:
        return self._client is not None and _OPENAI_AVAILABLE
    
    async def generate_stream(
        self,
        user_id: str,
        message: str,
        agent_type: str,
        context: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response.
        
        Yields content chunks for SSE.
        """
        if not self.available:
            # Fallback to template response
            async for chunk in self._template_response(agent_type, context):
                yield chunk
            return
        
        try:
            # Build system prompt
            system_prompt = self._AGENT_PROMPTS.get(agent_type, self._AGENT_PROMPTS[AGENT_GENERAL])
            
            # Add context to system prompt
            context_str = self._format_context(context)
            full_system = f"{system_prompt}\n\nCurrent user context:\n{context_str}"
            
            # Build messages
            messages = [
                {"role": "system", "content": full_system},
                {"role": "user", "content": message}
            ]
            
            # Stream from LLM
            loop = asyncio.get_event_loop()
            
            def stream_generator():
                return self._client.chat.completions.create(
                    model=self._model,
                    messages=messages,
                    stream=True,
                    temperature=0.7,
                    max_tokens=300
                )
            
            response = await loop.run_in_executor(None, stream_generator)
            
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            print(f"LLM streaming failed: {e}")
            async for chunk in self._template_response(agent_type, context):
                yield chunk
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context dict for prompt."""
        lines = []
        for key, value in context.items():
            if value is not None:
                lines.append(f"- {key}: {value}")
        return "\n".join(lines) if lines else "No additional context available."
    
    async def _template_response(
        self, 
        agent_type: str, 
        context: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Fallback template response when LLM unavailable."""
        
        # Get metrics from context
        flow_score = context.get("flow_score", 50)
        deep_work = context.get("deep_work_minutes", 0)
        
        if agent_type == AGENT_FOCUS:
            if flow_score > 70:
                text = f"Your flow score is {flow_score}% — you're in a great rhythm! Keep going or take a micro-break to maintain this energy?"
            else:
                text = f"Your rhythm shows scattered attention right now. Try a 2-minute breathing reset, then pick one small task to focus on."
        
        elif agent_type == AGENT_BREAK:
            if deep_work > 60:
                text = f"You've been in deep work for {deep_work} minutes. Your rhythm suggests a stretch break would help maintain quality."
            else:
                text = f"You're doing well. Want me to remind you for a break in 30 minutes?"
        
        elif agent_type == AGENT_ENERGY:
            text = f"Your energy today is flowing well. Keep listening to your rhythm and taking those micro-breaks when they feel right."
        
        else:
            text = "I can help with focus, breaks, and understanding your energy patterns. What would you like to explore?"
        
        # Stream word by word
        words = text.split()
        for word in words:
            yield word + " "
            await asyncio.sleep(0.02)  # Simulate typing


# Initialize
intent_classifier = LLMIntentClassifier()
response_generator = LLMResponseGenerator()


async def generate_response(
    user_id: str,
    message: str,
    agent_type: str,
    history: list[Dict[str, Any]]
) -> AsyncGenerator[str, None]:
    """Main response generator with tool augmentation.
    
    Yields SSE-formatted events.
    """
    import json
    
    # Build context from local data
    context = await _build_user_context(user_id)
    
    # Augment with external tools if relevant
    context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
    augmented = await augment_context_with_tools(user_id, message, context_str)
    
    # Parse augmented context back
    # (In production, you'd parse this more carefully)
    
    # Stream response
    full_text = []
    async for chunk in response_generator.generate_stream(user_id, message, agent_type, context):
        full_text.append(chunk)
        yield f'data: {json.dumps({"type": "token", "content": chunk})}\n\n'
    
    # Final done event
    yield f'data: {json.dumps({"type": "done", "agent": agent_type})}\n\n'


async def _build_user_context(user_id: str) -> Dict[str, Any]:
    """Build context dict from user's recent data."""
    context = {}
    
    try:
        from app.services.history import get_recent_stats
        stats = get_recent_stats(user_id, hours=24)
        
        if stats:
            context["flow_score"] = round(100 - stats.get("avg_score", 50))
            context["typing_speed"] = f"{stats.get('avg_typing_speed', 0):.0f} WPM"
            context["deep_work_minutes"] = stats.get("deep_work_minutes", 0)
            context["breaks_taken"] = stats.get("breaks_taken", 0)
    except Exception as e:
        print(f"Error building context: {e}")
    
    return context


async def classify_intent(message: str) -> tuple[str, float]:
    """Classify user intent."""
    result = await intent_classifier.classify(message, [])
    return result.agent, result.confidence
