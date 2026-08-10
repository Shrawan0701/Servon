import { useCallback, useEffect, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

export function useVoicePlaybackController() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback(async () => {
    try {
      if (player) {
        player.pause();
      }
    } catch (e) {
      console.log("Stop playback:", e);
    }

    setIsPlaying(false);
  }, [player]);

 
  const play = useCallback(
    async (source) => {
      if (!source) return;

      try {
        player.pause();

        // replace ONLY with a valid source
        player.replace(source);

        player.play();

        setIsPlaying(true);
      } catch (e) {
        console.log("Play error:", e);
        setIsPlaying(false);
      }
    },
    [player]
  );

  useEffect(() => {
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  }, [status.didJustFinish]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return {
    play,
    stop,
    isPlaying,
  };
}