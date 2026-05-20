#!/usr/bin/env node
import { dispatch } from './cli.js';

dispatch(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
