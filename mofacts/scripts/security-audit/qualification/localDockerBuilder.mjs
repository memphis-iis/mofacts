import { isDeepStrictEqual } from 'node:util';

function invalidBuilder() { throw new Error('Local Docker builder binding failed'); }

export function localEndpoint(context, builder) {
  if (!Array.isArray(context) || context.length !== 1 || context[0].Name !== builder) invalidBuilder();
  const endpoint = context[0].Endpoints?.docker;
  if (!endpoint || typeof endpoint.Host !== 'string' || endpoint.SkipTLSVerify
    || !(/^(?:npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+|unix:\/\/\/[A-Za-z0-9_./ -]+)$/.test(endpoint.Host))) invalidBuilder();
  return endpoint.Host;
}

export function assertContextBuilder(text, builder) {
  const values = (key) => [...text.matchAll(new RegExp(`^${key}:\\s+([^\\r\\n]+)`, 'gm'))].map((match) => match[1].trim());
  if (!isDeepStrictEqual(values('Name'), [builder, builder])
    || !isDeepStrictEqual(values('Driver'), ['docker'])
    || !isDeepStrictEqual(values('Endpoint'), [builder])
    || !isDeepStrictEqual(values('Status'), ['running'])) invalidBuilder();
}

export function assertSameEngine(named, bound) {
  if (!named || typeof named.ID !== 'string' || !named.ID || named.OSType !== 'linux'
    || typeof named.Architecture !== 'string' || !named.Architecture
    || !isDeepStrictEqual(named, bound)) invalidBuilder();
}

// A context-backed docker driver is the selected engine's built-in builder.
// Bind that exact local endpoint once, then use its explicit "default" alias.
// Compose propagates DOCKER_HOST to standalone Buildx, whose CLI resolves that
// host as the default context. Passing the original context name then conflicts.
// This is one endpoint-bound route, not a retry or alternate builder selection.
export function localDockerInvoker(builder, invoke) {
  let binding;
  async function bind() {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(builder)) invalidBuilder();
    const endpoint = localEndpoint(JSON.parse(await invoke(['context', 'inspect', builder])), builder);
    assertContextBuilder(await invoke(['--context', builder, 'buildx', 'inspect', builder]), builder);
    const format = '{"ID":{{json .ID}},"OSType":{{json .OSType}},"Architecture":{{json .Architecture}}}';
    const named = JSON.parse(await invoke(['--context', builder, 'info', '--format', format]));
    const bound = JSON.parse(await invoke(['--host', endpoint, 'info', '--format', format]));
    assertSameEngine(named, bound);
    return endpoint;
  }
  return async (args, options) => {
    binding ??= bind();
    const endpoint = await binding;
    if (!['buildx', 'compose'].includes(args[0])) invalidBuilder();
    const selected = args.indexOf('--builder');
    if (selected >= 0 && args[selected + 1] !== builder) invalidBuilder();
    const bound = [...args];
    if (selected >= 0) bound[selected + 1] = 'default';
    return invoke(['--host', endpoint, ...bound], options);
  };
}
