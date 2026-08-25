use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<SpeechRecognition<R>> {
    Ok(SpeechRecognition(app.clone()))
}

/// Access to the speech-recognition APIs.
pub struct SpeechRecognition<R: Runtime>(AppHandle<R>);

impl<R: Runtime> SpeechRecognition<R> {
    pub fn is_available(&self) -> crate::Result<AvailabilityResponse> {
        Ok(AvailabilityResponse { available: false })
    }

    pub fn start(&self, _payload: StartRequest) -> crate::Result<OperationResponse> {
        Ok(OperationResponse { active: false })
    }

    pub fn stop(&self) -> crate::Result<OperationResponse> {
        Ok(OperationResponse { active: false })
    }
}
