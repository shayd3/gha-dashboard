import { ref, onUnmounted, watch, type Ref } from "vue";

export function usePolling(
  callback: () => Promise<void>,
  intervalSeconds: Ref<number>
) {
  const isPolling = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    stop();
    isPolling.value = true;
    timer = setInterval(async () => {
      try {
        await callback();
      } catch {
        // errors handled by caller
      }
    }, intervalSeconds.value * 1000);
  }

  function stop() {
    isPolling.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
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
      start();
    }
  });

  onUnmounted(() => stop());

  return { isPolling, start, stop, refreshNow };
}
