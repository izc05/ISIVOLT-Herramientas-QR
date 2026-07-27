migrate((app) => {
  const users = app.findCollectionByNameOrId("isivolt_users");
  users.fields.getByName("active").required = false;
  users.fields.add(new SelectField({
    name: "registration_status",
    maxSelect: 1,
    values: ["pending", "approved", "rejected"]
  }));
  users.authRule = "active = true && registration_status != 'pending' && registration_status != 'rejected'";
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("isivolt_users");
  users.authRule = "active = true";
  users.fields.getByName("active").required = true;
  users.fields.removeByName("registration_status");
  app.save(users);
});
