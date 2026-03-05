import { ref, onUnmounted, watch, type Ref } from "vue";

export function usePolling(
  callback: () => Promise<void>,
  intervalSeconds: Ref<number>
) {
  const isPolling = ref(false);
  const isPaused = ref(false);
  const sleepUntil = ref<Date | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;
  let sleepTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSleepTimer() {
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      sleepTimer = null;
    }
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(async () => {
      if (isPaused.value) return;
      try {
        await callback();
      } catch {
        // errors handled by caller
      }
    }, intervalSeconds.value * 1000);
  }

  function start() {
    isPolling.value = true;
    isPaused.value = false;
    sleepUntil.value = null;
    clearSleepTimer();
    restartTimer();
  }

  function stop() {
    isPolling.value = false;
    isPaused.value = false;
    sleepUntil.value = null;
    clearSleepTimer();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function pause() {
    isPaused.value = true;
    sleepUntil.value = null;
    clearSleepTimer();
  }

  function resume() {
    isPaused.value = false;
    sleepUntil.value = null;
    clearSleepTimer();
  }

  function sleepFor(ms: number) {
    clearSleepTimer();
    isPaused.value = true;
    sleepUntil.value = new Date(Date.now() + ms);
    sleepTimer = setTimeout(() => {
      isPaused.value = false;
      sleepUntil.value = null;
    }, ms);
  }

  async function refreshNow() {
    try {
      await callback();
    } catch {
      // errors handled by caller
    }
  }

  watch(intervalSeconds, () => {
    if (isPolling.value) {
      restartTimer();
    }
  });

  onUnmounted(() => stop());

  return { isPolling, isPaused, sleepUntil, start, stop, pause, resume, sleepFor, refreshNow };
}
