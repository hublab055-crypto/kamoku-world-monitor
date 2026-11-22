/**
 * Universal Engine — browser TTS / NPC dialogue adapter (ES module, no dependencies).
 * All Web Speech output is non-spatial. For positional VR audio, use three-spatial-voice.mjs
 * with pre-rendered WAV/MP3/OGG clips.
 */

const clamp = (number, min, max) => Math.min(max, Math.max(min, Number(number) || 0));
const normLang = (lang = 'ja-JP') => String(lang).replace('_', '-').toLowerCase();

/**
 * Bind mouth movement to the first supported morph on each mesh.
 * Avatar can be a THREE.Object3D, loaded glTF scene, or custom object with traverse().
 * Returns an adapter: (openness: number from 0 to 1) => void.
 */
export function bindMouthMorphs(avatar, preferred = [
  'mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_A', 'A', 'MouthOpen', 'JawOpen',
]) {
  const targets = [];
  if (!avatar?.traverse) return () => {};
  avatar.traverse((node) => {
    const dictionary = node.morphTargetDictionary;
    const influences = node.morphTargetInfluences;
    if (!dictionary || !influences) return;
    const name = preferred.find((key) => Number.isInteger(dictionary[key]));
    if (name) targets.push({ influences, index: dictionary[name] });
  });
  return (openness) => {
    const value = clamp(openness, 0, 1);
    for (const target of targets) target.influences[target.index] = value;
  };
}

/**
 * Dialog controller. speak() is initiated synchronously from say() when idle, so it
 * can be called inside a button/controller-grip event to satisfy autoplay policies.
 * SpeechSynth is global: TTS lines are serialized across all avatars.
 */
export class AvatarVoiceDirector {
  constructor({
    synthesis = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    onSubtitle = () => {},
    onState = () => {},
    requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  } = {}) {
    this.synthesis = synthesis;
    this.Utterance = Utterance;
    this.onSubtitle = onSubtitle;
    this.onState = onState;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.avatars = new Map();
    this.queue = [];
    this.active = null;
    this.draining = false;
    this.muted = false;
  }

  get supported() {
    return Boolean(this.synthesis?.speak && this.synthesis?.cancel && this.Utterance);
  }

  get voices() {
    return this.synthesis?.getVoices?.() || [];
  }

  registerAvatar(id, {
    lang = 'ja-JP', voiceName = null, rate = 1, pitch = 1, volume = 1,
    onMouth = () => {},
  } = {}) {
    if (!id) throw new Error('Avatar id is required');
    this.avatars.set(String(id), { lang, voiceName, rate, pitch, volume, onMouth });
    return () => {
      const key = String(id);
      // Removing an NPC must not cancel an unrelated NPC's current line.
      if (this.active?.avatarId === key) {
        this.active.finish('cancelled');
        this.synthesis?.cancel?.();
      }
      this.queue = this.queue.filter(job => {
        if (job.id !== key) return true;
        job.resolve({ status: 'cancelled' });
        return false;
      });
      this.avatars.delete(key);
    };
  }

  configureAvatar(id, overrides = {}) {
    const key = String(id);
    if (!this.avatars.has(key)) throw new Error(`Unknown avatar: ${key}`);
    this.avatars.set(key, { ...this.avatars.get(key), ...overrides });
  }

  /**
   * @returns {Promise<{status: 'completed'|'cancelled'|'unsupported'|'error'|'muted', error?:string}>}
   */
  say(id, text, { interrupt = false, ...overrides } = {}) {
    const key = String(id);
    const phrase = String(text || '').trim();
    if (!phrase) return Promise.resolve({ status: 'completed' });
    if (!this.avatars.has(key)) throw new Error(`Unknown avatar: ${key}`);
    if (this.muted) return Promise.resolve({ status: 'muted' });

    if (interrupt) this.stop({ clearQueue: true });
    return new Promise((resolve) => {
      this.queue.push({ id: key, text: phrase, overrides, resolve });
      void this._drain();
    });
  }

  /** Cancel current line and optionally discard pending lines. */
  stop({ clearQueue = true } = {}) {
    if (clearQueue) {
      for (const item of this.queue.splice(0)) item.resolve({ status: 'cancelled' });
    }
    if (this.active) {
      // Resolve even on browsers where speechSynthesis.cancel() emits no end event.
      this.active.finish('cancelled');
      this.synthesis?.cancel?.();
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stop();
  }

  _matchVoice(config) {
    const voices = this.voices;
    if (config.voiceName) {
      const byName = voices.find((v) => v.name === config.voiceName || v.voiceURI === config.voiceName);
      if (byName) return byName;
    }
    const expected = normLang(config.lang);
    return voices.find((v) => normLang(v.lang) === expected)
      || voices.find((v) => normLang(v.lang).split('-')[0] === expected.split('-')[0])
      || null;
  }

  async _drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift();
        const result = await this._play(job);
        job.resolve(result);
      }
    } finally {
      this.draining = false;
      // A new line may have arrived while draining was finishing.
      if (this.queue.length) void this._drain();
    }
  }

  _play(job) {
    const config = { ...this.avatars.get(job.id), ...job.overrides };
    const performance = {
      emotion: config.emotion ?? 'neutral',
      gesture: config.gesture ?? null,
      lookAt: config.lookAt ?? 'player',
      lineId: config.lineId ?? null,
      text: job.text,
      gestureStrength: config.gestureStrength ?? 1,
      gazeStrength: config.gazeStrength ?? 1,
      expressionStrength: config.expressionStrength ?? 1,
    };
    if (!this.supported) {
      this.onSubtitle({ avatarId: job.id, text: job.text, visible: true });
      this.onSubtitle({ avatarId: job.id, text: job.text, visible: false });
      return Promise.resolve({ status: 'unsupported' });
    }
    const utterance = new this.Utterance(job.text);
    utterance.lang = config.lang;
    utterance.rate = clamp(config.rate, 0.1, 10);
    utterance.pitch = clamp(config.pitch, 0, 2);
    utterance.volume = clamp(config.volume, 0, 1);
    const voice = this._matchVoice(config);
    if (voice) utterance.voice = voice;

    return new Promise((resolve) => {
      let finished = false;
      let frameId = null;
      let started = false;
      const setMouth = (value) => { try { config.onMouth(clamp(value, 0, 1)); } catch (_) { /* isolated avatar */ } };
      const finish = (status, error) => {
        if (finished) return;
        finished = true;
        if (frameId != null && this.cancelFrame) this.cancelFrame(frameId);
        setMouth(0);
        this.onSubtitle({ avatarId: job.id, text: job.text, visible: false });
        this.onState({ avatarId: job.id, speaking: false, status, ...performance });
        if (this.active?.finish === finish) this.active = null;
        resolve(error ? { status, error } : { status });
      };
      this.active = { finish, avatarId: job.id };
      const animate = (time) => {
        if (finished || !started) return;
        // Web Speech does not expose a waveform/phoneme timeline. This is approximate.
        const t = (Number.isFinite(time) ? time : Date.now()) * (0.013 * utterance.rate);
        const open = 0.18 + 0.60 * Math.pow(Math.sin(t), 2) * (0.65 + 0.35 * Math.sin(t * 0.29) ** 2);
        setMouth(open);
        if (this.requestFrame) frameId = this.requestFrame(animate);
      };
      utterance.onstart = () => {
        if (finished) return;
        started = true;
        this.onState({ avatarId: job.id, speaking: true, status: 'started', ...performance });
        if (this.requestFrame) frameId = this.requestFrame(animate);
        else setMouth(0.4);
      };
      utterance.onboundary = () => {
        if (!finished && started) setMouth(0.8);
      };
      utterance.onend = () => finish('completed');
      utterance.onerror = (event) => finish('error', String(event?.error || 'speech error'));
      this.onSubtitle({ avatarId: job.id, text: job.text, visible: true });
      try {
        this.synthesis.speak(utterance);
      } catch (error) {
        finish('error', String(error?.message || error));
      }
    });
  }
}