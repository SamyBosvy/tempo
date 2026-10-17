export function installVisible(installed: boolean, dismissed: boolean, available: boolean, permanent = false) {
  return !installed && available && (permanent || !dismissed);
}
export function updateCanRefresh(waiting: boolean, focusRunning: boolean, primeRunning: boolean) {
  return waiting && !focusRunning && !primeRunning;
}
