import { Env } from './env';

type Metadata = { [key: string]: any };
type UserMetadata = { user_metadata: Metadata };
type AppMetadata = { app_metadata: Metadata };
type UpdatedValues = UserMetadata | AppMetadata;

let AUTH0_MGMT_ACCESS_TOKEN: string | null = null;

export async function getMgmtAccessToken(env: Env) {
	if (AUTH0_MGMT_ACCESS_TOKEN !== null) return AUTH0_MGMT_ACCESS_TOKEN;
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
		},
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			client_id: env.APP_CLIENT_ID,
			client_secret: env.APP_CLIENT_SECRET,
			audience: `https://${env.AUTH0_DOMAIN}/api/v2/`,
		}),
	};
	const response = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, options);
	const data = await response.json();
	if (response.status !== 200) {
		throw Error('No se pudo obtener un access token de Auth0: ' + response.status + ' : ' + response.statusText);
	}
	AUTH0_MGMT_ACCESS_TOKEN = (data as { access_token: string }).access_token;
	return AUTH0_MGMT_ACCESS_TOKEN;
}

export async function updateMetadata(userId: string, newValues: UpdatedValues, env: Env) {
	const accessToken = await getMgmtAccessToken(env);
	const options = {
		method: 'PATCH',
		headers: {
			authorization: `Bearer ${accessToken}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify(newValues),
	};
	const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users/${userId}`, options);
	const data = await response.json();
	return { data, statusCode: response.status, statusText: response.statusText };
}

export async function searchUsers(q: string, env: Env) {
	const accessToken = await getMgmtAccessToken(env);
	const options = {
		method: 'GET',
		headers: {
			authorization: `Bearer ${accessToken}`,
		},
	};
	const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=${q}&search_engine=v2`, options);
	const data = await response.json();
	return { data, statusCode: response.status, statusText: response.statusText };
}
