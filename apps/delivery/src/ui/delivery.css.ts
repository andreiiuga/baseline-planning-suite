/** Plain CSS as a string, rendered in a <style> tag so it travels with the federated module. */
export const DELIVERY_CSS = `
.delivery { display: grid; gap: 1rem; }
.delivery .muted { color: #5b6674; font-size: 0.875rem; margin: 0.15rem 0; }
.delivery .toolbar { display: flex; flex-wrap: wrap; gap: 1rem; align-items: end; }
.delivery .field { display: grid; gap: 0.2rem; margin-bottom: 0.5rem; }
.delivery .notice { border: 1px solid #f5c26b; background: #fffaeb; padding: 0.5rem 0.75rem; border-radius: 4px; }
.delivery .error { color: #b42318; }
.delivery .info { color: #1c5d2b; }
.delivery .layout { display: grid; grid-template-columns: minmax(18rem, 24rem) 1fr; gap: 1.5rem; align-items: start; }
.delivery [role='tree'], .delivery [role='group'] { list-style: none; margin: 0; padding-left: 1.1rem; }
.delivery [role='tree'] { padding-left: 0; }
.delivery .tree-row { display: flex; align-items: center; gap: 0.15rem; }
.delivery .tree-toggle { width: 1.25rem; background: none; border: none; cursor: pointer; padding: 0; }
.delivery .tree-name { background: none; border: 1px solid transparent; text-align: left; cursor: pointer; padding: 0.15rem 0.35rem; }
.delivery .tree-name[aria-current='true'] { background: #e8eef7; border-color: #9db4d6; }
.delivery .tree-tools { margin-top: 1rem; display: grid; gap: 0.5rem; }
.delivery .tree-tools .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.delivery .confirm { border: 1px solid #fda29b; background: #fef3f2; padding: 0.5rem 0.75rem; border-radius: 4px; }
`;
