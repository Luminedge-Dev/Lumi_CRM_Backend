import fs from 'fs';
import path from 'path';

// Enforces the layering: Route -> Middleware -> Controller -> Service -> Repository -> Model.
// Static analysis of the source files only; nothing is executed and no database is involved.

const SRC = path.join(__dirname, '..', '..');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['__tests__', 'tests', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
};

const files = walk(SRC);
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
const read = (f: string) => fs.readFileSync(f, 'utf8');

/** Runtime import specifiers (type-only imports are erased and ignored). */
const importsOf = (src: string): string[] => {
  const specs: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) if (!m[2]) specs.push(m[3]);
  return specs;
};

const inModules = (suffix: string) => files.filter((f) => rel(f).startsWith('modules/') && f.endsWith(suffix));

const offenders = (list: string[], bad: (spec: string) => boolean) =>
  list.flatMap((f) => importsOf(read(f)).filter(bad).map((s) => `${rel(f)} imports ${s}`));

const isModel = (s: string) => /(^|\/)models\//.test(s);
const isRepository = (s: string) => /\.repository$/.test(s);
const isService = (s: string) => /\.service$/.test(s);
const isController = (s: string) => /\.controller$/.test(s);

describe('architecture: layering rules', () => {
  it('finds the module files', () => {
    expect(inModules('.controller.ts').length).toBeGreaterThan(15);
    expect(inModules('.repository.ts').length).toBeGreaterThan(15);
  });

  it('controllers never touch models, mongoose or repositories', () => {
    expect(offenders(inModules('.controller.ts'), (s) => isModel(s) || s === 'mongoose' || isRepository(s))).toEqual([]);
  });

  it('routes only wire middleware and controllers (no models, repositories or services)', () => {
    expect(offenders(inModules('.routes.ts'), (s) => isModel(s) || isRepository(s) || isService(s) || s === 'mongoose')).toEqual([]);
  });

  it('services do not import Express or Socket.IO types, models, or controllers', () => {
    expect(
      offenders(inModules('.service.ts'), (s) => s === 'express' || s === 'socket.io' || isModel(s) || isController(s)),
    ).toEqual([]);
  });

  it('repositories do not import services, controllers or Express', () => {
    expect(offenders(inModules('.repository.ts'), (s) => isService(s) || isController(s) || s === 'express')).toEqual([]);
  });

  it('models do not import modules, services or controllers', () => {
    const models = files.filter((f) => rel(f).startsWith('models/'));
    expect(offenders(models, (s) => /modules\/|\.service$|\.controller$/.test(s))).toEqual([]);
  });

  it('no controller imports another controller', () => {
    expect(offenders(inModules('.controller.ts'), isController)).toEqual([]);
  });

  it('mongoose and models are only used by repositories, models, config, shared error helpers and scripts', () => {
    const allowed = (f: string) => {
      const r = rel(f);
      return (
        r.endsWith('.repository.ts') ||
        r.startsWith('models/') ||
        r.startsWith('scripts/') ||
        r === 'config/database.ts' ||
        r === 'shared/utils/mongooseErrors.ts'
      );
    };
    expect(offenders(files.filter((f) => !allowed(f)), (s) => s === 'mongoose' || isModel(s))).toEqual([]);
  });

  it('process.env is read only by the config layer and the one-off scripts', () => {
    const bad = files.filter((f) => !rel(f).startsWith('scripts/') && rel(f) !== 'config/env.ts' && /process\.env/.test(read(f)));
    expect(bad.map(rel)).toEqual([]);
  });

  it('there is exactly one SMTP transport', () => {
    const users = files.filter((f) => /createTransport\(/.test(read(f))).map(rel);
    expect(users).toEqual(['integrations/mail/mail.service.ts']);
  });

  it('there are no import cycles', () => {
    const graph = new Map<string, string[]>();
    const resolve = (from: string, spec: string): string | null => {
      const base = path.resolve(path.dirname(from), spec);
      for (const c of [`${base}.ts`, path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c;
      return null;
    };
    for (const f of files) {
      graph.set(
        f,
        importsOf(read(f))
          .filter((s) => s.startsWith('.'))
          .map((s) => resolve(f, s))
          .filter((x): x is string => !!x),
      );
    }
    const state = new Map<string, number>();
    const stack: string[] = [];
    const cycles: string[] = [];
    const visit = (n: string) => {
      state.set(n, 1);
      stack.push(n);
      for (const d of graph.get(n) ?? []) {
        if (state.get(d) === 1) cycles.push([...stack.slice(stack.indexOf(d)), d].map(rel).join(' -> '));
        else if (!state.get(d)) visit(d);
      }
      stack.pop();
      state.set(n, 2);
    };
    files.forEach((f) => !state.get(f) && visit(f));
    expect(cycles).toEqual([]);
  });
});
