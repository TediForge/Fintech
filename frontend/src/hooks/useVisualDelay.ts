import { useEffect, useState } from 'react';

export function useVisualDelay(isReady: boolean, delayMs = 0): boolean {
    const [showPlaceholder, setShowPlaceholder] = useState(true);

    useEffect(() => {
        if (!isReady) {
            setShowPlaceholder(true);
            return;
        }
        if (delayMs <= 0) {
            setShowPlaceholder(false);
            return;
        }

        const timer = setTimeout(() => setShowPlaceholder(false), delayMs);
        return () => clearTimeout(timer);
    }, [isReady, delayMs]);

    return showPlaceholder;
}

export function useCascadingDelays(stepMs = 50): () => number {
    const [callCount, setCallCount] = useState(0);
    return () => {
        const currentDelay = callCount * stepMs;
        setCallCount((previousCount) => previousCount + 1);
        return currentDelay;
    };
}

export function useMinimumLoadingDisplay(isAuthLoading: boolean, minDisplayMs = 0): boolean {
    const [shouldDisplayLoading, setShouldDisplayLoading] = useState(isAuthLoading);
    const [authCompleteTime, setAuthCompleteTime] = useState<number | null>(null);

    useEffect(() => {
        if (isAuthLoading) {
            setShouldDisplayLoading(true);
            setAuthCompleteTime(null);
        } else if (authCompleteTime === null) {
            setAuthCompleteTime(Date.now());
        }
    }, [isAuthLoading, authCompleteTime]);

    useEffect(() => {
        if (authCompleteTime === null) return;
        const remainingMs = minDisplayMs - (Date.now() - authCompleteTime);
        if (remainingMs <= 0) {
            setShouldDisplayLoading(false);
            return;
        }
        const timer = setTimeout(() => setShouldDisplayLoading(false), remainingMs);
        return () => clearTimeout(timer);
    }, [authCompleteTime, minDisplayMs]);

    return shouldDisplayLoading;
}