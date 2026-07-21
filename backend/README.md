---
title: GemIntel API
emoji: 💎
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# How to run the backend locally

1. Set Up a Virtual Environment
   python -m venv venv
   venv\Scripts\activate

2. Install Dependencies
   pip install -r requirements.txt

3. Start the Server
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

4. Verify and Test
   Check the Health Endpoint: Open your browser and go to http://localhost:8000/health. You should see {"status":"healthy"}.

Test the Model Interface: Go to http://localhost:8000/docs.
This opens the Swagger UI.
Click on the POST /authenticate dropdown.
