#!/bin/bash
set -e

echo ""
echo "═══════════════════════════════════════════════"
echo "   Neta Virtual Team — Newsletter Bot Setup"
echo "═══════════════════════════════════════════════"
echo ""

# ── Backend ──────────────────────────────────────
echo "▸ Setting up Python backend..."
cd backend

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ✓ Created backend/.env — open it and add your ANTHROPIC_API_KEY"
else
  echo "  ✓ backend/.env already exists"
fi

python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
echo "  ✓ Python dependencies installed"

cd ..

# ── Frontend ─────────────────────────────────────
echo "▸ Setting up React frontend..."
cd frontend
npm install --silent
echo "  ✓ Node dependencies installed"
cd ..

echo ""
echo "═══════════════════════════════════════════════"
echo "  Setup complete. To start the app:"
echo ""
echo "  Terminal 1 — Backend:"
echo "    cd backend && source venv/bin/activate"
echo "    uvicorn main:app --reload"
echo ""
echo "  Terminal 2 — Frontend:"
echo "    cd frontend && npm run dev"
echo ""
echo "  Then open: http://localhost:3000"
echo ""
echo "  First step: Go to Settings and add your"
echo "  Anthropic API key to start generating newsletters."
echo "═══════════════════════════════════════════════"
echo ""
