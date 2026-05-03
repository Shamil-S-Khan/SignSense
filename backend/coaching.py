"""
Groq LLM coaching — generates personalized 2-3 sentence tips after a drill.

Uses llama-3.3-70b-versatile via the Groq API.
Called asynchronously so scores render immediately; coaching tip follows ~1-2s later.
"""

import logging
from typing import Dict, List

logger = logging.getLogger("coaching")

try:
    from groq import AsyncGroq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False
    logger.warning("groq package not installed — coaching tips will be mocked.")


SYSTEM_PROMPT = """You are an expert ASL (American Sign Language) coach helping a student practice fingerspelling and basic signs. 

Given the student's performance scores and the target sign, provide a brief, encouraging coaching tip (2-3 sentences max). Be specific about what to fix. Do NOT use markdown formatting. Do NOT repeat the scores back. Focus on actionable physical advice (finger position, wrist angle, movement speed, etc.)."""


async def get_coaching_tip(
    target_sign: str,
    scores: Dict[str, float],
    issues: List[str],
    api_key: str | None = None,
) -> str:
    """
    Call Groq API for a coaching tip. Returns a plain text string.
    If Groq is unavailable, returns a hardcoded fallback.
    """
    if not HAS_GROQ or not api_key:
        return _fallback_tip(target_sign, scores, issues)

    user_msg = (
        f"The student just practiced the sign '{target_sign}'. "
        f"Handshape score: {scores.get('handshape', 0):.0f}/100. "
        f"Orientation score: {scores.get('orientation', 0):.0f}/100. "
        f"Movement score: {scores.get('movement', 0):.0f}/100. "
    )
    if issues:
        user_msg += "Specific issues: " + "; ".join(issues) + ". "

    try:
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=150,
        )
        tip = response.choices[0].message.content.strip()
        logger.info("Groq coaching tip generated for '%s'", target_sign)
        return tip
    except Exception as e:
        logger.error("Groq API call failed: %s", e)
        return _fallback_tip(target_sign, scores, issues)


def _fallback_tip(target_sign: str, scores: Dict[str, float], issues: List[str]) -> str:
    """Generate a simple hardcoded tip when Groq is unavailable."""
    hs = scores.get("handshape", 0)
    ori = scores.get("orientation", 0)
    mv = scores.get("movement", 0)

    weakest = min(("handshape", hs), ("orientation", ori), ("movement", mv), key=lambda x: x[1])

    tips = {
        "handshape": f"Your finger positions for '{target_sign}' need some work. Try curling your fingers more tightly and check the reference image.",
        "orientation": f"Watch your wrist angle when signing '{target_sign}'. Your palm should face the viewer. Try rotating your wrist slightly.",
        "movement": f"Your movement for '{target_sign}' was a bit off. Try to keep your hand steadier and match the demonstrated motion path.",
    }
    return tips.get(weakest[0], f"Keep practicing '{target_sign}' — you're getting closer!")
