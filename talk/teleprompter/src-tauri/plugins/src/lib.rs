use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::SpeechRecognition;
#[cfg(mobile)]
use mobile::SpeechRecognition;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the speech-recognition APIs.
pub trait SpeechRecognitionExt<R: Runtime> {
    fn speech_recognition(&self) -> &SpeechRecognition<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SpeechRecognitionExt<R> for T {
    fn speech_recognition(&self) -> &SpeechRecognition<R> {
        self.state::<SpeechRecognition<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("speech-recognition")
        .invoke_handler(tauri::generate_handler![
            commands::is_available,
            commands::start,
            commands::stop
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let speech_recognition = mobile::init(app, api)?;
            #[cfg(desktop)]
            let speech_recognition = desktop::init(app, api)?;
            app.manage(speech_recognition);
            Ok(())
        })
        .build()
}
