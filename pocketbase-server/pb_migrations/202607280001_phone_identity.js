function hasField(collection, name) {
  try {
    return Boolean(collection.fields.getByName(name));
  } catch (_) {
    return false;
  }
}

function removeField(collection, name) {
  if (hasField(collection, name)) collection.fields.removeByName(name);
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("isivolt_users");
  if (!hasField(users, "phone")) {
    users.fields.add(new TextField({
      name: "phone",
      max: 32,
      presentable: true
    }));
  }
  users.passwordAuth.identityFields = ["email", "phone"];
  users.indexes = users.indexes.filter((value) => String(value).indexOf("idx_isivolt_users_phone") < 0);
  users.indexes.push("CREATE UNIQUE INDEX idx_isivolt_users_phone ON isivolt_users (phone) WHERE phone != ''");
  app.save(users);

  const requests = app.findCollectionByNameOrId("isivolt_registration_requests");
  if (!hasField(requests, "phone")) {
    requests.fields.add(new TextField({
      name: "phone",
      max: 32
    }));
  }
  requests.indexes = requests.indexes.filter((value) => String(value).indexOf("idx_registration_workspace_phone") < 0);
  requests.indexes.push("CREATE UNIQUE INDEX idx_registration_workspace_phone ON isivolt_registration_requests (workspace, phone) WHERE phone != ''");
  app.save(requests);
}, (app) => {
  const requests = app.findCollectionByNameOrId("isivolt_registration_requests");
  requests.indexes = requests.indexes.filter((value) => String(value).indexOf("idx_registration_workspace_phone") < 0);
  removeField(requests, "phone");
  app.save(requests);

  const users = app.findCollectionByNameOrId("isivolt_users");
  users.passwordAuth.identityFields = ["email"];
  users.indexes = users.indexes.filter((value) => String(value).indexOf("idx_isivolt_users_phone") < 0);
  removeField(users, "phone");
  app.save(users);
});
