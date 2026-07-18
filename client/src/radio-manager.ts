import * as THREE from 'three';

export interface RadioTrack {
  name: string;
  genre: string;
  chords: number[][][]; // Array of chord voicings (MIDI notes or frequencies)
  tempo: number;
}

const TRACKS: RadioTrack[] = [
  {
    name: 'Manhã Solarpunk',
    genre: 'Solar Lofi',
    tempo: 78,
    // Chords: Cmaj7 - Am9 - Fmaj9 - G13
    chords: [
      [
        [60, 64, 67, 71],
        [48, 55],
      ], // Cmaj7, C bass
      [
        [57, 60, 64, 67, 71],
        [45, 52],
      ], // Am9, A bass
      [
        [53, 57, 60, 64, 67],
        [41, 48],
      ], // Fmaj9, F bass
      [
        [55, 59, 62, 65, 69, 71],
        [43, 50],
      ], // G13, G bass
    ],
  },
  {
    name: 'Bossa da Praça',
    genre: 'Ambient Bossa Nova',
    tempo: 84,
    // Chords: Dm9 - G13 - Cmaj9 - A7(b13)
    chords: [
      [
        [50, 53, 57, 60, 64],
        [38, 45],
      ], // Dm9
      [
        [53, 57, 59, 64, 67],
        [43, 50],
      ], // G13
      [
        [48, 52, 55, 59, 62],
        [36, 43],
      ], // Cmaj9
      [
        [55, 58, 61, 64, 68],
        [45, 52],
      ], // A7(b13)
    ],
  },
  {
    name: 'Samba do Amanhã',
    genre: 'Chill Samba',
    tempo: 92,
    // Chords: F#maj7 - B7 - Emaj7 - C#7
    chords: [
      [
        [54, 58, 61, 65],
        [42, 49],
      ], // F#maj7
      [
        [54, 57, 61, 63],
        [47, 54],
      ], // B7
      [
        [52, 56, 59, 63],
        [40, 47],
      ], // Emaj7
      [
        [53, 56, 59, 62],
        [49, 56],
      ], // C#7
    ],
  },
];

function mToF(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class RadioManager {
  private static instance: RadioManager | null = null;

  public audioCtx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  public radioGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  private isPlaying = false;
  private currentTrackIdx = 0;
  private schedulerTimer: number | null = null;
  private nextNoteTime = 0.0;
  private step = 0;
  private scheduleAheadTime = 0.2; // How far ahead to schedule audio (sec)
  private lookaheadMs = 80.0; // How frequently to call scheduler (ms)

  // Volume states (0 to 1)
  private masterVolState = 0.5;
  private sfxVolState = 0.6;
  private radioVolState = 0.4;

  private constructor() {
    // Lazy initialized on interaction to bypass browser autoplay policies
  }

  public static getInstance(): RadioManager {
    if (!RadioManager.instance) {
      RadioManager.instance = new RadioManager();
    }
    return RadioManager.instance;
  }

  public init() {
    if (this.audioCtx) return;

    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    // Node setup
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolState, this.audioCtx.currentTime);
    this.masterGain.connect(this.audioCtx.destination);

    this.sfxGain = this.audioCtx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolState, this.audioCtx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.radioGain = this.audioCtx.createGain();
    this.radioGain.gain.setValueAtTime(this.radioVolState, this.audioCtx.currentTime);
    this.radioGain.connect(this.masterGain);

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64; // Small for responsive visualization
    this.radioGain.connect(this.analyser);
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolState = THREE.MathUtils.clamp(val, 0, 1);
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolState, this.audioCtx.currentTime, 0.05);
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolState = THREE.MathUtils.clamp(val, 0, 1);
    if (this.sfxGain && this.audioCtx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolState, this.audioCtx.currentTime, 0.05);
    }
  }

  public setRadioVolume(val: number) {
    this.radioVolState = THREE.MathUtils.clamp(val, 0, 1);
    if (this.radioGain && this.audioCtx) {
      this.radioGain.gain.setTargetAtTime(this.radioVolState, this.audioCtx.currentTime, 0.05);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolState;
  }
  public getSfxVolume(): number {
    return this.sfxVolState;
  }
  public getRadioVolume(): number {
    return this.radioVolState;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): RadioTrack {
    return TRACKS[this.currentTrackIdx];
  }

  public startRadio() {
    this.init();
    this.resume();
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.audioCtx) {
      this.nextNoteTime = this.audioCtx.currentTime;
    }
    this.step = 0;

    // Start scheduler loop
    this.schedulerTimer = window.setInterval(() => this.schedulerLoop(), this.lookaheadMs);
    console.log('[RadioManager] Radio started');
  }

  public stopRadio() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    console.log('[RadioManager] Radio stopped');
  }

  public toggleRadio() {
    if (this.isPlaying) {
      this.stopRadio();
    } else {
      this.startRadio();
    }
  }

  public nextTrack() {
    this.currentTrackIdx = (this.currentTrackIdx + 1) % TRACKS.length;
    this.step = 0;
    if (this.audioCtx) {
      this.nextNoteTime = this.audioCtx.currentTime;
    }
    console.log(`[RadioManager] Switched to track: ${this.getCurrentTrack().name}`);
  }

  public prevTrack() {
    this.currentTrackIdx = (this.currentTrackIdx - 1 + TRACKS.length) % TRACKS.length;
    this.step = 0;
    if (this.audioCtx) {
      this.nextNoteTime = this.audioCtx.currentTime;
    }
    console.log(`[RadioManager] Switched to track: ${this.getCurrentTrack().name}`);
  }

  private schedulerLoop() {
    if (!this.audioCtx) return;
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.step, this.nextNoteTime);
      this.advanceNote();
    }
  }

  private advanceNote() {
    const track = this.getCurrentTrack();
    // Quantize steps: 16th notes
    // Time per beat = 60 / tempo. We schedule 8th notes (0.5 beats per step)
    const secondsPerBeat = 60.0 / track.tempo;
    const stepDuration = 0.5 * secondsPerBeat; // 8th note steps
    this.nextNoteTime += stepDuration;

    this.step = (this.step + 1) % 16; // 16 steps pattern loop (2 bars of 4/4)
  }

  private scheduleNote(stepNum: number, time: number) {
    if (!this.audioCtx || !this.radioGain) return;

    const track = this.getCurrentTrack();
    const chordIndex = Math.floor(stepNum / 4) % track.chords.length;
    const chordDef = track.chords[chordIndex];
    const keys = chordDef[0];
    const bass = chordDef[1];

    // --- 1. Bassline (Syncopated Samba style) ---
    // Bass plays on steps 0, 3, 6, 8, 11, 14
    const isBassStep = [0, 3, 6, 8, 11, 14].includes(stepNum);
    if (isBassStep && bass.length > 0) {
      // Alternate between root and fifth
      const noteIdx = stepNum % 2 === 0 ? 0 : 1 % bass.length;
      const midiNote = bass[noteIdx];
      const freq = mToF(midiNote);
      this.playSynthBass(freq, time, 0.45);
    }

    // --- 2. Chord Comping (Bossa keys) ---
    // Chords play in syncopated rhythm: steps 0, 2, 5, 8, 10, 13
    const isChordStep = [0, 2, 5, 8, 10, 13].includes(stepNum);
    if (isChordStep && keys.length > 0) {
      // Play chord nodes
      keys.forEach((midiNote) => {
        this.playChordKey(mToF(midiNote), time, 0.12);
      });
    }

    // --- 3. Generative Solarpunk Melody ---
    // Generative melody plays on random steps with a soft flute/bell synth on a pentatonic subset
    const isMelodyStep = stepNum % 2 === 1 && Math.random() < 0.35;
    if (isMelodyStep && keys.length > 0) {
      // Choose a note from the current chord voicing, up 1 octave (+12)
      const noteIdx = Math.floor(Math.random() * keys.length);
      const midiNote = keys[noteIdx] + 12;
      this.playMelodyLead(mToF(midiNote), time, 0.15);
    }

    // --- 4. Soft Percussion (High-hat/shaker noise) ---
    // Shaker on every 8th note, accent on offbeats
    const isShakerStep = true;
    if (isShakerStep) {
      const volume = stepNum % 2 === 1 ? 0.015 : 0.007; // subtle shakers
      this.playShakerPercussion(time, volume);
    }
  }

  // --- Synthesizers built in Web Audio API ---

  private playChordKey(freq: number, time: number, vol: number) {
    if (!this.audioCtx || !this.radioGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'triangle'; // Smooth key sound
    osc.frequency.setValueAtTime(freq, time);

    // Warm lowpass filter to make it sound lofi/jazzy
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2); // long ring

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.radioGain);

    osc.start(time);
    osc.stop(time + 1.3);
  }

  private playSynthBass(freq: number, time: number, vol: number) {
    if (!this.audioCtx || !this.radioGain) return;

    const osc = this.audioCtx.createOscillator();
    const oscSub = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle'; // Warm acoustic-like sub bass
    osc.frequency.setValueAtTime(freq, time);

    oscSub.type = 'sine'; // Sub power
    oscSub.frequency.setValueAtTime(freq / 2, time); // sub-octave

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    oscSub.connect(gain);
    gain.connect(this.radioGain);

    osc.start(time);
    oscSub.start(time);
    osc.stop(time + 0.6);
    oscSub.stop(time + 0.6);
  }

  private playMelodyLead(freq: number, time: number, vol: number) {
    if (!this.audioCtx || !this.radioGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const delay = this.audioCtx.createDelay();
    const delayGain = this.audioCtx.createGain();

    osc.type = 'sine'; // Glassy bell tone
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.08); // slow attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);

    // Ethereal delay feedback
    delay.delayTime.setValueAtTime(0.28, time); // tempo-synced delay feel
    delayGain.gain.setValueAtTime(0.35, time); // delay feedback volume

    osc.connect(gain);
    gain.connect(this.radioGain);

    // Connect to delay line
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.radioGain);
    delayGain.connect(delay); // feedback loop

    osc.start(time);
    osc.stop(time + 1.2);
  }

  private playShakerPercussion(time: number, vol: number) {
    if (!this.audioCtx || !this.radioGain) return;

    // Synthesize noise shaker: buffer filled with random white noise
    const bufferSize = this.audioCtx.sampleRate * 0.04; // 40ms buffer
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass'; // shakers have no low frequencies
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.radioGain);

    noise.start(time);
    noise.stop(time + 0.04);
  }
}
