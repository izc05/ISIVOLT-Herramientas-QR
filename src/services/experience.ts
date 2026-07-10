import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export type ExperienceSettings = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

export type ExperienceCue = 'scan' | 'delivery' | 'return' | 'incident' | 'error' | 'photo';

const SETTINGS_KEY = 'isivolt-experience-settings';
const DEFAULT_SETTINGS: ExperienceSettings = { soundEnabled: true, hapticsEnabled: true };

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
};

export const primeExperienceAudio = () => {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
};

const tone = (frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
};

const playCueSound = (cue: ExperienceCue) => {
  switch (cue) {
    case 'scan':
      tone(920, 0, 0.08, 0.055, 'sine');
      tone(1240, 0.06, 0.09, 0.045, 'sine');
      break;
    case 'delivery':
      tone(420, 0, 0.14, 0.06, 'triangle');
      tone(620, 0.09, 0.16, 0.07, 'triangle');
      tone(880, 0.2, 0.22, 0.055, 'sine');
      break;
    case 'return':
      tone(820, 0, 0.13, 0.055, 'triangle');
      tone(590, 0.1, 0.16, 0.065, 'triangle');
      tone(390, 0.22, 0.2, 0.05, 'sine');
      break;
    case 'incident':
      tone(260, 0, 0.18, 0.07, 'sawtooth');
      tone(210, 0.2, 0.2, 0.065, 'sawtooth');
      break;
    case 'error':
      tone(180, 0, 0.13, 0.065, 'square');
      tone(145, 0.15, 0.17, 0.06, 'square');
      break;
    case 'photo':
      tone(760, 0, 0.07, 0.045, 'sine');
      tone(980, 0.055, 0.1, 0.04, 'sine');
      break;
  }
};

const playHaptic = async (cue: ExperienceCue) => {
  try {
    if (cue === 'scan' || cue === 'photo') {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
    const type = cue === 'incident' ? NotificationType.Warning : cue === 'error' ? NotificationType.Error : NotificationType.Success;
    await Haptics.notification({ type });
  } catch {
    const pattern = cue === 'error' || cue === 'incident' ? [120, 70, 120] : cue === 'scan' ? [45] : [70, 40, 90];
    navigator.vibrate?.(pattern);
  }
};

export const loadExperienceSettings = async (): Promise<ExperienceSettings> => {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (!value) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(value) as Partial<ExperienceSettings>;
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      hapticsEnabled: parsed.hapticsEnabled ?? true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveExperienceSettings = async (settings: ExperienceSettings) => {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
};

export const runExperienceCue = async (cue: ExperienceCue, settings: ExperienceSettings) => {
  if (settings.soundEnabled) playCueSound(cue);
  if (settings.hapticsEnabled) await playHaptic(cue);
};
