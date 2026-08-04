migrate((app) => {
  const users = app.findCollectionByNameOrId('isivolt_users');
  const activeField = users.fields.getByName('active');
  activeField.required = false;
  app.save(users);
}, (app) => {
  app.db()
    .newQuery('UPDATE isivolt_users SET active = 1 WHERE active = 0')
    .execute();

  const users = app.findCollectionByNameOrId('isivolt_users');
  const activeField = users.fields.getByName('active');
  activeField.required = true;
  app.save(users);
});