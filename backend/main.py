"""
Legato Backend: Expressive ABC to Audio Synthesis
Uses music21 for ABC parsing and FluidSynth for high-quality audio synthesis.
"""

import os
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


class SynthesizeRequest(BaseModel):
    abc: str
    format: str = "wav"  # wav or mp3


class SynthesizeResponse(BaseModel):
    success: bool
    message: str
    audio_url: str | None = None


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
    try:
        import music21
        from midi2audio import FluidSynth
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Missing dependency: {e}. Run: pip install music21 midi2audio"
        )

    # Find SoundFont
    soundfont = find_soundfont()
    if soundfont is None:
        raise HTTPException(
            status_code=500,
            detail=f"No SoundFont (.sf2) found in {SOUNDFONT_DIR}. "
                   f"Download one from https://musical-artifacts.com/artifacts?formats=sf2 "
                   f"and place it in the soundfonts folder."
        )

    abc_content = request.abc.strip()
    if not abc_content:
        raise HTTPException(status_code=400, detail="ABC notation is empty")

    try:
        # Parse ABC notation
        logger.info("Parsing ABC notation...")
        score = music21.converter.parse(abc_content, format="abc")
        
        # Create temp files
        with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as midi_file:
            midi_path = midi_file.name
        
        output_suffix = ".wav" if request.format == "wav" else ".mp3"
        with tempfile.NamedTemporaryFile(suffix=output_suffix, delete=False) as audio_file:
            audio_path = audio_file.name

        # Export to MIDI
        logger.info(f"Writing MIDI to {midi_path}...")
        score.write("midi", fp=midi_path)

        # Synthesize to audio
        logger.info(f"Synthesizing with SoundFont: {soundfont}")
        fs = FluidSynth(str(soundfont))
        fs.midi_to_audio(midi_path, audio_path)

        # Clean up MIDI file
        os.unlink(midi_path)

        # Return audio file
        logger.info(f"Returning audio file: {audio_path}")
        media_type = "audio/wav" if request.format == "wav" else "audio/mpeg"
        
        return FileResponse(
            audio_path,
            media_type=media_type,
            filename=f"legato_output{output_suffix}",
        )

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
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
