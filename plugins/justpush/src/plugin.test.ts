import { apiImporterPlugin } from './plugin';

describe('api-importer', () => {
  it('should export plugin', () => {
    expect(apiImporterPlugin).toBeDefined();
  });
});
