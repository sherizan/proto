if (!String(process.env.npm_config_user_agent).includes('pnpm')) {
  console.error(
    'Publish with `pnpm publish` — `npm publish` ships the raw workspace: protocol and breaks installs.',
  );
  process.exit(1);
}
