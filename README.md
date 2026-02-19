# ARIA — AI Conversational Chatbot

A sophisticated AI-powered chatbot web application built with Flask and Claude API, featuring a luxury dark UI with animated particles, markdown rendering, syntax highlighting, and full conversation context memory.

## Features

- 🧠 **Claude Sonnet 4** backend — state-of-the-art language model
- 💬 **Context-aware conversations** — remembers last 20 messages
- ✨ **Animated UI** — particles, glowing orbs, smooth transitions
- 📝 **Markdown rendering** — bold, italics, code blocks, lists
- 🎨 **Syntax highlighting** — 180+ programming languages
- 📋 **Copy code** — one-click copy for code snippets
- 📱 **Responsive design** — works on mobile and desktop
- ⚡ **Real-time typing indicator** — shows when ARIA is thinking
- 🔄 **Session management** — clear and restart conversations
- 💡 **Suggestion prompts** — quick-start conversation starters

## Tech Stack

- **Backend**: Python / Flask
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Libraries**: marked.js (markdown), highlight.js (syntax)
- **Fonts**: Syne, DM Mono, Instrument Serif (Google Fonts)

## Setup & Installation

### 1. Prerequisites
- Python 3.9+
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and add your API key:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
SECRET_KEY=any-random-string-here
```

### 4. Run the Application
```bash
python app.py
```

### 5. Open in Browser
Navigate to `http://localhost:5000`

## Project Structure

```
chatbot/
├── app.py                  # Flask backend + API routes
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variables template
├── README.md               # This file
├── templates/
│   └── index.html          # Main HTML template
└── static/
    ├── css/
    │   └── style.css       # All styles + animations
    └── js/
        ├── particles.js    # Canvas particle system
        └── app.js          # Chat logic + UI interactions
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main chat interface |
| POST | `/api/chat` | Send message, get response |
| POST | `/api/clear` | Clear conversation history |
| GET | `/api/history` | Get conversation history |

## Deployment

For production, use Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Customization

- **System prompt**: Edit `SYSTEM_PROMPT` in `app.py` to change ARIA's personality
- **Context window**: Change `messages[-20:]` in `app.py` to keep more/fewer messages
- **Model**: Change `claude-sonnet-4-20250514` to use a different Claude model
- **Colors**: Edit CSS variables at the top of `style.css`
