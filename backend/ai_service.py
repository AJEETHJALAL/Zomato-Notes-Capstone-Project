import os
import json
import re
import logging
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

AI_PROMPT_TEMPLATE = """Instructions: Read the note content and return only a JSON object with exactly two keys.
Context: This is an internal incident note that may describe actions, reminders, or observations.
Input: A note's content string is provided.
Constraints: Return no text other than the JSON object. The JSON must have exactly two keys: \"tags\" and \"summary\". \"tags\" must be a list of 1–3 short lowercase keyword strings; \"summary\" must be one sentence of at most 20 words. Do not include any surrounding explanation, comments, or markdown.
Output Format: {"tags": ["example"], "summary": "One sentence summary at most twenty words."}
"""

MOCK_AI = os.getenv("MOCK_AI", "0") == "1"
AI_API_KEY = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")
AI_MODEL = os.getenv("AI_MODEL", "gpt-3.5-turbo")


def _mock_ai_response(user_message: str, system_prompt: str) -> str:
    content = user_message.strip()
    words = re.findall(r"\b\w+\b", content)
    lower_words = [word.lower() for word in words if len(word) > 2]
    tags = []
    for word in lower_words:
        if word not in tags:
            tags.append(word)
        if len(tags) >= 3:
            break
    if not tags and words:
        tags = [words[0].lower()]
    first_sentence = re.split(r"(?<=[.!?])\s+", content.strip())[0]
    summary_tokens = first_sentence.split()
    if len(summary_tokens) > 20:
        summary = " ".join(summary_tokens[:20]).rstrip(".,!?")
        if not summary.endswith("."):
            summary += "."
    else:
        summary = first_sentence.strip()
    return json.dumps({"tags": tags, "summary": summary})


def get_ai_response(user_message: str, system_prompt: str) -> str:
    if MOCK_AI or not AI_API_KEY:
        return _mock_ai_response(user_message, system_prompt)

    if AI_PROVIDER == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": AI_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 200,
            "temperature": 0.2,
        }
        with httpx.Client(timeout=30) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    raise ValueError("Unsupported AI provider")
