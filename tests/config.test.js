const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

describe('Configuration loader (src/config.js)', () => {
  // Always restore to project root, regardless of tests changing cwd
  const originalCwd = path.resolve(__dirname, '..');
  let tempDir;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  });
  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    // Clean up and clear cached module so loadConfig re-reads files
    delete require.cache[require.resolve('../src/config')];
    // Remove any leftover config files
    ['config.yaml', 'config.yml', 'config.json'].forEach(f => {
      const fp = path.join(tempDir, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
  });

  test('returns {} when no config file present', () => {
    process.chdir(tempDir);
    const { loadConfig } = require('../src/config');
    expect(loadConfig()).toEqual({});
  });

  test('loads config.yaml correctly', () => {
    process.chdir(tempDir);
    const data = { foo: 'bar', num: 42 };
    fs.writeFileSync(path.join(tempDir, 'config.yaml'), yaml.dump(data), 'utf8');
    const { loadConfig } = require('../src/config');
    expect(loadConfig()).toEqual(data);
  });

  test('loads config.json when no YAML', () => {
    process.chdir(tempDir);
    const data = { baz: true };
    fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify(data), 'utf8');
    const { loadConfig } = require('../src/config');
    expect(loadConfig()).toEqual(data);
  });

  test('prefers YAML over JSON', () => {
    process.chdir(tempDir);
    fs.writeFileSync(path.join(tempDir, 'config.yaml'), yaml.dump({ val: 'yaml' }), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'config.json'), JSON.stringify({ val: 'json' }), 'utf8');
    const { loadConfig } = require('../src/config');
    expect(loadConfig().val).toBe('yaml');
  });

  test('throws on malformed YAML', () => {
    process.chdir(tempDir);
    fs.writeFileSync(path.join(tempDir, 'config.yaml'), 'foo: : bad', 'utf8');
    const { loadConfig } = require('../src/config');
    expect(() => loadConfig()).toThrow(/Failed to parse configuration file config.yaml/);
  });
});