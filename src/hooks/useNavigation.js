import { useCallback, useEffect, useRef, useState } from 'react';
import { haversine } from '../utils/geo';
import { playInstructionAudio, preloadAudio } from '../services/elevenlabs';

const TRIGGER_M = 20;  // announce step when user is within 20 m of the maneuver point
const ARRIVAL_M = 25;  // announce arrival when within 25 m of the destination

export function describeStep(step, index, total) {
  const road = step.name?.trim() || 'the route';
  const mod = step.modifier;
  switch (step.instruction) {
    case 'depart':      return `Head off along ${road}`;
    case 'arrive':      return 'You have arrived at your destination';
    case 'roundabout':
    case 'rotary':      return `Take the roundabout onto ${road}`;
    case 'merge':       return `Merge onto ${road}`;
    case 'fork':        return `Keep ${mod || 'ahead'} onto ${road}`;
    default:
      if (index === 0)           return `Head off along ${road}`;
      if (index === total - 1)   return 'You have arrived at your destination';
      if (mod)                   return `Turn ${mod} onto ${road}`;
      return `Continue onto ${road}`;
  }
}

// All navigation logic lives here. updatePosition is kept stable via refs so
// callers can put it in a useEffect without stale-closure issues.
export function useNavigation({ steps, endCoord, active, apiKey, voiceId }) {
  const [nextStepIdx, setNextStepIdx] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(null);
  const [arrived, setArrived] = useState(false);

  // Refs mirror the latest values so the stable updatePosition callback
  // never closes over stale state.
  const stepsRef    = useRef(steps);
  const endCoordRef = useRef(endCoord);
  const activeRef   = useRef(active);
  const apiKeyRef   = useRef(apiKey);
  const voiceIdRef  = useRef(voiceId);
  const nextIdxRef  = useRef(0);
  const arrivedRef  = useRef(false);
  const spokenRef   = useRef(new Set());
  const wasActiveRef = useRef(false);

  useEffect(() => { stepsRef.current    = steps;    }, [steps]);
  useEffect(() => { endCoordRef.current = endCoord; }, [endCoord]);
  useEffect(() => { activeRef.current   = active;   }, [active]);
  useEffect(() => { apiKeyRef.current   = apiKey;   }, [apiKey]);
  useEffect(() => { voiceIdRef.current  = voiceId;  }, [voiceId]);

  // Reset state and announce first step when navigation starts
  useEffect(() => {
    if (active && !wasActiveRef.current && steps?.length) {
      nextIdxRef.current = 0;
      arrivedRef.current = false;
      spokenRef.current  = new Set([0]); // mark step 0 as already announced
      setNextStepIdx(0);
      setArrived(false);
      setDistanceToNext(null);

      const intro = describeStep(steps[0], 0, steps.length);
      playInstructionAudio(`Navigation started. ${intro}`, apiKey, voiceId);

      if (steps[1]) {
        preloadAudio(describeStep(steps[1], 1, steps.length), apiKey, voiceId);
      }
    }
    if (!active) {
      nextIdxRef.current = 0;
      arrivedRef.current = false;
      spokenRef.current  = new Set();
      setNextStepIdx(0);
      setArrived(false);
      setDistanceToNext(null);
    }
    wasActiveRef.current = active;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Stable callback — safe to include in any dependency array
  const updatePosition = useCallback((pos) => {
    if (!activeRef.current || !pos || arrivedRef.current) return;

    const steps    = stepsRef.current;
    const endCoord = endCoordRef.current;
    const apiKey   = apiKeyRef.current;
    const voiceId  = voiceIdRef.current;
    const nextIdx  = nextIdxRef.current;
    const userPt   = [pos.lat, pos.lng];

    if (!steps?.length) return;

    // Check destination arrival
    if (endCoord && !spokenRef.current.has('arrival')) {
      const dEnd = haversine(userPt, endCoord);
      if (dEnd <= ARRIVAL_M) {
        spokenRef.current.add('arrival');
        arrivedRef.current = true;
        setArrived(true);
        playInstructionAudio('You have arrived at your destination!', apiKey, voiceId);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
      }
    }

    // Scan the next few steps to find the closest upcoming maneuver point
    let bestIdx  = -1;
    let bestDist = Infinity;
    const lookahead = Math.min(steps.length, nextIdx + 5);
    for (let i = nextIdx; i < lookahead; i++) {
      const loc = steps[i]?.location;
      if (!loc) continue;
      const d = haversine(userPt, loc);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    if (bestIdx >= 0) setDistanceToNext(Math.round(bestDist));

    if (bestIdx >= 0 && bestDist <= TRIGGER_M && !spokenRef.current.has(bestIdx)) {
      spokenRef.current.add(bestIdx);
      const text = describeStep(steps[bestIdx], bestIdx, steps.length);
      playInstructionAudio(text, apiKey, voiceId);
      if (navigator.vibrate) navigator.vibrate(50);

      const newNext = bestIdx + 1;
      nextIdxRef.current = newNext;
      setNextStepIdx(newNext);

      if (steps[newNext]) {
        preloadAudio(describeStep(steps[newNext], newNext, steps.length), apiKey, voiceId);
      }
    }
  }, []); // empty deps — reads exclusively through refs

  const currentStep = steps?.[nextStepIdx] ?? null;
  const currentInstruction = arrived
    ? 'You have arrived!'
    : currentStep
    ? describeStep(currentStep, nextStepIdx, steps?.length ?? 0)
    : null;

  return {
    nextStepIdx,
    distanceToNext,
    currentInstruction,
    currentStep,
    arrived,
    updatePosition,
  };
}
