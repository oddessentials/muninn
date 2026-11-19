import type { HandleClientError } from '@sveltejs/kit/hooks';

export const handleError: HandleClientError = (caught) => {
  const status = caught.kind === 'unknown' ? 500 : caught.error.status;
  const message = caught.kind === 'unknown' ? 'Internal Error' : caught.error.message;
  console.error('client error', status, caught.error);
  return { message, code: `client_${status}` };
};
