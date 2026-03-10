import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const OAUTH_BASE = "https://oauth2.googleapis.com";
const AUTH_BASE = "https://accounts.google.com";

export interface GoogleAntigravityOptions {
	clientId: string;
	scopes?: string[];
}

export function createGoogleAntigravityProvider(options: GoogleAntigravityOptions): OAuthProviderInterface {
	const { clientId, scopes = ["openid", "email", "profile"] } = options;

	return {
		id: "google-antigravity",
		name: "Google (Antigravity)",
		async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
			const { verifier, challenge } = await generatePKCE();
			const authParams = new URLSearchParams({
				client_id: clientId,
				response_type: "code",
				scope: scopes.join(" "),
				code_challenge: challenge,
				code_challenge_method: "S256",
				redirect_uri: "http://localhost:8085/oauth/callback",
			});

			const authUrl = `${AUTH_BASE}/o/oauth2/v2/auth?${authParams.toString()}`;
			callbacks.onAuth({ url: authUrl });

			const code = await callbacks.onPrompt({
				message: "Enter the authorization code:",
			});

			const tokenParams = new URLSearchParams({
				grant_type: "authorization_code",
				client_id: clientId,
				code,
				redirect_uri: "http://localhost:8085/oauth/callback",
				code_verifier: verifier,
			});

			const response = await fetch(`${OAUTH_BASE}/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: tokenParams.toString(),
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Google OAuth error: ${response.status} ${text}`);
			}

			const data = (await response.json()) as {
				access_token: string;
				token_type: string;
				expires_in?: number;
				refresh_token?: string;
			};

			return {
				access: data.access_token,
				refresh: data.refresh_token || "",
				expires: data.expires_in ? Date.now() + data.expires_in * 1000 : 0,
			};
		},
		async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
			return credentials;
		},
		getApiKey(credentials: OAuthCredentials): string {
			return credentials.access;
		},
	};
}
