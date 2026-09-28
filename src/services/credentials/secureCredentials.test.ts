import {
  isSensitiveConfigKey,
  maskSecret,
  splitConfig,
} from './secureCredentials';

describe('isSensitiveConfigKey', () => {
  it('flags credential-bearing keys', () => {
    expect(isSensitiveConfigKey('apiKey')).toBe(true);
    expect(isSensitiveConfigKey('api_key')).toBe(true);
    expect(isSensitiveConfigKey('secret')).toBe(true);
    expect(isSensitiveConfigKey('webhookSecret')).toBe(true);
    expect(isSensitiveConfigKey('accessToken')).toBe(true);
    expect(isSensitiveConfigKey('password')).toBe(true);
  });

  it('does not flag ordinary configuration', () => {
    expect(isSensitiveConfigKey('name')).toBe(false);
    expect(isSensitiveConfigKey('agentId')).toBe(false);
    expect(isSensitiveConfigKey('webhookUrl')).toBe(false);
    expect(isSensitiveConfigKey('assistantId')).toBe(false);
  });
});

describe('splitConfig', () => {
  it('moves secrets out of the persisted configuration', () => {
    const { publicConfig, secrets } = splitConfig({
      name: 'Support Agent',
      agentId: 'agent_123',
      apiKey: 'sk-live-abcdefghijklmnop',
      secret: 'whsec_zzzz',
    });

    expect(publicConfig.name).toBe('Support Agent');
    expect(publicConfig.agentId).toBe('agent_123');
    expect(publicConfig.apiKey).toBe('********');
    expect(publicConfig.secret).toBe('********');

    expect(secrets).toEqual({
      apiKey: 'sk-live-abcdefghijklmnop',
      secret: 'whsec_zzzz',
    });
  });

  it('never leaks a secret value into the persisted configuration', () => {
    const { publicConfig } = splitConfig({ apiKey: 'sk-live-abcdefghijklmnop' });
    expect(JSON.stringify(publicConfig)).not.toContain('sk-live-abcdefghijklmnop');
  });

  it('records an unset credential without inventing a value', () => {
    const { publicConfig, secrets } = splitConfig({ apiKey: '' });

    expect(publicConfig.apiKey).toBe('');
    expect(secrets).toEqual({});
  });
});

describe('maskSecret', () => {
  it('shows only the last four characters', () => {
    expect(maskSecret('sk-live-abcdefghijklmnop')).toBe('••••••••mnop');
  });

  it('does not reveal short values', () => {
    expect(maskSecret('abcd')).toBe('Set (secured)');
    expect(maskSecret('abc')).toBe('Set (secured)');
  });

  it('labels the already-redacted placeholder', () => {
    expect(maskSecret('********')).toBe('Set (secured)');
  });

  it('reports an unset credential', () => {
    expect(maskSecret('')).toBe('Not set');
    expect(maskSecret(undefined)).toBe('Not set');
    expect(maskSecret(null)).toBe('Not set');
  });
});
