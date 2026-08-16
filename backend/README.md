researchtube/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── __init__.py
│   │   │
│   │   ├── main.py
│   │   │
│   │   ├── core/   
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── init_db.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py
│   │   │   │
│   │   │   └── models/
│   │   │       ├── __init__.py
│   │   │       ├── user.py
│   │   │       ├── auth.py
│   │   │       └── youtube.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   └── research.py
│   │   │
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── test.py
│   │   │   └── research.py
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── research_service.py
│   │   │   ├── youtube_service.py
│   │   │   ├── transcript_service.py
│   │   │   ├── embedding_service.py
│   │   │   └── report_service.py
│   │   │
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   └── youtube_tools.py
│   │   │
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── research_agent.py
│   │   │   ├── transcript_agent.py
│   │   │   ├── analysis_agent.py
│   │   │   ├── ranking_agent.py
│   │   │   └── report_agent.py
│   │   │
│   │   └── workflows/
│   │       ├── __init__.py
│   │       └── research_workflow.py
│   │
│   ├── .env
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── frontend/
