import { useState, useEffect, useRef } from 'react';

// Declare globals for the recording environment
declare global {
  interface Window {
    startRecording?: () => void;
    stopRecording?: () => void;
  }
}

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const durationsList = Object.values(durations);
  const keysList = Object.keys(durations);
  const totalScenes = durationsList.length;
  
  const hasStartedRecording = useRef(false);
  const hasCompletedFirstPass = useRef(false);

  useEffect(() => {
    // Start recording only once on mount
    if (!hasStartedRecording.current) {
      if (window.startRecording) {
        window.startRecording();
      }
      hasStartedRecording.current = true;
    }

    const currentDuration = durationsList[currentScene] || 5000;
    
    const timer = setTimeout(() => {
      setCurrentScene((prev) => {
        const next = prev + 1;
        
        // If we just finished the last scene
        if (next === totalScenes && !hasCompletedFirstPass.current) {
          if (window.stopRecording) {
            window.stopRecording();
          }
          hasCompletedFirstPass.current = true;
        }
        
        // Loop back to 0
        return next % totalScenes;
      });
    }, currentDuration);
    
    return () => clearTimeout(timer);
  }, [currentScene, durationsList, totalScenes]);

  return { 
    currentScene, 
    currentSceneKey: keysList[currentScene],
  };
}