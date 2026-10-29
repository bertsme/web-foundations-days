"use strict";

const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");
const USERS_URL = "https://jsonplaceholder.typicode.com/users";

let users = [];

function setStatus(message, state = "") {
  statusMessage.textContent = message;
  if (state) {
    statusMessage.dataset.state = state;
  } else {
    delete statusMessage.dataset.state;
  }
}

function appendDetail(card, label, value) {
  const detail = document.createElement("p");
  const name = document.createElement("strong");
  name.textContent = `${label}: `;
  detail.append(name, document.createTextNode(value || "Not provided"));
  card.append(detail);
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = users.length === 0
      ? "No users have been loaded yet."
      : "No users match your filter.";
    usersList.append(emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const user of list) {
    const card = document.createElement("li");
    card.className = "user-card";

    const name = document.createElement("h3");
    name.textContent = user.name;
    card.append(name);
    appendDetail(card, "Email", user.email);
    appendDetail(card, "City", user.address?.city);
    appendDetail(card, "Company", user.company?.name);
    fragment.append(card);
  }
  usersList.append(fragment);
}

async function loadUsers() {
  loadButton.disabled = true;
  loadButton.textContent = "Loading…";
  setStatus("Loading users…");

  try {
    const response = await fetch(USERS_URL);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const result = await response.json();
    if (!Array.isArray(result)) {
      throw new Error("The server returned an unexpected response.");
    }

    users = result;
    renderUsers(users);
    setStatus(`Loaded ${users.length} users.`);
  } catch {
    users = [];
    renderUsers(users);
    setStatus("Could not load users. Check your connection and try again.", "error");
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = "Load users";
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const query = filterInput.value.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) =>
    user.name.toLocaleLowerCase().includes(query)
  );
  renderUsers(filteredUsers);
});

renderUsers(users);
