use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_speech_recognition);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<SpeechRecognition<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(
        "nz.org.jwtalk.teleprompter.speech",
        "SpeechRecognitionPlugin",
    )?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_speech_recognition)?;
    Ok(SpeechRecognition(handle))
}

/// Access to the speech-recognition APIs.
pub struct SpeechRecognition<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> SpeechRecognition<R> {
    pub fn is_available(&self) -> crate::Result<AvailabilityResponse> {
        self.0
            .run_mobile_plugin("isAvailable", ())
            .map_err(Into::into)
    }

    pub fn start(&self, payload: StartRequest) -> crate::Result<OperationResponse> {
        self.0
            .run_mobile_plugin("start", payload)
            .map_err(Into::into)
    }

    pub fn stop(&self) -> crate::Result<OperationResponse> {
        self.0.run_mobile_plugin("stop", ()).map_err(Into::into)
    }
}
