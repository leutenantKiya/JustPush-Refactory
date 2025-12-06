import { justPushPlugin } from './plugin';

describe('api-importer', () => {
  it('should export plugin', () => {
    expect(justPushPlugin).toBeDefined();
  });
});
