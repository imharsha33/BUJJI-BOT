import warnings  # type: ignore
warnings.filterwarnings("ignore")

import google.generativeai as genai  # type: ignore
import os
from dotenv import load_dotenv  # type: ignore

load_dotenv()
genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))

print(f"{'Model Name':<40} {'Description'}")
print("-" * 60)
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        desc = m.description if hasattr(m, 'description') else ""
        print(f"{m.name:<40} {desc[:50]}")
