/** Plain CSS as a string, rendered in a <style> tag so it travels with the federated module. */
export const PEOPLE_CSS = `
.people { display: grid; grid-template-columns: minmax(16rem, 22rem) 1fr; gap: 1.5rem; align-items: start; }
.people .muted { color: #5b6674; font-size: 0.875rem; margin: 0.15rem 0; }
.people .register input[type='search'] { width: 100%; box-sizing: border-box; padding: 0.4rem; }
.people .register-list { list-style: none; margin: 0.5rem 0 0; padding: 0; max-height: 70vh; overflow: auto; }
.people .register-list button { display: grid; width: 100%; text-align: left; gap: 0.1rem; padding: 0.45rem 0.6rem; border: 1px solid transparent; background: none; cursor: pointer; }
.people .register-list button[aria-current='true'] { background: #e8eef7; border-color: #9db4d6; }
.people .name { font-weight: 600; }
.people .badge { display: inline-block; width: fit-content; background: #fef3f2; color: #b42318; border: 1px solid #fda29b; border-radius: 999px; padding: 0 0.5rem; font-size: 0.75rem; }
.people table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
.people th, .people td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #d8dee6; }
.people td button { margin-right: 0.4rem; }
.people .field { display: grid; gap: 0.2rem; margin-bottom: 0.6rem; max-width: 18rem; }
.people .error { color: #b42318; margin: 0; font-size: 0.875rem; }
.people .notice { border: 1px solid #f5c26b; background: #fffaeb; padding: 0.5rem 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
