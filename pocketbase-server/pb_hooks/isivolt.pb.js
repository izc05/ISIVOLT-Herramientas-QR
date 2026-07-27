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

routerAdd("GET", "/api/isivolt/technician-accounts", (e) => {
  const api = require(`${__hooks}/technician-accounts.js`);
  return api.list(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/technician-account", (e) => {
  const api = require(`${__hooks}/technician-accounts.js`);
  return api.save(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/register-request", (e) => {
  const api = require(`${__hooks}/registration-requests.js`);
  return api.submit(e);
});

routerAdd("POST", "/api/isivolt/register-status", (e) => {
  const api = require(`${__hooks}/registration-requests.js`);
  return api.status(e);
});

routerAdd("GET", "/api/isivolt/registration-requests", (e) => {
  const api = require(`${__hooks}/registration-requests.js`);
  return api.list(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/registration-request/approve", (e) => {
  const api = require(`${__hooks}/registration-requests.js`);
  return api.approve(e);
}, $apis.requireAuth("isivolt_users"));

routerAdd("POST", "/api/isivolt/registration-request/reject", (e) => {
  const api = require(`${__hooks}/registration-requests.js`);
  return api.reject(e);
}, $apis.requireAuth("isivolt_users"));
