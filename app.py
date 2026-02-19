import warnings  # type: ignore
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

from flask import Flask, render_template, request, jsonify, session, Response, stream_with_context  # type: ignore
from google import genai  # type: ignore
from google.genai import types  # type: ignore
import uuid
import os
import json
from datetime import datetime
from dotenv import load_dotenv  # type: ignore

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Configure the new google-genai client
client = genai.Client(api_key=os.environ.get('GOOGLE_API_KEY'))

SYSTEM_PROMPT = """You are BUJJI, a world-class AI assistant. Follow these rules strictly:

1. **Accuracy First**: Give factually correct, well-researched answers. If uncertain, say so.
2. **Concise & Clear**: Be direct. No filler phrases like "Great question!" or "Sure, I'd be happy to help!". Just answer.
3. **Rich Formatting**: Use markdown extensively — headers, bold, lists, code blocks with language tags, tables when comparing things.
4. **Code Excellence**: Write clean, commented, production-quality code. Always specify the language in code blocks.
5. **Context Memory**: Reference previous messages naturally. Build on the conversation.
6. **Adaptive Tone**: Match the user's energy — technical for developers, simple for beginners, creative for writers.
7. **Up-to-date**: You have access to Google Search. Use it to provide current, accurate information when asked about recent events, news, or anything time-sensitive.

You are precise, fast, and incredibly helpful."""

# ============ MODEL CONFIGURATION ============
PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"]

# Google Search tool for real-time information
google_search_tool = types.Tool(google_search=types.GoogleSearch())

# Generation config
GENERATION_CONFIG = types.GenerateContentConfig(
    max_output_tokens=4096,
    temperature=0.7,
    top_p=0.95,
    top_k=40,
    system_instruction=SYSTEM_PROMPT,
    tools=[google_search_tool],
)

# Config without search (fallback)
GENERATION_CONFIG_NO_SEARCH = types.GenerateContentConfig(
    max_output_tokens=4096,
    temperature=0.7,
    top_p=0.95,
    top_k=40,
    system_instruction=SYSTEM_PROMPT,
)

# Test primary model at startup
search_enabled = False
try:
    # Quick test to see if the model + search tool works
    test_response = client.models.generate_content(
        model=PRIMARY_MODEL,
        contents="Say hi in one word.",
        config=GENERATION_CONFIG,
    )
    search_enabled = True
    print(f"✅ Model loaded: {PRIMARY_MODEL} with Google Search 🔍")
except Exception as e:
    print(f"⚠️ Google Search failed for {PRIMARY_MODEL}: {e}")
    try:
        test_response = client.models.generate_content(
            model=PRIMARY_MODEL,
            contents="Say hi in one word.",
            config=GENERATION_CONFIG_NO_SEARCH,
        )
        print(f"✅ Model loaded: {PRIMARY_MODEL} (no search)")
    except Exception as e2:
        print(f"⚠️ Primary model failed: {e2}")
        for fb in FALLBACK_MODELS:
            try:
                test_response = client.models.generate_content(
                    model=fb,
                    contents="Say hi in one word.",
                    config=GENERATION_CONFIG_NO_SEARCH,
                )
                PRIMARY_MODEL = fb
                print(f"✅ Fallback model loaded: {fb}")
                break
            except Exception:
                continue

if search_enabled:
    print("🔍 Google Search grounding is ENABLED — BUJJI can access real-time info!")
else:
    print("📚 Running without Google Search — answers based on model knowledge only")

conversation_store: dict = {}

@app.route('/')
def index():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Streaming chat endpoint using Server-Sent Events (SSE)"""
    data = request.json
    user_message = data.get('message', '').strip()
    session_id = session.get('session_id', str(uuid.uuid4()))
    
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    if session_id not in conversation_store:
        conversation_store[session_id] = []

    # Store user message
    conversation_store[session_id].append({
        "role": "user",
        "parts": [user_message]
    })

    return _stream_response(session_id, user_message)

@app.route('/api/regenerate', methods=['POST'])
def regenerate():
    """Regenerate the last assistant response"""
    session_id = session.get('session_id')
    if not session_id or session_id not in conversation_store:
        return jsonify({'error': 'No conversation found'}), 400
    
    messages = conversation_store[session_id]
    
    # Remove last assistant message if exists
    if messages and messages[-1]["role"] == "assistant":
        messages.pop()
    
    # Get the last user message
    if not messages or messages[-1]["role"] != "user":
        return jsonify({'error': 'No user message to regenerate from'}), 400
    
    user_message = messages[-1]["parts"][0]
    return _stream_response(session_id, user_message, is_regenerate=True)

def _stream_response(session_id, user_message, is_regenerate=False):
    """Shared streaming logic for chat and regenerate"""
    # Prepare chat history (keep last 20 for better context)
    recent_messages = list(conversation_store[session_id][-20:])  # type: ignore
    
    # Build contents list for the API
    contents = []
    for msg in recent_messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg["parts"][0])]
        ))

    current_date = datetime.now().strftime("%A, %B %d, %Y %H:%M")
    
    # Replace the last user message with date-augmented version
    if contents:
        augmented_text = f"{user_message}\n\n[System: Current date/time is {current_date}. Use Google Search if the question requires current information.]"
        contents[-1] = types.Content(
            role="user",
            parts=[types.Part.from_text(text=augmented_text)]
        )

    def generate_stream():
        full_response = []
        success = False
        used_model = PRIMARY_MODEL

        # Try models in order
        models_to_try = [PRIMARY_MODEL] + FALLBACK_MODELS

        for model_name in models_to_try:
            try:
                # Use search-enabled config if available, otherwise fallback
                config = GENERATION_CONFIG if search_enabled else GENERATION_CONFIG_NO_SEARCH

                response = client.models.generate_content_stream(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                
                for chunk in response:
                    if chunk.text:
                        full_response.append(chunk.text)
                        yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"

                used_model = model_name
                success = True
                break

            except Exception as e:
                error_str = str(e)
                print(f"Model {model_name} failed: {error_str}")
                # If search tool caused the error, retry without it
                if 'google_search' in error_str.lower() or 'tool' in error_str.lower():
                    try:
                        response = client.models.generate_content_stream(
                            model=model_name,
                            contents=contents,
                            config=GENERATION_CONFIG_NO_SEARCH,
                        )
                        for chunk in response:
                            if chunk.text:
                                full_response.append(chunk.text)
                                yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
                        used_model = model_name
                        success = True
                        break
                    except Exception as e2:
                        print(f"Model {model_name} also failed without search: {e2}")
                continue

        if success and full_response:
            complete_text = ''.join(full_response)
            conversation_store[session_id].append({
                "role": "assistant",
                "parts": [complete_text]
            })
            msg_count = len(conversation_store[session_id]) // 2
            yield f"data: {json.dumps({'done': True, 'timestamp': datetime.now().strftime('%H:%M'), 'message_count': msg_count, 'model': used_model})}\n\n"
        else:
            yield f"data: {json.dumps({'error': 'All models failed. Please try again.'})}\n\n"

    return Response(
        stream_with_context(generate_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )

@app.route('/api/clear', methods=['POST'])
def clear_conversation():
    session_id = session.get('session_id')
    if session_id and session_id in conversation_store:
        conversation_store[session_id] = []
    return jsonify({'status': 'cleared'})

@app.route('/api/history', methods=['GET'])
def get_history():
    session_id = session.get('session_id')
    if session_id and session_id in conversation_store:
        return jsonify({'messages': conversation_store[session_id]})
    return jsonify({'messages': []})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
