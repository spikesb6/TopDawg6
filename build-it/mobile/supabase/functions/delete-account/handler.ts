import { corsHeaders, json } from '../_shared/http.ts';

type Deps = {
  /** The account id for a signed-in user's access token, or null if it isn't valid. */
  userIdFromToken: (token: string) => Promise<string | null>;
  /** Deletes the person's photo folder. Storage files don't go with the account on their own. */
  deleteUserFiles: (userId: string) => Promise<void>;
  /** Deletes the account. The saved build goes with it (on delete cascade). */
  deleteUser: (userId: string) => Promise<void>;
  log?: (message: string) => void;
};

/** POST with the user's own access token; deletes that user's photos and account, nothing else. */
export function createDeleteHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: 'Sign in first.' }, 401);

    const userId = await deps.userIdFromToken(token).catch(() => null);
    if (!userId) return json({ error: 'Sign in first.' }, 401);

    try {
      // Photos first: if the account went first, a failure here would leave files nobody owns.
      await deps.deleteUserFiles(userId);
      await deps.deleteUser(userId);
    } catch (e) {
      deps.log?.(`Could not delete ${userId}: ${e}`);
      return json({ error: 'Could not delete the account. Try again.' }, 500);
    }
    return json({ deleted: true });
  };
}
