import { CliLoginError, type LoginFlowDeps, loginFlow as defaultLoginFlow } from '../cli-login.js';
import { saveCliToken as defaultSaveCliToken } from '../cli-token.js';
import { messages } from '../messages.js';

export type LoginDeps = {
  loginFlow: (deps?: LoginFlowDeps) => Promise<string>;
  saveCliToken: (token: string) => void;
  log: (m: string) => void;
};

function buildDefaults(): LoginDeps {
  return {
    loginFlow: (deps) => defaultLoginFlow(deps),
    saveCliToken: (token) => defaultSaveCliToken(token),
    log: (m) => console.log(m),
  };
}

function mapLoginError(err: unknown): string {
  if (err instanceof CliLoginError && err.kind === 'timeout') return messages.loginTimedOut;
  return messages.loginFailed;
}

/**
 * `proto login` — sign in through the browser and store the account token so
 * `proto share` can attribute shares. Returns the token, or null if sign-in
 * didn't complete (a friendly reason is logged either way).
 */
export async function runLogin(injected?: Partial<LoginDeps>): Promise<string | null> {
  const deps: LoginDeps = { ...buildDefaults(), ...injected };

  deps.log(messages.loginOpening);
  let token: string;
  try {
    token = await deps.loginFlow();
  } catch (err) {
    deps.log(mapLoginError(err));
    return null;
  }

  deps.saveCliToken(token);
  deps.log(messages.loginSuccess);
  return token;
}
