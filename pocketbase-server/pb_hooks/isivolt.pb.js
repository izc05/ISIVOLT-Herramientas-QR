routerAdd("GET", "/api/isivolt/health", (e) => {
  const api = require(`${__hooks}/isivolt-utils.js`);
  return api.health(e);
});

routerAdd("GET", "/api/isivolt/me", (e) => {
  const api = require(`${__hooks}/isivolt-utils.js`);
  return api.me(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("GET", "/api/isivolt/sync", (e) => {
  const api = require(`${__hooks}/isivolt-utils.js`);
  return api.sync(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/entity", (e) => {
  const api = require(`${__hooks}/isivolt-utils.js`);
  return api.entity(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/movement", (e) => {
  const api = require(`${__hooks}/isivolt-utils.js`);
  return api.movement(e);
}, $apis.requireAuth("isivolt_users"));
