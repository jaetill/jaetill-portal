import { appsForUser, APPS } from '../src/js/apps.js';

describe('appsForUser', () => {
  test('null claims returns only groups-empty apps', () => {
    const result = appsForUser(null);
    expect(result.every((app) => app.groups.length === 0)).toBe(true);
    expect(result.some((app) => app.id === 'splendor')).toBe(true);
    expect(result.some((app) => app.id === 'meal-planner')).toBe(false);
    expect(result.some((app) => app.id === 'game-night')).toBe(false);
  });

  test('undefined claims returns only groups-empty apps', () => {
    const result = appsForUser(undefined);
    expect(result.every((app) => app.groups.length === 0)).toBe(true);
    expect(result.some((app) => app.id === 'splendor')).toBe(true);
  });

  test('user with no groups sees only groups-empty apps', () => {
    const result = appsForUser({ 'cognito:groups': [] });
    expect(result.every((app) => app.groups.length === 0)).toBe(true);
    expect(result.some((app) => app.id === 'splendor')).toBe(true);
    expect(result.some((app) => app.id === 'meal-planner')).toBe(false);
  });

  test('user in meal-planner-users sees meal-planner and groups-empty apps', () => {
    const result = appsForUser({ 'cognito:groups': ['meal-planner-users'] });
    expect(result.some((app) => app.id === 'meal-planner')).toBe(true);
    expect(result.some((app) => app.id === 'splendor')).toBe(true);
    expect(result.some((app) => app.id === 'game-night')).toBe(false);
    expect(result.some((app) => app.id === 'carto')).toBe(false);
  });

  test('hidden app is never returned regardless of groups', () => {
    const hiddenApp = {
      id: 'hidden-test',
      name: 'Hidden',
      url: '#',
      icon: '',
      accent: '',
      groups: [],
      hidden: true,
    };
    APPS.push(hiddenApp);
    try {
      const withNoGroups = appsForUser({ 'cognito:groups': [] });
      const withGroups = appsForUser({ 'cognito:groups': ['meal-planner-users'] });
      expect(withNoGroups.some((app) => app.id === 'hidden-test')).toBe(false);
      expect(withGroups.some((app) => app.id === 'hidden-test')).toBe(false);
    } finally {
      APPS.pop();
    }
  });

  test('user in multiple groups sees all their authorized apps plus groups-empty apps', () => {
    const result = appsForUser({ 'cognito:groups': ['meal-planner-users', 'game-night-users'] });
    expect(result.some((app) => app.id === 'meal-planner')).toBe(true);
    expect(result.some((app) => app.id === 'game-night')).toBe(true);
    expect(result.some((app) => app.id === 'splendor')).toBe(true);
    expect(result.some((app) => app.id === 'carto')).toBe(false);
  });

  test('splendor (groups:[]) is visible to every authenticated user', () => {
    const withGroups = appsForUser({
      'cognito:groups': ['meal-planner-users', 'game-night-users'],
    });
    const withNoGroups = appsForUser({ 'cognito:groups': [] });
    const withNull = appsForUser(null);
    expect(withGroups.some((app) => app.id === 'splendor')).toBe(true);
    expect(withNoGroups.some((app) => app.id === 'splendor')).toBe(true);
    expect(withNull.some((app) => app.id === 'splendor')).toBe(true);
  });
});
