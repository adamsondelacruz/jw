use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::SpeechRecognitionExt;

#[command]
pub(crate) async fn is_available<R: Runtime>(app: AppHandle<R>) -> Result<AvailabilityResponse> {
    app.speech_recognition().is_available()
}

#[command]
pub(crate) async fn start<R: Runtime>(
    app: AppHandle<R>,
    payload: StartRequest,
) -> Result<OperationResponse> {
    app.speech_recognition().start(payload)
}

#[command]
pub(crate) async fn stop<R: Runtime>(app: AppHandle<R>) -> Result<OperationResponse> {
    app.speech_recognition().stop()
}
