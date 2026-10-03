import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Component tests opt in to jsdom with `// @vitest-environment jsdom`; this unmounts between tests.
afterEach(() => cleanup());
