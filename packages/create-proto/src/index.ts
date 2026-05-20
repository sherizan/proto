#!/usr/bin/env node
import { run } from './cli';

run(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
