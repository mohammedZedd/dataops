from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ai_accounting, auth, chat, clients, dashboard, documents, invoices, invitations, notes, notifications, team, users

app = FastAPI(
    title="Payfit Accounting API",
    version="0.1.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Autorise le frontend React (localhost:5173 / 5174 en dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(clients.router)
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(invoices.router)
app.include_router(invitations.router)
app.include_router(notes.router)
app.include_router(notes.global_router)
app.include_router(team.router)
app.include_router(ai_accounting.router)
app.include_router(notifications.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
