const BASE = 'https://api.elevenlabs.io/v1';
const MODEL = 'eleven_turbo_v2_5';

export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella

export const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Male)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Male)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Male)' },
];

// `${voiceId}::${text}` → decoded AudioBuffer
const audioCache = new Map();
let currentSource = null;
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function fetchBuffer(text, apiKey, voiceId) {
  const cacheKey = `${voiceId}::${text}`;
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) throw new Error(`ElevenLabs ${res.status} ${res.statusText}`);

  const arrayBuffer = await res.arrayBuffer();
  const ac = getCtx();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  audioCache.set(cacheKey, decoded);
  return decoded;
}

function speakFallback(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

export async function playInstructionAudio(text, apiKey, voiceId = DEFAULT_VOICE_ID) {
  if (!apiKey) {
    speakFallback(text);
    return;
  }

  try {
    // Stop any currently playing audio before starting new
    if (currentSource) {
      try { currentSource.stop(); } catch {}
      currentSource = null;
    }

    const buf = await fetchBuffer(text, apiKey, voiceId);
    const ac = getCtx();
    if (ac.state === 'suspended') await ac.resume();

    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start();
    currentSource = src;
    src.onended = () => {
      if (currentSource === src) currentSource = null;
    };
  } catch (e) {
    console.warn('[ElevenLabs] Falling back to browser TTS:', e.message);
    speakFallback(text);
  }
}

// Silently pre-fetch and cache the next instruction's audio
export async function preloadAudio(text, apiKey, voiceId = DEFAULT_VOICE_ID) {
  if (!apiKey) return;
  try {
    await fetchBuffer(text, apiKey, voiceId);
  } catch {
    // preload failures are non-fatal
  }
}
