import { useEffect, useState } from 'react';
import { canPlayMusic, musicEnabled, setMusicEnabled, setMusicUrgent, startMusic, stopMusic } from '../lib/music';

/**
 * Plays the background music while `playing` is true and the player has it switched on.
 * `urgent` (the clock is nearly out) switches to the tenser loop.
 */
export function useQuizMusic(playing: boolean, urgent = false) {
  const [on, setOn] = useState(musicEnabled);
  useEffect(() => {
    if (!playing || !on) return;
    startMusic();
    return stopMusic;
  }, [playing, on]);
  useEffect(() => setMusicUrgent(playing && urgent), [playing, urgent]);
  const toggle = () => {
    setMusicEnabled(!on);
    setOn(!on);
  };
  return { on, toggle };
}

/** Music on/off switch for the top bar of a quiz. */
export function MusicButton({ on, toggle }: { on: boolean; toggle: () => void }) {
  if (!canPlayMusic()) return null;
  return (
    <button
      type="button"
      className="bar-btn music-btn"
      aria-pressed={on}
      aria-label="Background music"
      title={on ? 'Music on. Tap to turn it off' : 'Music off. Tap to turn it on'}
      onClick={toggle}
    >
      {on ? '🎵' : '🔇'}
    </button>
  );
}
