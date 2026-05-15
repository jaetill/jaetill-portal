// Static app catalog. To add an app, add an entry here — no infra change required.
//
// `groups` is reserved for future Cognito-group-based access control. When non-empty,
// `appsForUser()` will only return the app if the user's claims include one of the
// listed groups. Today, every authenticated user sees every non-hidden app.
//
// `hidden: true` removes the app from the launcher entirely, regardless of groups.
// Use for apps that should not be advertised in the public launcher (e.g., carto
// is pen-testing related and intentionally not surfaced).

export const APPS = [
  {
    id:          'meal-planner',
    name:        'Meal Planner',
    description: 'Weekly meals, grocery lists, Kroger pricing.',
    url:         'https://meals.jaetill.com',
    icon:        '🥗',
    accent:      'from-green-50 to-emerald-100',
    groups:      ['meal-planner-users'],
  },
  {
    id:          'game-night',
    name:        'Game Night',
    description: 'Plan game nights with friends.',
    url:         'https://gamenights.jaetill.com',
    icon:        '🎲',
    accent:      'from-purple-50 to-violet-100',
    groups:      ['game-night-users'],
  },
  {
    id:          'carto',
    name:        'Carto',
    description: 'Penetration-testing engagement maps.',
    url:         'https://carto.jaetill.com',
    icon:        '🗺️',
    accent:      'from-blue-50 to-cyan-100',
    groups:      ['carto-users'],
    // No `hidden` — only users in carto-users (currently just jaetill) see this tile.
  },
];

export function appsForUser(claims) {
  const userGroups = (claims && claims['cognito:groups']) || [];
  return APPS.filter(app =>
    !app.hidden &&
    (app.groups.length === 0 || app.groups.some(g => userGroups.includes(g)))
  );
}
