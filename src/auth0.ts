import { Env } from './env';

type Metadata = { [key: string]: any };
type UserMetadata = { user_metadata: Metadata };
type AppMetadata = { app_metadata: Metadata };
type UpdatedValues = UserMetadata | AppMetadata;

export async function updateMetadata(userId: string, newValues: UpdatedValues, env: Env) {
	const options = {
		method: 'PATCH',
		headers: {
			authorization: `Bearer ${env.MGMT_API_ACCESS_TOKEN}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify(newValues),
	};
	const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users/${userId}`, options);
	const data = await response.json();
	return { data, statusCode: response.status, statusText: response.statusText };
}

export async function searchUsers(q: string, env: Env) {
	const options = {
		method: 'GET',
		headers: {
			authorization: `Bearer ${env.MGMT_API_ACCESS_TOKEN}`,
		},
	};
	const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/users?q=${q}&search_engine=v2`, options);
	const data = await response.json();
	return { data, statusCode: response.status, statusText: response.statusText };
}
