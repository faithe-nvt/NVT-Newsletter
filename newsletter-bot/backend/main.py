from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base
import models  # ensures all models are registered

from routes import campaigns, subscribers, analytics, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Neta Virtual Team — Newsletter Bot",
    description="AI-powered newsletter campaign manager for AU accounting/finance audiences",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router)
app.include_router(subscribers.router)
app.include_router(analytics.router)
app.include_router(settings.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "Neta Newsletter Bot"}


@app.get("/health")
def health():
    return {"status": "healthy"}
