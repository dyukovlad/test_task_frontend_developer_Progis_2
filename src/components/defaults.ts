const DEFAULTS = {
  center: [42.3231, 69.5851] as [number, number],
  zoom: 13,
  height: '100vh',
  zwsLayerName: 'example:demo',
  zwsEndpoint: 'http://zs.zulugis.ru:6473/zws',
  zwsAuth: { user: 'mo', pass: 'mo' },
};

const WINDOW_POPUP = {
  maxHeight: 250,
  maxWidth: 400,
  autoPan: true,
};

export { DEFAULTS, WINDOW_POPUP };
