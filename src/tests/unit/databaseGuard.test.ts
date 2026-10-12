import mongoose from 'mongoose';
import { config } from '../../config';
import connectDB, { evaluateDatabaseTarget, RuntimeEvidence } from '../../config/database';

// Startup database guard. Pure-function tests, a mocked dotenv for the .env-origin detection, and
// connectDB with mongoose.connect mocked: nothing here reads a real .env file or reaches a database
// (setupDb.ts provides the in-memory one the suite runs against).

const withEnv = async (vars: Record<string, string | undefined>, fn: () => Promise<void> | void) => {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

const REMOTE_HOST = 'cluster0.example.mongodb.net';
const SRV = `mongodb+srv://user:secret-pw@${REMOTE_HOST}/crm`;

const LOCAL_URIS = [
  'mongodb://localhost:27017/crm_dev',
  'mongodb://127.0.0.1:27017/crm_dev',
  'mongodb://[::1]:27017/crm_dev',
  'mongodb://user:pw@localhost/crm_dev',
  'mongodb://localhost:27017,127.0.0.1:27018/crm_dev?replicaSet=rs0',
  'mongodb://LOCALHOST/crm_dev',
];

const REMOTE_URIS = [
  'mongodb://user:pw@db.example.com:27017/crm',
  'mongodb://localhost:27017,db.example.com:27017/crm',
  'mongodb://192.168.1.10:27017/crm',
  'mongodb://10.0.0.5:27017/crm',
  'mongodb://0.0.0.0:27017/crm',
];

const SRV_URIS = [SRV, 'mongodb+srv://localhost/crm', 'MONGODB+SRV://user:pw@cluster.example.net/crm'];

const MISSING = [undefined, '', '   '];

const MALFORMED = ['not-a-uri', 'http://localhost:27017/crm', 'mongodb://', 'localhost:27017/crm', 'mongodb:/localhost/crm'];

// Runtime evidence fixtures.
const LAPTOP: RuntimeEvidence = { platform: 'win32', markers: [], envFileVars: [] };
const VERCEL: RuntimeEvidence = { platform: 'linux', markers: ['VERCEL', 'VERCEL_ENV'], envFileVars: [] };
const RENDER: RuntimeEvidence = { platform: 'linux', markers: ['RENDER'], envFileVars: [] };
const LAMBDA_ONLY: RuntimeEvidence = { platform: 'linux', markers: ['AWS_LAMBDA_FUNCTION_NAME'], envFileVars: [] };

describe('evaluateDatabaseTarget outside production', () => {
  it.each(LOCAL_URIS)('allows local: %s', (uri) => {
    expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP })).toEqual({ allowed: true, reason: 'local database' });
  });

  it.each(REMOTE_URIS)('refuses remote: %s', (uri) => {
    expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP }).allowed).toBe(false);
  });

  it.each(SRV_URIS)('refuses mongodb+srv (always a remote cluster): %s', (uri) => {
    expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP }).allowed).toBe(false);
  });

  it.each(MISSING)('refuses a missing URI: %p', (uri) => {
    const result = evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not set/);
  });

  it.each(MALFORMED)('refuses a malformed URI: %s', (uri) => {
    expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP }).allowed).toBe(false);
  });

  it.each([...REMOTE_URIS, ...SRV_URIS])('allows remote with ALLOW_REMOTE_DATABASE: %s', (uri) => {
    expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP, allowRemoteDev: true }).allowed).toBe(true);
  });

  it('ALLOW_REMOTE_DATABASE does not allow a missing or malformed URI', () => {
    for (const uri of [...MISSING, ...MALFORMED]) {
      expect(evaluateDatabaseTarget({ uri, isProduction: false, runtime: LAPTOP, allowRemoteDev: true }).allowed).toBe(false);
    }
  });

  it('a hosting marker does not unlock a remote database outside production', () => {
    expect(evaluateDatabaseTarget({ uri: SRV, isProduction: false, runtime: VERCEL }).allowed).toBe(false);
  });

  it('never puts the URI, host or credentials in the reason', () => {
    const { reason } = evaluateDatabaseTarget({ uri: SRV, isProduction: false, runtime: LAPTOP });
    expect(reason).not.toContain(REMOTE_HOST);
    expect(reason).not.toContain('secret-pw');
  });
});

describe('evaluateDatabaseTarget in production mode: a local process is refused', () => {
  it('refuses the reported local setup: NODE_ENV and a remote URI from backend/.env on Windows', () => {
    const result = evaluateDatabaseTarget({
      uri: SRV,
      isProduction: true,
      runtime: { platform: 'win32', markers: [], envFileVars: ['NODE_ENV', 'MONGODB_URI'] },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/local \.env file/);
  });

  it.each([['NODE_ENV'], ['MONGODB_URI'], ['NODE_ENV', 'MONGODB_URI']])(
    'refuses when %s came from a local .env file, even on Linux with a hosting marker',
    (...envFileVars) => {
      const result = evaluateDatabaseTarget({ uri: SRV, isProduction: true, runtime: { ...VERCEL, envFileVars } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/local \.env file/);
    },
  );

  it.each(['win32', 'darwin', 'freebsd'])('refuses on %s, even with a hosting marker', (platform) => {
    const result = evaluateDatabaseTarget({ uri: SRV, isProduction: true, runtime: { ...RENDER, platform } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(platform);
  });

  it('refuses on Linux when no Vercel or Render runtime marker is present (WSL, Docker, a VM)', () => {
    const result = evaluateDatabaseTarget({ uri: SRV, isProduction: true, runtime: { platform: 'linux', markers: [], envFileVars: [] } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/no Vercel or Render runtime/);
  });

  it('refuses even a local URI in production mode from a laptop (fails closed on the runtime, not the URI)', () => {
    expect(evaluateDatabaseTarget({ uri: 'mongodb://localhost/crm', isProduction: true, runtime: LAPTOP }).allowed).toBe(false);
  });

  it('never puts the URI, host or credentials in the reason', () => {
    const { reason } = evaluateDatabaseTarget({ uri: SRV, isProduction: true, runtime: { ...LAPTOP, envFileVars: ['MONGODB_URI'] } });
    expect(reason).not.toContain(REMOTE_HOST);
    expect(reason).not.toContain('secret-pw');
  });
});

describe('evaluateDatabaseTarget in production mode: genuine deployments keep working', () => {
  it.each([
    ['Vercel', VERCEL],
    ['Render', RENDER],
    ['Vercel with system variables not exposed (Lambda runtime marker only)', LAMBDA_ONLY],
  ])('allows %s', (_name, runtime) => {
    const result = evaluateDatabaseTarget({ uri: SRV, isProduction: true, runtime });
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/^production deployment \(/);
  });
});

describe('config.database.configuredUri', () => {
  it('is the raw value with no local fallback', async () => {
    await withEnv({ MONGODB_URI: undefined }, () => expect(config.database.configuredUri).toBeUndefined());
    await withEnv({ MONGODB_URI: '' }, () => expect(config.database.configuredUri).toBeUndefined());
    await withEnv({ MONGODB_URI: 'mongodb://localhost/x' }, () => expect(config.database.configuredUri).toBe('mongodb://localhost/x'));
  });
});

describe('config.deployment evidence (dotenv mocked: no real .env file is read)', () => {
  const MARKER_NAMES = ['RENDER', 'VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_URL', 'AWS_LAMBDA_FUNCTION_NAME'];
  const cleared = Object.fromEntries([...MARKER_NAMES, 'NODE_ENV', 'MONGODB_URI'].map((n) => [n, undefined]));

  /** Loads a fresh config/env with a fake .env file: like dotenv, it never overrides a variable already set. */
  const loadWithEnvFile = (fileVars: Record<string, string>) => {
    let deployment!: typeof config.deployment;
    jest.isolateModules(() => {
      jest.doMock('dotenv', () => ({
        config: () => {
          for (const [k, v] of Object.entries(fileVars)) if (process.env[k] === undefined) process.env[k] = v;
          return { parsed: fileVars };
        },
      }));
      deployment = require('../../config/env').config.deployment;
    });
    return deployment;
  };

  afterAll(() => jest.dontMock('dotenv'));

  it('detects NODE_ENV and MONGODB_URI supplied by a .env file and ignores hosting markers written there', async () => {
    await withEnv(cleared, () => {
      const d = loadWithEnvFile({ NODE_ENV: 'production', MONGODB_URI: SRV, VERCEL: '1', RENDER: 'true' });
      expect(d.envFileVars).toEqual(['NODE_ENV', 'MONGODB_URI']);
      expect(d.markers).toEqual([]);
    });
  });

  it('treats values set by the real environment as platform-provided, even when a .env file names them too', async () => {
    await withEnv({ ...cleared, NODE_ENV: 'production', MONGODB_URI: SRV, RENDER: 'true' }, () => {
      const d = loadWithEnvFile({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://localhost/x' });
      expect(d.envFileVars).toEqual([]);
      expect(d.markers).toEqual(['RENDER']);
    });
  });

  it('reports every recognised hosting marker from the real environment and ignores non-matching values', async () => {
    await withEnv(
      { ...cleared, VERCEL: '1', VERCEL_ENV: 'production', VERCEL_REGION: 'iad1', VERCEL_URL: 'x.vercel.app', AWS_LAMBDA_FUNCTION_NAME: 'fn', RENDER: 'false' },
      () => {
        const d = loadWithEnvFile({});
        expect(d.markers).toEqual(['VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_URL', 'AWS_LAMBDA_FUNCTION_NAME']);
      },
    );
    await withEnv({ ...cleared, VERCEL: '0', VERCEL_ENV: '  ' }, () => expect(loadWithEnvFile({}).markers).toEqual([]));
  });

  it('a variable overridden after loading no longer counts as coming from the file', async () => {
    await withEnv(cleared, () => {
      const d = loadWithEnvFile({ NODE_ENV: 'production' });
      process.env.NODE_ENV = 'development';
      expect(d.envFileVars).toEqual([]);
    });
  });

  it('reports the OS platform', () => {
    expect(config.deployment.platform).toBe(process.platform);
  });
});

describe('connectDB startup guard', () => {
  // Every connectDB call below has mongoose.connect mocked, so even a broken guard could not connect.
  let connectSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    connectSpy = jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  /** Pins config.deployment so results do not depend on the machine running the tests. */
  const runtimeIs = ({ platform, markers, envFileVars }: RuntimeEvidence) => {
    // A developer's backend/.env may opt in to a remote database; these tests cover the default.
    jest.spyOn(config.database, 'allowRemoteInDev', 'get').mockReturnValue(false);
    jest.spyOn(config.deployment, 'platform', 'get').mockReturnValue(platform);
    jest.spyOn(config.deployment, 'markers', 'get').mockReturnValue(markers);
    jest.spyOn(config.deployment, 'envFileVars', 'get').mockReturnValue(envFileVars);
  };

  it.each(['development', 'test', undefined])('refuses a remote URI before connecting (NODE_ENV=%p)', async (nodeEnv) => {
    runtimeIs(LAPTOP);
    await withEnv({ NODE_ENV: nodeEnv, MONGODB_URI: SRV }, async () => {
      await expect(connectDB()).rejects.toThrow('Refusing to connect to MongoDB');
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it.each([...MISSING, ...MALFORMED, ...REMOTE_URIS])('refuses %p in development before connecting', async (uri) => {
    runtimeIs(LAPTOP);
    await withEnv({ NODE_ENV: 'development', MONGODB_URI: uri }, async () => {
      await expect(connectDB()).rejects.toThrow('Refusing to connect to MongoDB');
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['the reported setup (Windows, NODE_ENV and URI from .env)', { platform: 'win32', markers: [], envFileVars: ['NODE_ENV', 'MONGODB_URI'] }],
    ['Windows with NODE_ENV=production set in the shell', { platform: 'win32', markers: [], envFileVars: [] }],
    ['macOS with a hosting marker', { platform: 'darwin', markers: ['VERCEL'], envFileVars: [] }],
    ['Linux without any hosting marker', { platform: 'linux', markers: [], envFileVars: [] }],
    ['Linux with a marker but NODE_ENV from .env', { platform: 'linux', markers: ['RENDER'], envFileVars: ['NODE_ENV'] }],
  ] as Array<[string, RuntimeEvidence]>)('refuses a local process in production mode: %s', async (_name, runtime) => {
    runtimeIs(runtime);
    await withEnv({ NODE_ENV: 'production', MONGODB_URI: SRV }, async () => {
      await expect(connectDB()).rejects.toThrow('Refusing to connect to MongoDB');
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('does not log the refused URI, host or credentials', async () => {
    runtimeIs({ platform: 'win32', markers: [], envFileVars: ['NODE_ENV', 'MONGODB_URI'] });
    for (const nodeEnv of ['development', 'production']) {
      await withEnv({ NODE_ENV: nodeEnv, MONGODB_URI: SRV }, async () => {
        await expect(connectDB()).rejects.toThrow();
      });
    }
    const logged = errorSpy.mock.calls.flat().map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    expect(logged).toContain('Refusing to connect to MongoDB');
    expect(logged).not.toContain(REMOTE_HOST);
    expect(logged).not.toContain('secret-pw');
  });

  it('connects to a local URI outside production', async () => {
    runtimeIs(LAPTOP);
    await withEnv({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/crm_dev' }, async () => {
      await connectDB();
    });
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy.mock.calls[0][0]).toBe('mongodb://127.0.0.1:27017/crm_dev');
  });

  it.each([
    ['Vercel', VERCEL],
    ['Render', RENDER],
    ['Vercel (Lambda marker only)', LAMBDA_ONLY],
  ] as Array<[string, RuntimeEvidence]>)('a genuine %s deployment connects to its configured URI as before', async (_name, runtime) => {
    runtimeIs(runtime);
    await withEnv({ NODE_ENV: 'production', MONGODB_URI: SRV }, async () => {
      await connectDB();
    });
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy.mock.calls[0][0]).toBe(SRV);
  });

  it('a genuine deployment with no MONGODB_URI still fails with the existing error', async () => {
    runtimeIs(RENDER);
    await withEnv({ NODE_ENV: 'production', MONGODB_URI: undefined }, async () => {
      await expect(connectDB()).rejects.toThrow('MONGODB_URI environment variable is not set');
    });
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
