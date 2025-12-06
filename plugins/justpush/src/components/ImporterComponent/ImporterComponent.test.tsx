
import { screen } from '@testing-library/react';
import { ImporterComponent } from './ImporterComponent';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { fetchApiRef } from '@backstage/core-plugin-api';

describe('ImporterComponent', () => {
  it('should render', async () => {
    const fetchApi = {
      fetch: jest.fn(),
    };

    await renderInTestApp(
      <TestApiProvider apis={[[fetchApiRef, fetchApi]]}>
        <ImporterComponent />
      </TestApiProvider>,
    );
    expect(screen.getByText('API Importer')).toBeInTheDocument();
  });
});
