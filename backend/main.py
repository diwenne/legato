"""
Legato Backend: Expressive ABC to Audio Synthesis
Uses music21 for ABC parsing and FluidSynth for high-quality audio synthesis.
"""

import os
import subprocess
import tempfile
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Legato Audio Synthesis API",
    description="Convert ABC notation to high-quality audio using music21 and FluidSynth",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to SoundFont directory
SOUNDFONT_DIR = Path(__file__).parent / "soundfonts"


def find_soundfont() -> Path | None:
    """Find any .sf2 file in the soundfonts directory."""
    if not SOUNDFONT_DIR.exists():
        return None
    
    sf2_files = list(SOUNDFONT_DIR.glob("*.sf2"))
    if sf2_files:
        return sf2_files[0]
    return None


def fluidsynth_midi_to_wav(midi_path: str, wav_path: str, soundfont_path: str) -> bool:
    """
    Convert MIDI to WAV using FluidSynth command line.
    This avoids issues with the midi2audio library.
    """
    cmd = [
        "fluidsynth",
        "-ni",  # No interactive mode, no shell
        "-F", wav_path,  # Output file (must come before soundfont)
        "-r", "44100",  # Sample rate
        "-g", "1.0",  # Gain
        soundfont_path,
        midi_path,
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            logger.error(f"FluidSynth error: {result.stderr}")
            return False
        return os.path.exists(wav_path) and os.path.getsize(wav_path) > 0
    except subprocess.TimeoutExpired:
        logger.error("FluidSynth timed out")
        return False
    except Exception as e:
        logger.error(f"FluidSynth exception: {e}")
        return False


class SynthesizeRequest(BaseModel):
    abc: str
    format: str = "wav"


@app.get("/health")
def health_check():
    """Health check endpoint."""
    soundfont = find_soundfont()
    return {
        "status": "ok",
        "soundfont_found": soundfont is not None,
        "soundfont_path": str(soundfont) if soundfont else None,
        "soundfont_dir": str(SOUNDFONT_DIR),
    }


@app.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    """
    Convert ABC notation to audio.
    
    Pipeline:
    1. Parse ABC with music21
    2. Export to MIDI
    3. Synthesize MIDI to audio with FluidSynth
    """
    # Find SoundFont
    soundfont = find_soundfont()
    if soundfont is None:
        raise HTTPException(
            status_code=500,
            detail=f"No SoundFont (.sf2) found in {SOUNDFONT_DIR}. "
                   f"Download one from https://musical-artifacts.com/artifacts?formats=sf2"
        )

    abc_content = request.abc.strip()
    if not abc_content:
        raise HTTPException(status_code=400, detail="ABC notation is empty")

    midi_path = None
    audio_path = None
    
    # Create temp files
    with tempfile.NamedTemporaryFile(suffix=".abc", delete=False, mode="w") as abc_file:
        abc_file.write(abc_content)
        abc_path = abc_file.name

    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as midi_file:
        midi_path = midi_file.name
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
        audio_path = audio_file.name

    try:
        # Convert ABC to MIDI using abc2midi
        logger.info(f"Converting ABC to MIDI: {abc_path} -> {midi_path}")
        convert_cmd = ["abc2midi", abc_path, "-o", midi_path]
        result = subprocess.run(convert_cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            logger.error(f"abc2midi error: {result.stderr}")
            # If standard error is empty, check stdout (abc2midi often prints errors there)
            detail = result.stderr if result.stderr else result.stdout
            raise Exception(f"abc2midi failed: {detail}")

        # Synthesize to MIDI using direct FluidSynth call
        logger.info(f"Synthesizing with SoundFont: {soundfont}")
        success = fluidsynth_midi_to_wav(midi_path, audio_path, str(soundfont))
        
        if not success:
            raise Exception("FluidSynth synthesis failed")

        # Clean up MIDI file
        if midi_path and os.path.exists(midi_path):
            os.unlink(midi_path)
        if 'abc_path' in locals() and abc_path and os.path.exists(abc_path):
            os.unlink(abc_path)

        # Return audio file
        logger.info(f"Returning audio file: {audio_path} ({os.path.getsize(audio_path)} bytes)")
        
        return FileResponse(
            audio_path,
            media_type="audio/wav",
            filename="legato_output.wav",
        )

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        # Clean up temp files on error
        if 'abc_path' in locals() and abc_path and os.path.exists(abc_path):
            os.unlink(abc_path)
        if midi_path and os.path.exists(midi_path):
            os.unlink(midi_path)
        if audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    """Root endpoint with API info."""
    soundfont = find_soundfont()
    return {
        "name": "Legato Audio Synthesis API",
        "soundfont_status": "ready" if soundfont else "missing",
        "soundfont_path": str(soundfont) if soundfont else None,
        "endpoints": {
            "/health": "Health check",
            "/synthesize": "POST - Convert ABC to audio",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
