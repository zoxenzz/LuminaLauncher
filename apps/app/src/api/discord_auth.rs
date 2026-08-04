use crate::api::Result;
use crate::api::TheseusSerializableError;
use crate::api::oauth_utils;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;
use tauri::Runtime;
use tauri::plugin::TauriPlugin;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;
use url::Url;

const DISCORD_AUTHORIZE_URL: &str = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL: &str = "https://discord.com/api/oauth2/token";
const DISCORD_SCOPES: &str = "identify guilds.members.read";

/// The token response returned by Discord's OAuth2 token endpoint.
#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordTokenResponse {
	pub access_token: String,
	pub token_type: String,
	pub expires_in: u64,
	pub scope: String,
	pub refresh_token: Option<String>,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
	tauri::plugin::Builder::new("discord-auth")
		.invoke_handler(tauri::generate_handler![
			discord_login,
			discord_cancel_login,
			discord_logout,
		])
		.build()
}

fn random_bytes(len: usize) -> Vec<u8> {
	let mut bytes = vec![0u8; len];
	OsRng.fill_bytes(&mut bytes);
	bytes
}

fn pkce_verifier() -> String {
	URL_SAFE_NO_PAD.encode(random_bytes(32))
}

fn pkce_challenge(verifier: &str) -> String {
	URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

#[tauri::command]
pub async fn discord_login<R: Runtime>(
	app: tauri::AppHandle<R>,
	client_id: String,
	client_secret: String,
) -> Result<DiscordTokenResponse> {
	let (auth_code_recv_socket_tx, auth_code_recv_socket) = oneshot::channel();
	let auth_code = tokio::spawn(oauth_utils::auth_code_reply::listen(
		auth_code_recv_socket_tx,
	));

	let auth_code_recv_socket = auth_code_recv_socket.await.unwrap()?;
	let redirect_uri = format!("http://127.0.0.1:{}", auth_code_recv_socket.port());

	let code_verifier = pkce_verifier();
	let code_challenge = pkce_challenge(&code_verifier);
	let state = URL_SAFE_NO_PAD.encode(random_bytes(16));

	let mut auth_url = Url::parse(DISCORD_AUTHORIZE_URL).map_err(|e| {
		TheseusSerializableError::Theseus(
			theseus::ErrorKind::OtherError(format!("Failed to parse auth URL: {e}")).into(),
		)
	})?;
	auth_url.query_pairs_mut().append_pair("client_id", &client_id);
	auth_url
		.query_pairs_mut()
		.append_pair("response_type", "code");
	auth_url
		.query_pairs_mut()
		.append_pair("redirect_uri", &redirect_uri);
	auth_url.query_pairs_mut().append_pair("scope", DISCORD_SCOPES);
	auth_url.query_pairs_mut().append_pair("state", &state);
	auth_url
		.query_pairs_mut()
		.append_pair("code_challenge", &code_challenge);
	auth_url
		.query_pairs_mut()
		.append_pair("code_challenge_method", "S256");
	auth_url.query_pairs_mut().append_pair("prompt", "consent");

	app.opener()
		.open_url(auth_url.as_str(), None::<&str>)
		.map_err(|e| {
			TheseusSerializableError::Theseus(
				theseus::ErrorKind::OtherError(format!("Failed to open auth request URI: {e}"))
					.into(),
			)
		})?;

	let Some(auth_code) = auth_code.await.unwrap()? else {
		return Err(TheseusSerializableError::Theseus(
			theseus::ErrorKind::OtherError("Login canceled".into()).into(),
		));
	};

	let token_response = reqwest::Client::new()
		.post(DISCORD_TOKEN_URL)
		.form(&[
			("grant_type", "authorization_code"),
			("code", &auth_code),
			("redirect_uri", &redirect_uri),
			("client_id", &client_id),
			("client_secret", &client_secret),
			("code_verifier", &code_verifier),
		])
		.send()
		.await
		.map_err(|e| {
			TheseusSerializableError::Theseus(
				theseus::ErrorKind::OtherError(format!("Failed to exchange auth code: {e}")).into(),
			)
		})?
		.error_for_status()
		.map_err(|e| {
			TheseusSerializableError::Theseus(
				theseus::ErrorKind::OtherError(format!("Failed to exchange auth code: {e}")).into(),
			)
		})?
		.json::<DiscordTokenResponse>()
		.await
		.map_err(|e| {
			TheseusSerializableError::Theseus(
				theseus::ErrorKind::OtherError(format!("Failed to parse token response: {e}")).into(),
			)
		})?;

	if let Some(main_window) = app.get_window("main") {
		main_window.set_focus().ok();
	}

	Ok(token_response)
}

#[tauri::command]
pub fn discord_cancel_login() {
	oauth_utils::auth_code_reply::stop_listeners();
}

#[tauri::command]
pub async fn discord_logout(
	client_id: String,
	client_secret: String,
	access_token: String,
) -> Result<()> {
	// Best-effort token revocation; the frontend always clears its stored session.
	let _ = reqwest::Client::new()
		.post("https://discord.com/api/oauth2/token/revoke")
		.form(&[
			("token", &access_token),
			("client_id", &client_id),
			("client_secret", &client_secret),
		])
		.send()
		.await;
	Ok(())
}
