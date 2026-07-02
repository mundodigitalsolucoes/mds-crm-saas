export const isMdsWhiteLabelModeEnabled = () =>
  window.chatwootConfig?.mdsWhiteLabelMode === true ||
  window.chatwootConfig?.mdsWhiteLabelMode === 'true';
