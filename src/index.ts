/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import z from 'zod';
import { Env } from './env';
import { searchUsers, updateMetadata } from './auth0';

const bodyParameters = z.object({
	full_name: z.string(),
});

type TokenPayload = {
	sub: string;
	sig: string;
	sso: string;
};

// el nickname es primeras letras de nombres y el apellido entero
// ejemplo 1: Juan Perez => jperez
// ejemplo 2: Juan Ignacio Perez => jiperez
function getFirstNickname(fullName: string) {
	fullName = fullName.toLowerCase().trim();
	const splitFullname = fullName.split(' ');
	let out = '';
	for (let i = 0; i < splitFullname.length - 1; i++) {
		out += splitFullname[i][0];
	}
	return out + splitFullname[splitFullname.length - 1];
}

// se procede a chequear que no existe ese usuario en el sistema
// si llega a existir el primer nombre de usuario, se procede a agregar un número (empezando por 1) y se vuelve a chequear
// si llega a existir un nombre de usuario con un número, se aumenta el número y se vuelve a chequear
async function checkNickname(nickname: string, env: Env, i = 0): Promise<string> {
	i = i + 1;
	const result = await searchUsers(`user_metadata.nickname.raw:"${nickname}"`, env);
	if (result.statusCode !== 200) throw Error('Hubo un error al consultar usuarios con nicknames similares: ' + result.statusText);
	if ((result.data as unknown[]).length) {
		const newNickname = await checkNickname(nickname + '' + i, env, i);
		return newNickname;
	} else {
		return nickname;
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// este endpoint es para procesar el resultado de un form, verifiquemos el método
		if (request.method !== 'POST') {
			return new Response('Método no permitido', {
				status: 405,
			});
		}

		// procesar URL para chequeos
		const url = new URL(request.url);

		// chequear que es el pathname correcto
		if (url.pathname !== '/nombre-completo') {
			throw Error('No se ha accedido el recurso correcto');
		}

		// verificar que token y state existen
		const token = url.searchParams.get('token');
		if (!token) {
			throw Error('No se ha suministrado un token válido');
		}

		const state = url.searchParams.get('state');
		if (!state) {
			throw Error('No se ha suministrado un state válido');
		}

		// verificar que el token es correcto
		const jwtValido = await jwt.verify(token, env.JWT_SECRET);
		if (!jwtValido) {
			throw Error('El token suminstrado no es válido');
		}

		// token valido,
		const { payload: user } = jwt.decode<TokenPayload>(token);
		if (!user?.sub) throw Error('El token suministrado no tiene las propiedades necesarias');

		// extraer datos del formulario
		const formData = await request.formData();
		const tempBody: { [key: string]: string } = {};
		for (const entry of formData.entries()) {
			tempBody[entry[0]] = entry[1];
		}
		const bodyParsed = bodyParameters.safeParse(tempBody);
		if (!bodyParsed.success) {
			throw Error('Ha ocurrido un error al procesar los datos del formulario: ' + bodyParsed.error.message);
		}
		const body = bodyParsed.data;

		// este endpoint es para poder agregar un campo full_name que representa el nombre completo de la persona
		// se espera información en el cuerpo del request ya que se espera que se utilice un formulario con método POST
		const validNickname = getFirstNickname(body.full_name);
		const newNickname = await checkNickname(validNickname, env);

		const responseUserMetadata = await updateMetadata(
			user.sub,
			{ user_metadata: { full_name: body.full_name, nickname: newNickname } },
			env
		);
		if (responseUserMetadata.statusCode !== 200)
			throw Error('Hubo un error al actualizar los datos del usuario: ' + responseUserMetadata.statusText);

		const responseAppMetadata = await updateMetadata(user.sub, { app_metadata: { nombre_completo_revisado: true } }, env);
		if (responseAppMetadata.statusCode !== 200)
			throw Error('Hubo un error al actualizar los datos de la app para el usuario: ' + responseAppMetadata.statusText);

		return Response.redirect(`https://entrar.mivoz.uy/continue?state=${state}&sig=${user.sig}&sso=${user.sso}&token=${token}`, 301);
	},
};
