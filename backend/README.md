# Legato Backend

Python backend for high-quality ABC notation to audio synthesis.

## Quick Start

### 1. Install FluidSynth (macOS)

```bash
brew install fluidsynth
```

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Download a SoundFont (MANUAL STEP)

> **Important**: SoundFont files must be downloaded manually via browser.

1. Go to: https://musical-artifacts.com/artifacts?formats=sf2
2. Download any `.sf2` file (recommended: "FluidR3 GM" or "GeneralUser GS")
3. Place it in `backend/soundfonts/` folder

### 4. Run the Server

```bash
uvicorn main:app --reload --port 8000
```

### 5. Test

```bash
curl http://localhost:8000/health
```

## API

**POST /synthesize**

```bash
curl -X POST http://localhost:8000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"abc": "X:1\nT:Test\nK:C\nCDEF|"}' \
  --output test.wav
```
