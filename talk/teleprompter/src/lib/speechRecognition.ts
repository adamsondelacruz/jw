import {
  addPluginListener,
  invoke,
  isTauri,
  requestPermissions,
  type PluginListener,
} from "@tauri-apps/api/core";

const PLUGIN_NAME = "speech-recognition";

export type SpeechSessionOptions = {
  locale?: string;
  onTranscript: (transcript: string) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
};

export type StopSpeechSession = () => Promise<void>;

export async function startSpeechSession(options: SpeechSessionOptions): Promise<StopSpeechSession> {
  if (isTauri()) return startNativeSession(options);
  return startBrowserSession(options);
}

async function startNativeSession(options: SpeechSessionOptions): Promise<StopSpeechSession> {
  const listeners: PluginListener[] = [];

  try {
    listeners.push(
      await addPluginListener<{ transcript: string }>(PLUGIN_NAME, "result", ({ transcript }) => {
        if (transcript) options.onTranscript(transcript);
      }),
      await addPluginListener<{ status: string }>(PLUGIN_NAME, "status", ({ status }) => {
        options.onStatus(status);
      }),
      await addPluginListener<{ message: string }>(PLUGIN_NAME, "error", ({ message }) => {
        options.onError(message);
      }),
    );

    const availability = await invoke<{ available: boolean }>(`plugin:${PLUGIN_NAME}|is_available`);
    if (!availability.available) throw new Error("Speech recognition is not available on this device.");

    await requestPermissions<Record<string, string>>(PLUGIN_NAME);
    await invoke(`plugin:${PLUGIN_NAME}|start`, {
      payload: { locale: options.locale ?? "en-US" },
    });
    options.onStatus("listening");
  } catch (reason) {
    await Promise.all(listeners.map((listener) => listener.unregister()));
    throw reason;
  }

  return async () => {
    await invoke(`plugin:${PLUGIN_NAME}|stop`).catch(() => undefined);
    await Promise.all(listeners.map((listener) => listener.unregister()));
  };
}

function startBrowserSession(options: SpeechSessionOptions): StopSpeechSession {
  const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SpeechRecognition) throw new Error("Speech recognition is not supported in this browser.");

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options.locale ?? "en-US";
  recognition.onstart = () => options.onStatus("listening");
  recognition.onerror = () => options.onStatus("uncertain");
  recognition.onresult = (event) => {
    const transcript = getBrowserTranscript(event);
    if (transcript) options.onTranscript(transcript);
  };
  recognition.start();

  return async () => recognition.stop();
}

function getBrowserTranscript(event: Event) {
  const speechEvent = event as Event & {
    resultIndex?: number;
    results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
  };
  if (!speechEvent.results) return "";

  const transcripts: string[] = [];
  for (let index = speechEvent.resultIndex ?? 0; index < speechEvent.results.length; index += 1) {
    const transcript = speechEvent.results[index]?.[0]?.transcript;
    if (transcript) transcripts.push(transcript);
  }
  return transcripts.join(" ");
}
