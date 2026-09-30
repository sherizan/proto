import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { createServer } from './server.js';

// What an agent actually sees: the tool list over a real MCP connection.
async function connect() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer('/nonexistent').connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}

test('lists the six prototo tools', async () => {
  const { tools } = await (await connect()).listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    'compile_check',
    'get_metro_errors',
    'get_simulator_screenshot',
    'reload_app',
    'scroll_simulator',
    'tap_simulator',
  ]);
  expect(tools.every((t) => (t.description ?? '').length > 20)).toBe(true);
});

test('tool inputs keep their shapes and bounds', async () => {
  const { tools } = await (await connect()).listTools();
  const input = (name: string) => tools.find((t) => t.name === name)?.inputSchema;

  expect(input('tap_simulator')).toMatchObject({
    type: 'object',
    required: ['x', 'y'],
    properties: {
      x: { type: 'number', minimum: 0, maximum: 1 },
      y: { type: 'number', minimum: 0, maximum: 1 },
    },
  });
  expect(input('scroll_simulator')).toMatchObject({
    required: ['direction'],
    properties: {
      direction: { enum: ['up', 'down', 'left', 'right'] },
      amount: { minimum: 0.05, maximum: 0.8 },
    },
  });
  expect(input('compile_check')?.required ?? []).toEqual([]);
  expect(input('compile_check')?.properties).toHaveProperty('screenName');
  for (const name of ['get_simulator_screenshot', 'reload_app', 'get_metro_errors']) {
    expect(Object.keys(input(name)?.properties ?? {})).toEqual([]);
  }
});

test('out-of-range input is refused before any tool runs', async () => {
  const res = await (await connect()).callTool({
    name: 'tap_simulator',
    arguments: { x: 2, y: 0.5 },
  });
  expect(res.isError).toBe(true);
});
