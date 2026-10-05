// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRoute } from '../src/useRoute';

const at = (path: string) => window.history.replaceState(null, '', path);

afterEach(() => at('/'));

describe('useRoute', () => {
  it('starts on the section the URL names', () => {
    at('/delivery');
    expect(renderHook(() => useRoute()).result.current.active).toBe('delivery');
  });

  it('replaces / with the default section instead of adding a history entry', () => {
    at('/');
    const before = window.history.length;
    const { result } = renderHook(() => useRoute());
    expect(result.current.active).toBe('people');
    expect(window.location.pathname).toBe('/people');
    expect(window.history.length).toBe(before);
  });

  it('treats an unknown path the same way', () => {
    at('/nonsense');
    const { result } = renderHook(() => useRoute());
    expect(result.current.active).toBe('people');
    expect(window.location.pathname).toBe('/people');
  });

  it('keeps the rest of a section path as it is', () => {
    at('/delivery/projects/prj-2');
    renderHook(() => useRoute());
    expect(window.location.pathname).toBe('/delivery/projects/prj-2');
  });

  it('pushes a history entry when navigating to another section', () => {
    at('/people');
    const before = window.history.length;
    const { result } = renderHook(() => useRoute());
    act(() => result.current.navigate('delivery'));
    expect(result.current.active).toBe('delivery');
    expect(window.location.pathname).toBe('/delivery');
    expect(window.history.length).toBe(before + 1);
  });

  it('does nothing when navigating to the section already shown', () => {
    at('/people');
    const before = window.history.length;
    const { result } = renderHook(() => useRoute());
    act(() => result.current.navigate('people'));
    expect(window.history.length).toBe(before);
  });

  it('follows the browser Back and Forward buttons', () => {
    at('/people');
    const { result } = renderHook(() => useRoute());
    act(() => result.current.navigate('delivery'));
    act(() => {
      window.history.replaceState(null, '', '/people');
      window.dispatchEvent(new PopStateEvent('popstate')); // what Back does
    });
    expect(result.current.active).toBe('people');
    act(() => {
      window.history.replaceState(null, '', '/delivery');
      window.dispatchEvent(new PopStateEvent('popstate')); // what Forward does
    });
    expect(result.current.active).toBe('delivery');
  });

  it('falls back to the default section if Back lands on a path that is no section', () => {
    at('/delivery');
    const { result } = renderHook(() => useRoute());
    act(() => {
      window.history.replaceState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.active).toBe('people');
    expect(window.location.pathname).toBe('/people');
  });

  it('stops listening when unmounted', () => {
    at('/people');
    const { result, unmount } = renderHook(() => useRoute());
    unmount();
    window.history.replaceState(null, '', '/delivery');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(result.current.active).toBe('people');
  });
});
