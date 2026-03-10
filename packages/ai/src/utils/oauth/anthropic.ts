import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const decode = (s: string) => atob(s);
const CLIENT_ID = decode("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://console.anthropic.com/oauth/authorize";
const TOKEN_URL = "https://api.anthropic.com/oauth/token";
const REDIRECT_URI = "https://pi.dev/oauth/anthropic";
const SCOPES = "org:create_api_key user:profile user:inference";

async function performLogin(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	const { verifier, challenge } = await generatePKCE();
	const authParams = new URLSearchParams({
		code: "true",
		client_id: CLIENT_ID,
		response_type: "code",
		redirect_uri: REDIRECT_URI,
		scope: SCOPES,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});
	const authUrl = `${AUTHORIZE_URL}?${authParams.toString()}`;
	callbacks.onAuth({ url: authUrl });
	const code = await callbacks.onPrompt({ message: "Enter the authorization code:" });
	const tokenParams = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: CLIENT_ID,
		code,
		redirect_uri: REDIRECT_URI,
		code_verifier: verifier,
	});
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: tokenParams.toString(),
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Anthropic OAuth error: ${response.status} ${text}`);
	}
	const data = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		token_type: string;
		expires_in?: number;
	};
	return {
		access: data.access_token,
		refresh: data.refresh_token || "",
		expires: data.expires_in ? Date.now() + data.expires_in * 1000 : 0,
	};
}

export async function loginAnthropic(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	return performLogin(callbacks);
}

async function refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	return credentials;
}

function getApiKey(credentials: OAuthCredentials): string {
	return credentials.access;
}

export const AnthropicOAuthProvider: OAuthProviderInterface = {
	id: "anthropic",
	name: "Anthropic",
	login: performLogin,
	refreshToken,
	getApiKey,
};
