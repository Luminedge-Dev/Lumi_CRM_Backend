import fs from 'fs';
import path from 'path';
import { evaluateScriptSafety, isLocalMongoUri, assertScriptSafe, CONFIRM_PRODUCTION_FLAG } from '../../scripts/scriptGuard';

// Pure/mocked tests only: nothing here connects to any database and no script is executed.

const REMOTE = 'mongodb+srv://user:pw@cluster0.example.mongodb.net/crm';
const REMOTE_PLAIN = 'mongodb://user:pw@db.example.com:27017/crm';
const LOCAL = 'mongodb://127.0.0.1:27017/crm_test';

describe('isLocalMongoUri', () => {
  it.each([
    LOCAL,
    'mongodb://localhost:27017/x',
    'mongodb://u:p@localhost/x',
    'mongodb://127.0.0.1:1,localhost:2/x',
    'mongodb://[::1]:27017/x',
    'mongodb://[::1]/x',
  ])('local: %s', (uri) => {
    expect(isLocalMongoUri(uri)).toBe(true);
  });
  it.each([
    REMOTE,
    REMOTE_PLAIN,
    'mongodb://localhost,db.example.com/x',
    'mongodb://0.0.0.0:27017/x',
    'mongodb://[::]:27017/x',
    'mongodb://192.168.1.10:27017/x',
    'mongodb://10.0.0.5:27017/x',
    '',
    undefined,
    'not a uri',
  ])('NOT local: %s', (uri) => {
    expect(isLocalMongoUri(uri as any)).toBe(false);
  });
});

describe('evaluateScriptSafety', () => {
  const base = { nodeEnv: 'development', argv: ['node', 'script.ts'], writes: true };

  it('refuses a writing run against a remote database', () => {
    expect(evaluateScriptSafety({ ...base, uri: REMOTE }).allowed).toBe(false);
    expect(evaluateScriptSafety({ ...base, uri: REMOTE_PLAIN }).allowed).toBe(false);
  });
  it('refuses when MONGODB_URI is unset or unparseable', () => {
    expect(evaluateScriptSafety({ ...base, uri: undefined }).allowed).toBe(false);
    expect(evaluateScriptSafety({ ...base, uri: 'garbage' }).allowed).toBe(false);
  });
  it('refuses NODE_ENV=production even for a local URI', () => {
    expect(evaluateScriptSafety({ ...base, uri: LOCAL, nodeEnv: 'production' }).allowed).toBe(false);
  });
  it('allows a writing run against a local database in a non-production env', () => {
    expect(evaluateScriptSafety({ ...base, uri: LOCAL }).allowed).toBe(true);
  });
  it('allows a remote write outside production only with the explicit confirmation flag', () => {
    const argv = [...base.argv, CONFIRM_PRODUCTION_FLAG];
    expect(evaluateScriptSafety({ ...base, uri: REMOTE }).allowed).toBe(false);
    expect(evaluateScriptSafety({ ...base, uri: REMOTE, argv }).allowed).toBe(true);
    expect(evaluateScriptSafety({ ...base, uri: REMOTE, nodeEnv: undefined, argv }).allowed).toBe(true);
  });
  it('refuses NODE_ENV=production even with the confirmation flag, for any URI', () => {
    const argv = [...base.argv, CONFIRM_PRODUCTION_FLAG];
    for (const uri of [REMOTE, REMOTE_PLAIN, LOCAL, undefined]) {
      const result = evaluateScriptSafety({ ...base, uri, nodeEnv: 'production', argv });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('NODE_ENV is production');
      expect(result.reason).toContain('cannot override');
    }
  });
  it('always allows a read-only dry run', () => {
    expect(evaluateScriptSafety({ ...base, uri: REMOTE, writes: false }).allowed).toBe(true);
    expect(evaluateScriptSafety({ ...base, uri: REMOTE, nodeEnv: 'production', writes: false }).allowed).toBe(true);
  });
  it('does not treat 0.0.0.0 as a safe local target', () => {
    expect(evaluateScriptSafety({ ...base, uri: 'mongodb://0.0.0.0:27017/x' }).allowed).toBe(false);
  });
});

describe('assertScriptSafe', () => {
  const realArgv = process.argv;
  afterEach(() => {
    process.argv = realArgv;
  });

  it('exits with code 1, logs a message, and never prints the connection string', () => {
    process.argv = ['node', 'script.ts'];
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    assertScriptSafe('demo', { uri: REMOTE, writes: true });
    expect(exit).toHaveBeenCalledWith(1);
    const printed = err.mock.calls.flat().join(' ');
    expect(printed).toContain('REFUSED');
    expect(printed).not.toContain('cluster0');
    expect(printed).not.toContain('pw@');
  });

  it('does not suggest the flag as a way around a production environment', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'script.ts', CONFIRM_PRODUCTION_FLAG];
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      assertScriptSafe('demo', { uri: LOCAL, writes: true });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
    expect(exit).toHaveBeenCalledWith(1);
    const printed = err.mock.calls.flat().join(' ');
    expect(printed).toContain('NODE_ENV is production');
    expect(printed).toContain('only when NODE_ENV is not production');
  });

  it('does not exit for a dry run', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    assertScriptSafe('demo', { uri: REMOTE, writes: false });
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('every script that connects to MongoDB is guarded', () => {
  const dir = path.join(__dirname, '..', '..', 'scripts');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  it('finds the scripts', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s calls assertScriptSafe before mongoose.connect', (file) => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!src.includes('mongoose.connect')) return;
    const guard = src.indexOf('assertScriptSafe(');
    const connect = src.indexOf('mongoose.connect');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(connect);
  });
});
