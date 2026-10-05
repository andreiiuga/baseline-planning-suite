import { describe, expect, it } from 'vitest';
import { isPlainLeftClick, pathFor, sectionForPath, SECTIONS, titleFor } from '../src/navigation';

describe('sectionForPath', () => {
  it.each([
    ['/people', 'people'],
    ['/delivery', 'delivery'],
    ['/people/', 'people'],
    ['//delivery', 'delivery'],
    ['/people/employees/emp-001', 'people'], // anything below a section belongs to that remote
    ['/delivery/anything/else', 'delivery'],
  ])('%s belongs to %s', (path, expected) => {
    expect(sectionForPath(path)).toBe(expected);
  });

  it.each(['/', '', '/unknown', '/peoples', '/People', '/delivery2', '/x/people'])(
    '%j belongs to no section',
    (path) => {
      expect(sectionForPath(path)).toBeNull();
    },
  );

  it('round-trips with pathFor for every section', () => {
    for (const { name } of SECTIONS) expect(sectionForPath(pathFor(name))).toBe(name);
  });
});

describe('titleFor', () => {
  it('names the section after the app', () => {
    expect(titleFor('people')).toBe('People · Baseline');
    expect(titleFor('delivery')).toBe('Delivery · Baseline');
  });
});

describe('isPlainLeftClick', () => {
  const click = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };

  it('claims a plain left click', () => {
    expect(isPlainLeftClick(click)).toBe(true);
  });

  it.each([
    ['middle click', { button: 1 }],
    ['right click', { button: 2 }],
    ['cmd click', { metaKey: true }],
    ['ctrl click', { ctrlKey: true }],
    ['shift click', { shiftKey: true }],
    ['alt click', { altKey: true }],
    ['an already handled click', { defaultPrevented: true }],
  ])('leaves a %s to the browser', (_label, change) => {
    expect(isPlainLeftClick({ ...click, ...change })).toBe(false);
  });
});
