import app from '../../app';

// Guards the refactor: every route (method + path + middleware count) must stay identical.
// Express 4 stores mount paths as regexps, so recover the prefix from layer.regexp.
function mountPath(layer: any): string {
  const src: string = layer.regexp.toString();
  if (src.includes('^\\/?(?=\\/|$)')) return '';
  const match = src.match(/^\/\^((?:\\\/[^\\?()]+)+)/);
  return match ? match[1].replace(/\\\//g, '/') : `<${src}>`;
}

function collect(stack: any[], prefix = ''): string[] {
  const out: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).sort().join(',');
      out.push(`${methods} ${prefix}${layer.route.path} [mw:${layer.route.stack.length}]`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      out.push(...collect(layer.handle.stack, prefix + mountPath(layer)));
    }
  }
  return out;
}

describe('route table', () => {
  it('matches the recorded snapshot', () => {
    const routes = collect((app as any)._router.stack).sort();
    expect(routes.length).toBeGreaterThan(100);
    expect(routes).toMatchSnapshot();
  });
});
