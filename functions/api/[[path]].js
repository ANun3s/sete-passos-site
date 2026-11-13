import { handleApiRequest } from '../../server/cloudflare-api.mjs';

export async function onRequest(context) {
  return handleApiRequest(context.request, context.env);
}
