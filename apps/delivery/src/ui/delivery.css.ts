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
.delivery .layout > * { min-width: 0; }
.delivery .grid-scroll { overflow-x: auto; }
.delivery .staffing table { border-collapse: collapse; width: 100%; min-width: 60rem; }
.delivery .staffing th, .delivery .staffing td { padding: 0.2rem 0.4rem; border-bottom: 1px solid #e2e7ee; text-align: left; white-space: nowrap; }
.delivery .staffing .num { text-align: right; font-variant-numeric: tabular-nums; }
.delivery .staffing tr[data-kind='parent'] th, .delivery .staffing tr[data-kind='parent'] td { background: #f3f6fa; font-weight: 600; }
.delivery .staffing tr[data-kind='leaf'] th, .delivery .staffing tr[data-kind='leaf'] td { background: #f9fafc; }
.delivery .staffing .tag { font-size: 0.65rem; color: #5b6674; text-transform: uppercase; margin-left: 0.25rem; }
.delivery .staffing .cell { position: relative; }
.delivery .staffing .cell input { width: 6.2rem; text-align: right; font: inherit; padding: 0.15rem 0.25rem; border: 1px solid #cfd6e0; border-radius: 3px; }
.delivery .staffing .cell input:focus { outline: 2px solid #2f6fd0; }
.delivery .staffing .cell input:disabled { background: #f0f2f5; color: #6b7684; }
.delivery .staffing .cell[data-over] input { border-color: #b42318; background: #fef3f2; }
.delivery .staffing .cell[data-culprit] input { box-shadow: 0 0 0 2px #fda29b; }
.delivery .staffing .cell[data-coverage] input { border-style: dashed; }
.delivery .staffing .flag { font-size: 0.65rem; color: #b42318; margin-left: 0.15rem; }
.delivery .staffing .cell[data-coverage] .flag { color: #8a5a00; }
.delivery .staffing tfoot th, .delivery .staffing tfoot td { font-weight: 700; border-top: 2px solid #9aa5b4; }
.delivery .staffing .warning { color: #8a5a00; background: #fffaeb; border: 1px solid #f5c26b; padding: 0.4rem 0.6rem; border-radius: 4px; }
.delivery .over-list { margin-top: 0.75rem; }
.delivery .over-list h3 { margin: 0 0 0.25rem; font-size: 0.95rem; color: #b42318; }
.delivery .unit-switch { display: flex; gap: 0.25rem; }
.delivery .unit-switch label { border: 1px solid #cfd6e0; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; }
.delivery .unit-switch label:has(input:checked) { background: #1c2430; color: #fff; }
.delivery .unit-switch input { position: absolute; opacity: 0; }
.delivery .unit-switch label:has(input:focus-visible) { outline: 2px solid #2f6fd0; }
.delivery .unit-switch label:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
.delivery .view-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid #cfd6e0; }
.delivery .view-tabs button { background: none; border: 1px solid transparent; border-bottom: none; padding: 0.35rem 0.8rem; cursor: pointer; font: inherit; border-radius: 4px 4px 0 0; }
.delivery .view-tabs button[aria-current='page'] { background: #fff; border-color: #cfd6e0; font-weight: 600; margin-bottom: -1px; }
.delivery .view-tabs .count { display: inline-block; min-width: 1.2rem; text-align: center; background: #e8eef7; border-radius: 999px; font-size: 0.75rem; padding: 0 0.3rem; }
.delivery .view-tabs .count:not([data-count='0']) { background: #fef3f2; color: #b42318; }
.delivery .over-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 1rem; }
.delivery .over-rows li { border: 1px solid #fda29b; border-radius: 6px; padding: 0.6rem 0.9rem; background: #fffbfa; }
.delivery .over-rows h3 { margin: 0 0 0.2rem; font-size: 1rem; }
.delivery .over-rows table { border-collapse: collapse; width: 100%; margin-top: 0.4rem; }
.delivery .over-rows th, .delivery .over-rows td { padding: 0.25rem 0.4rem; border-bottom: 1px solid #e2e7ee; text-align: left; }
.delivery .over-rows .num { text-align: right; }
.delivery .over-rows .amount { width: 5.5rem; text-align: right; font: inherit; padding: 0.15rem 0.25rem; border: 1px solid #cfd6e0; border-radius: 3px; }
.delivery .over-rows .tag.latest { color: #b42318; font-size: 0.75rem; margin-left: 0.4rem; }
.delivery .over-list button { margin-bottom: 0.4rem; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
