import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def main():
    try:
        client = genai.Client()
        print("Modelos disponíveis:")
        for m in client.models.list():
            if 'generateContent' in m.supported_actions:
                print(f" - {m.name}")
    except Exception as e:
        print("Erro ao listar modelos:", e)

if __name__ == "__main__":
    main()
