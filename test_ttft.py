import asyncio
import httpx
import time
import os
import sys

from dotenv import load_dotenv
load_dotenv(".env")

API_KEY = os.getenv("OPENROUTER_API_KEY")

async def test_llm(model: str):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "HTTP-Referer": "http://localhost",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Hello, simply reply with 'hi'."}],
        "stream": True,
        "max_tokens": 10,
    }
    
    start = time.monotonic()
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST", 
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=15.0
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and "[DONE]" not in line:
                        ttft = time.monotonic() - start
                        print(f"[{model}] TTFT: {ttft:.2f}s")
                        return
    except Exception as e:
        print(f"[{model}] Failed: {e}")

async def main():
    print("Testing OpenRouter models for Time-To-First-Token (TTFT)...")
    await test_llm("nex-agi/nex-n2-mini")
    await test_llm("meta-llama/llama-3.1-8b-instruct")
    await test_llm("google/gemini-flash-1.5-exp")

asyncio.run(main())
