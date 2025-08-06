let loggedInUser = null;
let areOrdersVisible = false;
let areUsersVisible = false;
let selectedOrders = new Set();
let sortDirection = 1;
let isMenuVisible = false; // Dodaj tę zmienną na początku pliku, z innymi stanami
let selectedDishes = new Set();

// Helper functions for notifications
// Dodaj to po początkowych deklaracjach zmiennych (około linii 9)
window.toggleOrderSelection = function(event, orderId) {
  const checkbox = event.target;
  const row = checkbox.closest('tr');
  
  if (checkbox.checked) {
    selectedOrders.add(orderId);
    row.classList.add('selected-row');
  } else {
    selectedOrders.delete(orderId);
    row.classList.remove('selected-row');
  }
  
  const deleteSelectedBtn = document.getElementById("delete-selected-orders");
  deleteSelectedBtn.style.display = selectedOrders.size > 0 ? 'inline-block' : 'none';
  
  const selectAll = document.getElementById("select-all-orders");
  if (selectAll) {
    const allCheckboxes = document.querySelectorAll('#order-list input[type="checkbox"]:not(#select-all-orders)');
    selectAll.checked = selectedOrders.size > 0 && selectedOrders.size === allCheckboxes.length;
    selectAll.indeterminate = selectedOrders.size > 0 && selectedOrders.size < allCheckboxes.length;
  }
};

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? 
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' :
        type === 'error' ?
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' :
        '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
    </svg>
    ${message}
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('animate__animated', 'animate__fadeOut');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

function login() {
  const username = document.getElementById("admin-login").value;
  const password = document.getElementById("admin-password").value;
  const loginBtn = document.querySelector('#login-section button');

  // Show loading state
  loginBtn.innerHTML = '<span class="loader"></span> Logowanie...';
  loginBtn.disabled = true;

  fetch("https://bestemcatering.onrender.com/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(res => {
      if (!res.ok) throw new Error("Błąd logowania");
      return res.json();
    })
    .then(data => {
      if (data.role !== "admin") {
        throw new Error("Tylko dla administratorów");
      }

      loggedInUser = data.username;
      
      // Animate login section out
      document.getElementById("login-section").classList.add('animate__animated', 'animate__fadeOut');
      
      setTimeout(() => {
        document.getElementById("login-section").style.display = "none";
        
        // Set admin name and animate panel in
        document.getElementById("admin-name").textContent = loggedInUser;
        document.getElementById("admin-panel").style.display = "block";
        document.getElementById("admin-panel").classList.add('animate__animated', 'animate__fadeIn');
        
        loadMenu();
	 fetchCurrentWeekAndDisplay(); 
        showNotification("Zalogowano pomyślnie", 'success');
      }, 500);
    })
    .catch(error => {
      showNotification(error.message, 'error');
      document.getElementById("login-section").classList.add('animate__animated', 'animate__shakeX');
      setTimeout(() => {
        document.getElementById("login-section").classList.remove('animate__animated', 'animate__shakeX');
      }, 1000);
    })
    .finally(() => {
      loginBtn.innerHTML = 'Zaloguj';
      loginBtn.disabled = false;
    });
}

// === User Management ===
function addUser() {
  const username = document.getElementById("new-username").value;
  const password = document.getElementById("new-password").value;
  const role = document.getElementById("new-role").value;
  const userCode = document.getElementById("new-user-code").value;
  

// Walidacja pól
  if (!username) {
    showNotification("Proszę podać numer RCP (username)", 'error');
    document.getElementById("new-username").focus();
    return;
  }

  if (!password) {
    showNotification("Proszę podać hasło", 'error');
    document.getElementById("new-password").focus();
    return;
  }

  if (!userCode) {
    showNotification("Proszę podać imię i nazwisko użytkownika", 'error');
    document.getElementById("new-user-code").focus();
    return;
  }

  fetch("https://bestemcatering.onrender.com/admin/add_user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      role,
      admin_username: loggedInUser,
      user_code: userCode
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.detail || "Użytkownik już istnieje");
      });
    }
    return res.json();
  })
  .then(data => {
    showNotification(data.msg || "Dodano użytkownika pomyślnie", 'success');
    fetchUsers();
    // Clear form
    document.getElementById("new-username").value = '';
    document.getElementById("new-password").value = '';
    document.getElementById("new-user-code").value = '';
  })
  .catch(error => {
    showNotification(error.message, 'error');
  });
}

function fetchUsers() {
  const container = document.getElementById("user-list");
  const refreshButton = document.querySelector('#user-list-section button');
  
  if (areUsersVisible) {
    container.innerHTML = "";
    refreshButton.innerHTML = 'Pokaż użytkowników';
    areUsersVisible = false;
    return;
  }

  container.innerHTML = '<div class="loader-container"><span class="loader"></span> Ładowanie użytkowników...</div>';
  refreshButton.innerHTML = '<span class="loader"></span> Ładowanie...';
  refreshButton.disabled = true;

  fetch(`https://bestemcatering.onrender.com/admin/users?admin_username=${loggedInUser}`)
    .then(res => res.json())
    .then(users => {
      container.innerHTML = "";
      
      // Add search field
      const searchContainer = document.createElement('div');
      searchContainer.style.marginBottom = '10px';
      searchContainer.style.display = 'flex';
      searchContainer.style.gap = '10px';
      
      const searchInput = document.createElement('input');
      searchInput.type = "text";
      searchInput.placeholder = "Szukaj po kodzie lub nazwie...";
      searchInput.style.flex = '1';
      searchInput.oninput = () => filterUsersTable(searchInput.value.toLowerCase());
      
      searchContainer.appendChild(searchInput);
      container.appendChild(searchContainer);

      // Sort button
      const sortButton = document.createElement("button");
      sortButton.className = 'ripple';
      sortButton.innerHTML = `Sortuj po nazwie ${sortDirection === 1 ? '▲' : '▼'}`;
      sortButton.onclick = () => {
        sortDirection *= -1;
        fetchUsers();
      };
      container.appendChild(sortButton);

      // Sorting
      users.sort((a, b) => {
        const nameA = a.username.toLowerCase();
        const nameB = b.username.toLowerCase();
        return nameA.localeCompare(nameB) * sortDirection;
      });

      // Table with additional user_code column
      const userTable = document.createElement("table");
      userTable.id = "users-table";
      userTable.classList.add('animate__animated', 'animate__fadeIn');
      userTable.style.fontSize = "12px"; 
      
      const header = document.createElement("tr");
      header.innerHTML = "<th>Nazwa użytkownika</th><th>Kod</th><th>Rola</th><th>Akcje</th>";
      userTable.appendChild(header);

      users.forEach(user => {
        const row = document.createElement("tr");
        row.setAttribute('data-username', user.username);
        row.innerHTML = `
          <td><b>${user.username}</b></td>
          <td>${user.user_code || 'Brak kodu'}</td>
          <td>${user.role}</td>
          <td>
            <button onclick="editUserPrompt('${user.username}', '${user.user_code || ''}')" class="ripple">Edytuj</button>
            <button onclick="deleteUser('${user.username}')" class="ripple danger-btn">Usuń</button>
            <button onclick="changeRolePrompt('${user.username}')" class="ripple">Zmień rolę</button>
            <button onclick="changePasswordPrompt('${user.username}')" class="ripple">Zmień hasło</button>
          </td>
        `;
        userTable.appendChild(row);
      });

      container.appendChild(userTable);
      refreshButton.innerHTML = 'Ukryj użytkowników';
      areUsersVisible = true;
    })
    .catch(error => {
      showNotification("Błąd ładowania użytkowników", 'error');
      console.error("Error fetching users:", error);
      refreshButton.innerHTML = 'Pokaż użytkowników';
    })
    .finally(() => {
      refreshButton.disabled = false;
    });
}

function editUserPrompt(username, currentCode) {
  const row = document.querySelector(`tr[data-username="${username}"]`);
  if (!row) return;

  // Check if edit form already exists
  if (row.nextElementSibling && row.nextElementSibling.classList.contains('edit-user-form-row')) {
    row.nextElementSibling.remove();
    return;
  }

  // Remove any other edit forms
  document.querySelectorAll('.edit-user-form-row').forEach(el => el.remove());

  const formRow = document.createElement('tr');
  formRow.className = 'edit-user-form-row';
  formRow.innerHTML = `
    <td colspan="4">
      <div class="edit-user-form">
        <div>
          <label>Nowa nazwa użytkownika:</label>
          <input type="text" id="edit-username" value="${username}" />
        </div>
        <div>
          <label>Nowy kod użytkownika:</label>
          <input type="text" id="edit-user-code" value="${currentCode || ''}" />
        </div>
        <div class="edit-user-form-buttons">
          <button onclick="saveUserChanges('${username}')" class="ripple success-btn">Zapisz</button>
          <button onclick="this.closest('tr').remove()" class="ripple danger-btn">Anuluj</button>
        </div>
      </div>
    </td>
  `;

  row.parentNode.insertBefore(formRow, row.nextSibling);
}

async function fetchCurrentWeekAndDisplay() {
  try {
    const response = await fetch("https://bestemcatering.onrender.com/current_week");
    if (!response.ok) throw new Error("Brak tygodnia");
    const data = await response.json();
    const week = data.week;

    const display = document.getElementById("current-week-display");
    if (display) {
      display.textContent = "Aktualny tydzień zamówień: " + week;
    }

    // Ustaw też ukryty input, jeśli jesteś w user.html
    const hiddenWeekInput = document.getElementById("order-week");
    if (hiddenWeekInput) {
      hiddenWeekInput.value = week;
    }

  } catch (err) {
    console.error("Błąd pobierania tygodnia:", err);
  }
}


async function saveUserChanges(oldUsername) {
  const newUsername = document.getElementById('edit-username').value.trim();
  const newUserCode = document.getElementById('edit-user-code').value.trim();

  if (!newUsername) {
    showNotification("Nazwa użytkownika nie może być pusta", 'error');
    return;
  }

  try {
    const response = await fetch(`https://bestemcatering.onrender.com/admin/update_user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        old_username: oldUsername,
        new_username: newUsername,
        new_user_code: newUserCode,
        admin_username: loggedInUser
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Błąd podczas aktualizacji użytkownika");
    }

    showNotification("Dane użytkownika zostały zaktualizowane", 'success');
    fetchUsers(); // Refresh the user list
  } catch (error) {
    console.error("Błąd:", error);
    showNotification(error.message, 'error');
  }
}

function setActiveWeek() {
  const week = document.getElementById("admin-week-input").value;
  if (!week) {
    showNotification("Proszę wybrać tydzień", 'error');
    return;
  }

  fetch("https://bestemcatering.onrender.com/admin/set_week", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ week, admin_username: loggedInUser })
  })
  .then(res => res.json())
  .then(data => {
    showNotification("Tydzień ustawiony pomyślnie", 'success');

    // 🔹 Nowe – odświeżenie wyświetlanego tygodnia bez przeładowania strony
    fetchCurrentWeekAndDisplay();
  })
  .catch(error => {
    showNotification("Błąd ustawiania tygodnia", 'error');
  });
}



function filterUsersTable(searchTerm) {
  const table = document.getElementById("users-table");
  if (!table) return;

  const rows = table.getElementsByTagName("tr");
  for (let i = 1; i < rows.length; i++) { // Pomijamy nagłówek
    const cells = rows[i].getElementsByTagName("td");
    const username = cells[0].textContent.toLowerCase();
    const userCode = cells[1].textContent.toLowerCase();
    
    if (username.includes(searchTerm) || userCode.includes(searchTerm)) {
      rows[i].style.display = "";
    } else {
      rows[i].style.display = "none";
    }
  }
}
function changeRolePrompt(username) {
  const newRole = prompt("Nowa rola (user/admin):", "user");
  if (!newRole) return;

  fetch(`https://bestemcatering.onrender.com/admin/update_role?username=${username}&new_role=${newRole}&admin_username=${loggedInUser}`, {
    method: "PUT"
  })
    .then(res => res.json())
    .then(data => {
      showNotification(data.msg, 'success');
      fetchUsers();
    })
    .catch(error => {
      showNotification("Błąd zmiany roli", 'error');
    });
}

function changePasswordPrompt(username) {
  const newPassword = prompt(`Nowe hasło dla ${username}:`);
  if (!newPassword) return;

  fetch(`https://bestemcatering.onrender.com/admin/change_password?username=${username}&new_password=${newPassword}&admin_username=${loggedInUser}`, {
    method: "PUT"
  })
    .then(res => res.json())
    .then(data => showNotification(data.msg, 'success'))
    .catch(() => showNotification("Błąd zmiany hasła", 'error'));
}

function deleteUser(username) {
  if (!confirm(`Czy na pewno chcesz usunąć użytkownika ${username}?`)) return;

  fetch(`https://bestemcatering.onrender.com/admin/delete_user?username=${username}&admin_username=${loggedInUser}`, {
    method: "DELETE"
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => {
          throw new Error(data.detail || "Błąd podczas usuwania użytkownika");
        });
      }
      return res.json();
    })
    .then(data => {
      showNotification(data.msg || "Użytkownik został usunięty", 'success');
      fetchUsers();
    })
    .catch(error => {
      showNotification(error.message, 'error');
    });
}

// === Menu Management ===
function addDish() {
  const name = document.getElementById("dish-name").value;
  const description = document.getElementById("dish-description").value;
  const price = parseFloat(document.getElementById("dish-price").value);
  const day = document.getElementById("dish-day").value;
  

  if (!name || !description || isNaN(price)) {
    showNotification("Uzupełnij wszystkie pola", 'error');
    return;
  }

  fetch("https://bestemcatering.onrender.com/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      name, 
      description, 
      price, 
      day,  // Dodane pole dnia
      username: loggedInUser 
    })
  })
    .then(res => res.json())
    .then(data => {
      showNotification(data.msg, 'success');
      loadMenu();
      // Clear form
      document.getElementById("dish-name").value = '';
      document.getElementById("dish-description").value = '';
      document.getElementById("dish-price").value = '';
    })
    .catch(() => showNotification("Błąd dodawania dania", 'error'));
}

// === Menu Management ===
function loadMenu() {
  if (!isMenuVisible) {
    toggleMenu();
  } else {
    const button = document.querySelector('#admin-panel > section:nth-child(5) button');
    button.innerHTML = '<span class="loader"></span> Ładowanie...';
    button.disabled = true;
    
    fetch("https://bestemcatering.onrender.com/menu/list")
      .then(res => res.json())
      .then(menu => {
        const container = document.getElementById("menu-list");
        container.innerHTML = "";

        const table = document.createElement("table");
        table.id = "menu-table";
        table.style.fontSize = "10px"; // lub np. "0.85em"

        const header = document.createElement("tr");
        header.innerHTML = "<th>Dzień</th><th>Nazwa</th><th>Opis</th><th>Cena</th><th>Akcje</th>";
        table.appendChild(header);
	 

        menu.forEach(item => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${item.day || 'Brak dnia'}</td>
            <td>${item.name}</td>
            <td>${item.description}</td>
            <td>${item.price.toFixed(2)} zł</td>
            <td>
              <button onclick="editDish('${item.name.replace(/'/g, "\\'")}', '${item.description.replace(/'/g, "\\'")}', ${item.price}, '${item.day}')" class="ripple">Edytuj</button>
              <button onclick="deleteDish('${item.name.replace(/'/g, "\\'")}')" class="ripple danger-btn">Usuń</button>
            </td>
          `;
          table.appendChild(row);
        });

        container.appendChild(table);
        button.textContent = 'MENU';
        button.disabled = false;
      })
      .catch(() => {
        showNotification("Błąd ładowania menu", 'error');
        const button = document.querySelector('#admin-panel > section:nth-child(5) button');
        button.textContent = 'Pokaż/Ukryj menu';
        button.disabled = false;
      });
  }
}

function editDish(name, description, price, day) {
  // Ustaw oryginalną nazwę jako atrybut danych
  document.getElementById("edit-dish-name").setAttribute('data-original-name', name);
  document.getElementById("edit-dish-name").value = name;
  document.getElementById("edit-dish-name").readOnly = false;
  document.getElementById("edit-dish-description").value = description;
  document.getElementById("edit-dish-price").value = price;
  document.getElementById("edit-dish-day").value = day;
  
  document.getElementById("edit-menu-section").style.display = "block";
  document.getElementById("edit-menu-section").scrollIntoView({ behavior: 'smooth' });
}

function cancelEditMenu() {
  // Wyczyść formularz i ukryj sekcję edycji
  document.getElementById("edit-dish-name").value = "";
  document.getElementById("edit-dish-description").value = "";
  document.getElementById("edit-dish-price").value = "";
  document.getElementById("edit-dish-day").value = "Poniedziałek";
  document.getElementById("edit-menu-section").style.display = "none";
}

async function saveEditedDish() {
  const originalName = document.getElementById("edit-dish-name").getAttribute('data-original-name');
  const newName = document.getElementById("edit-dish-name").value;
  const newDescription = document.getElementById("edit-dish-description").value;
  const newPrice = parseFloat(document.getElementById("edit-dish-price").value);
  const newDay = document.getElementById("edit-dish-day").value;

  if (!originalName || !newName || !newDescription || isNaN(newPrice)) {
    showNotification("Wypełnij wszystkie pola", 'error');
    return;
  }



  try {
    const response = await fetch("https://bestemcatering.onrender.com/menu/update", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        original_name: originalName,
        new_name: newName,
        new_description: newDescription,
        new_price: newPrice,
        new_day: newDay,
        username: loggedInUser
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Błąd podczas aktualizacji dania");
    }

    const data = await response.json();
    showNotification(data.msg, 'success');
    cancelEditMenu();
    loadMenu();
  } catch (error) {
    console.error("Błąd:", error);
    showNotification(error.message, 'error');
  }
}
// === Excel export ===
  
function fetchOrders() {
  const loadButton = document.getElementById("load-orders-button");
  const deleteSelectedBtn = document.getElementById("delete-selected-orders");
  const container = document.getElementById("order-list");
  
  loadButton.innerHTML = '<span class="loader"></span> Ładowanie...';
  loadButton.disabled = true;
  deleteSelectedBtn.style.display = 'none';
  selectedOrders.clear();

  if (areOrdersVisible) {
    container.innerHTML = "";
    loadButton.innerHTML = 'Załaduj zamówienia';
    loadButton.disabled = false;
    areOrdersVisible = false;
    return;
  }

  fetch(`https://bestemcatering.onrender.com/admin/orders?admin_username=${encodeURIComponent(loggedInUser)}`)
    .then(async response => {
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Błąd serwera");
      }
      return response.json();
    })
    .then(orders => {
      container.innerHTML = "";

      if (!orders || orders.length === 0) {
        container.innerHTML = "<p>Brak zamówień.</p>";
        areOrdersVisible = true;
        loadButton.innerHTML = 'Ukryj zamówienia';
        loadButton.disabled = false;
        return;
      }

      fetch(`https://bestemcatering.onrender.com/admin/users?admin_username=${loggedInUser}`)
        .then(res => res.json())
        .then(users => {
          const userCodeMap = {};
          users.forEach(user => {
            userCodeMap[user.username] = user.user_code || 'Brak kodu';
          });

          // Dodaj pole wyszukiwania
          const searchContainer = document.createElement('div');
          searchContainer.style.marginBottom = '10px';
          searchContainer.style.display = 'flex';
          searchContainer.style.gap = '10px';
          
          const searchInput = document.createElement('input');
          searchInput.type = "text";
          searchInput.placeholder = "Szukaj po kodzie lub nazwie użytkownika...";
          searchInput.style.flex = '1';
          searchInput.oninput = () => filterOrdersTable(searchInput.value.toLowerCase(), userCodeMap);
          
          searchContainer.appendChild(searchInput);
          container.appendChild(searchContainer);

          const table = document.createElement("table");
          table.className = "orders-table";
          table.id = "orders-table";
          table.style.width = "100%";
          table.style.tableLayout = "fixed"; // Ważne dla stałych szerokości kolumn
          
          // Nagłówki tabeli Z POPRAWIONYMI SZEROKOŚCIAMI
          const header = document.createElement("tr");
          header.innerHTML = `
            <th style="width: 40px;"><input type="checkbox" id="select-all-orders" onclick="toggleAllOrders(this)"></th>
            <th style="width: 80px;">Kod użytk.</th>
            <th style="width: 40px;">RCP</th>
            <th style="width: 60px;">Tydzień</th>
            <th style="width: 70px;">Miejsce</th>
            <th style="width: 60px;">Zmiana</th>
            <th style="width: 350px;">Dania</th>
            <th style="width: 80px;">Akcje</th>
          `;
          table.appendChild(header);

          // Wiersze z zamówieniami
          orders.forEach(order => {
            const row = document.createElement("tr");
            const orderId = order._id;
            const userCode = userCodeMap[order.username] || 'Brak kodu';
            
            // Formatowanie dań
            const meals = order.meals?.map(m => 
              `${m.day}: ${m.name} (${m.price.toFixed(2)} zł)`
            ).join("<br>") || "Brak dań";

            // Checkbox do wyboru
            const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.dataset.orderId = orderId; // Dodajemy data-atrybut
	checkbox.addEventListener('change', function(e) {
   	 window.toggleOrderSelection(e, orderId);
	});
            // Przycisk usuwania
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Usuń";
            deleteBtn.className = "ripple danger-btn";
            deleteBtn.onclick = (e) => {
              e.stopPropagation();
              deleteOrder(orderId);
            };

            row.innerHTML = `
              <td></td>
              <td>${userCode}</td>
              <td>${order.username}</td>
              <td>${order.week}</td>
              <td>${order.date_range || 'Brak danych'}</td>
              <td>${order.shift || 'Brak danych'}</td>
              <td>${meals}</td>
              <td></td>
            `;
            
            // Dodaj atrybuty data-* dla wyszukiwania
            row.setAttribute('data-user-code', userCode.toLowerCase());
            row.setAttribute('data-username', order.username.toLowerCase());
            
            // Wstaw checkbox i przycisk
            row.cells[0].appendChild(checkbox);
            const actionCell = row.cells[7];
            actionCell.appendChild(deleteBtn);
            
            table.appendChild(row);
          });

          container.appendChild(table);
          areOrdersVisible = true;
          loadButton.innerHTML = 'Ukryj zamówienia';
          loadButton.disabled = false;
          deleteSelectedBtn.style.display = selectedOrders.size > 0 ? 'inline-block' : 'none';
        });
    })
    .catch(error => {
      console.error("Błąd:", error);
      showNotification(error.message, "error");
      loadButton.innerHTML = 'Załaduj zamówienia';
      loadButton.disabled = false;
    });
}function filterOrdersTable(searchTerm, userCodeMap) {
  const table = document.getElementById("orders-table");
  if (!table) return;

  const rows = table.getElementsByTagName("tr");
  for (let i = 1; i < rows.length; i++) { // Pomijamy nagłówek
    const userCode = rows[i].getAttribute('data-user-code') || '';
    const username = rows[i].getAttribute('data-username') || '';
    
    if (userCode.includes(searchTerm) || username.includes(searchTerm)) {
      rows[i].style.display = "";
    } else {
      rows[i].style.display = "none";
    }
  }
}

async function deleteOrder(orderId) {
  if (!orderId || orderId === "undefined") {
    showNotification("Błąd: Nieprawidłowe ID zamówienia", "error");
    return;
  }

  if (!confirm(`Czy na pewno chcesz usunąć to zamówienie?`)) return;

  try {
    const response = await fetch(`https://bestemcatering.onrender.com/admin/delete_order`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        admin_username: loggedInUser
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Nie udało się usunąć zamówienia");
    }

    const data = await response.json();
    showNotification(data.message || "Zamówienie zostało usunięte", "success");
    fetchOrders(); // Odśwież listę
  } catch (error) {
    console.error("Błąd:", error);
    showNotification(error.message, "error");
  }
}

// Add loader styles and selection styles
const style = document.createElement('style');
style.textContent = `
  /* Loader styles (oryginalne) */
  .loader {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
    vertical-align: middle;
    margin-right: 8px;
  }
  
  .loader-container {
    text-align: center;
    padding: 20px;
    color: var(--gray);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Wspólne style dla obu zakładek (Zamówienia i Menu) */
  .orders-table tr.selected-row,
  #menu-list tr.selected-row {
    background-color: rgba(0, 123, 255, 0.1);
    transition: background-color 0.2s ease;
  }

  #select-all-orders:indeterminate,
  #select-all-dishes:indeterminate {
    background-color: var(--primary-color, #007bff);
    border-color: var(--primary-color, #007bff);
    opacity: 0.5;
  }

  /* Style specyficzne dla zakładki Menu */
  #menu-list {
    margin-top: 15px;
  }

  #menu-list table {
    width: 100%;
    border-collapse: collapse;
  }

  #menu-list th, #menu-list td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  #menu-list tr:not(.selected-row):hover {
    background-color: rgba(0, 123, 255, 0.05);
  }

  #menu-list input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    margin: 0;
  }

  #menu-list .danger-btn {
    background-color: #dc3545;
  }

  /* Responsywność */
  @media (max-width: 768px) {
    #menu-list th, #menu-list td {
      padding: 6px 8px;
      font-size: 0.9em;
    }
  }
`;
document.head.appendChild(style);

async function downloadExcel() {
  const button = document.querySelector('.warning-btn');
  try {
    // Pokaż stan ładowania
    button.innerHTML = '<span class="loader"></span> Przygotowywanie raportu...';
    button.disabled = true;

    const response = await fetch(`https://bestemcatering.onrender.com/admin/orders/excel?admin_username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) {
      throw new Error("Błąd podczas generowania raportu");
    }

    // Pobierz nazwę pliku z nagłówków
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1] 
      : `raport_zamowien_${new Date().toISOString().slice(0,10)}.xlsx`;

    // Konwertuj odpowiedź na blob
    const blob = await response.blob();
    
    // Utwórz link do pobrania
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Posprzątaj
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showNotification("Raport został pobrany", "success");
  } catch (error) {
    console.error("Błąd pobierania raportu:", error);
    showNotification(error.message, "error");
  } finally {
    // Przywróć pierwotny stan przycisku
    button.innerHTML = 'Pobierz raport Excel';
    button.disabled = false;
  }
}

function toggleAllOrders(checkbox) {
  const checkboxes = document.querySelectorAll('#order-list input[type="checkbox"]:not(#select-all-orders)');
  const deleteSelectedBtn = document.getElementById("delete-selected-orders");
  
  if (checkbox.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      const orderId = cb.getAttribute('data-order-id') || cb.closest('tr').getAttribute('data-order-id');
      if (orderId) selectedOrders.add(orderId);
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
      const orderId = cb.getAttribute('data-order-id') || cb.closest('tr').getAttribute('data-order-id');
      if (orderId) selectedOrders.delete(orderId);
    });
  }
  
  // Pokaż przycisk "Usuń wybrane", jeśli jest co najmniej 1 zaznaczenie
  deleteSelectedBtn.style.display = selectedOrders.size > 0 ? 'inline-block' : 'none';
}

// === Menu Management ===
function toggleMenu() {
  const button = document.querySelector('#admin-panel > section:nth-child(5) button');
  const container = document.getElementById("menu-list");
  const deleteSelectedBtn = document.getElementById("delete-selected-dishes");
  
  if (isMenuVisible) {
    container.innerHTML = "";
    button.textContent = 'Zapisz kominikat*';
    isMenuVisible = false;
    selectedDishes.clear();
    deleteSelectedBtn.style.display = 'none';
    return;
  }

  container.innerHTML = '<div class="loader-container"><span class="loader"></span> Ładowanie menu...</div>';
  button.innerHTML = '<span class="loader"></span> Ładowanie...';
  button.disabled = true;

  fetch("https://bestemcatering.onrender.com/menu/list")
    .then(res => res.json())
    .then(menu => {
      container.innerHTML = "";

      const table = document.createElement("table");
      table.classList.add('animate__animated', 'animate__fadeIn');
      
      // Zmodyfikowany nagłówek tabeli z checkboxem "Zaznacz wszystkie"
      const header = document.createElement("tr");
      header.innerHTML = `
        <th style="width: 30px;"><input type="checkbox" id="select-all-dishes" onclick="toggleAllDishes(this)"></th>
        <th>Dzień</th>
        <th>Nazwa</th>
        <th>Opis</th>
        <th>Cena</th>
        <th>Akcje</th>
      `;
      table.appendChild(header);

      menu.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><input type="checkbox" onchange="toggleDishSelection(event, '${item.name.replace(/'/g, "\\'")}')"></td>
          <td>${item.day || 'Brak dnia'}</td>
          <td>${item.name}</td>
          <td>${item.description}</td>
          <td>${item.price.toFixed(2)} zł</td>
          <td>
            <button onclick="editDish('${item.name.replace(/'/g, "\\'")}', '${item.description.replace(/'/g, "\\'")}', ${item.price}, '${item.day}')" class="ripple">Edytuj</button>
            <button onclick="deleteDish('${item.name.replace(/'/g, "\\'")}')" class="ripple danger-btn">Usuń</button>
          </td>
        `;
        table.appendChild(row);
      });

      container.appendChild(table);
      button.textContent = 'Zapisz komunikat';
      button.disabled = false;
      isMenuVisible = true;
    })
    .catch(() => {
      showNotification("Błąd ładowania menu", 'error');
      button.textContent = 'Pokaż/ukryj menu';
      button.disabled = false;
    });
}

function toggleDishSelection(event, dishName) {
  const checkbox = event.target;
  const row = checkbox.closest('tr');
  
  if (checkbox.checked) {
    selectedDishes.add(dishName);
    row.classList.add('selected-row');
  } else {
    selectedDishes.delete(dishName);
    row.classList.remove('selected-row');
  }
  
  const deleteSelectedBtn = document.getElementById("delete-selected-dishes");
  deleteSelectedBtn.style.display = selectedDishes.size > 0 ? 'inline-block' : 'none';
  
  const selectAll = document.getElementById("select-all-dishes");
  if (selectAll) {
    const allCheckboxes = document.querySelectorAll('#menu-list input[type="checkbox"]:not(#select-all-dishes)');
    selectAll.checked = selectedDishes.size > 0 && selectedDishes.size === allCheckboxes.length;
    selectAll.indeterminate = selectedDishes.size > 0 && selectedDishes.size < allCheckboxes.length;
  }
}

function toggleAllDishes(checkbox) {
  const checkboxes = document.querySelectorAll('#menu-list input[type="checkbox"]:not(#select-all-dishes)');
  const deleteSelectedBtn = document.getElementById("delete-selected-dishes");
  
  checkboxes.forEach(cb => {
    cb.checked = checkbox.checked;
    const dishName = cb.closest('tr').cells[2].textContent;
    const row = cb.closest('tr');
    
    if (checkbox.checked) {
      selectedDishes.add(dishName);
      row.classList.add('selected-row');
    } else {
      selectedDishes.delete(dishName);
      row.classList.remove('selected-row');
    }
  });
  
  deleteSelectedBtn.style.display = checkbox.checked ? 'inline-block' : 'none';
}

async function deleteSelectedDishes() {
  if (selectedDishes.size === 0) return;
  
  if (!confirm(`Czy na pewno chcesz usunąć ${selectedDishes.size} wybranych dań?`)) return;

  const deleteSelectedBtn = document.getElementById("delete-selected-dishes");
  deleteSelectedBtn.innerHTML = '<span class="loader"></span> Usuwanie...';
  deleteSelectedBtn.disabled = true;

  try {
    const response = await fetch(`https://bestemcatering.onrender.com/menu/delete_selected`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dish_names: Array.from(selectedDishes),
        username: loggedInUser
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Nie udało się usunąć dań");
    }

document.querySelectorAll('#menu-list tr.selected-row').forEach(row => {
  row.classList.remove('selected-row');
});
    const data = await response.json();
    showNotification(`Usunięto ${data.deleted_count} dań`, "success");
    selectedDishes.clear();
    toggleMenu(); // Odśwież listę
  } catch (error) {
    console.error("Błąd:", error);
    showNotification(error.message, "error");
  } finally {
    deleteSelectedBtn.innerHTML = 'Usuń wybrane dania';
    deleteSelectedBtn.disabled = false;
  }
}

function deleteDish(dishName) {
  if (!confirm(`Czy na pewno chcesz usunąć danie: "${dishName}"?`)) return;

  fetch(`https://bestemcatering.onrender.com/menu/delete`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: dishName,
      username: loggedInUser
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.detail || "Błąd usuwania dania") });
    }
    return res.json();
  })
  .then(data => {
    showNotification(`Usunięto danie: ${dishName}`, "success");
    toggleMenu(); // Odśwież listę
  })
  .catch(error => {
    console.error("Błąd:", error);
    showNotification(error.message, "error");
  });
}


function toggleAllOrders(checkbox) {
  const checkboxes = document.querySelectorAll('#order-list input[type="checkbox"]:not(#select-all-orders)');
  const deleteSelectedBtn = document.getElementById("delete-selected-orders");
  
  checkboxes.forEach(cb => {
    cb.checked = checkbox.checked;
    const orderId = cb.dataset.orderId || cb.closest('tr').dataset.orderId;
    const row = cb.closest('tr');
    
    if (checkbox.checked) {
      selectedOrders.add(orderId);
      row.classList.add('selected-row');
    } else {
      selectedOrders.delete(orderId);
      row.classList.remove('selected-row');
    }
  });

  // Pokaż przycisk jeśli jest jakiekolwiek zaznaczenie
  deleteSelectedBtn.style.display = selectedOrders.size > 0 ? 'inline-block' : 'none';
  
  // Ustaw stan pośredni jeśli część jest zaznaczona
  checkbox.indeterminate = false;
  if (selectedOrders.size > 0 && selectedOrders.size < checkboxes.length) {
    checkbox.indeterminate = true;
  }
}

async function deleteSelectedOrders() {
  if (selectedOrders.size === 0) return;
  
  if (!confirm(`Czy na pewno chcesz usunąć ${selectedOrders.size} wybranych zamówień?`)) return;

  const deleteSelectedBtn = document.getElementById("delete-selected-orders");
  deleteSelectedBtn.innerHTML = '<span class="loader"></span> Usuwanie...';
  deleteSelectedBtn.disabled = true;

  try {
    const response = await fetch(`https://bestemcatering.onrender.com/admin/delete_orders`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_ids: Array.from(selectedOrders),
        admin_username: loggedInUser
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Nie udało się usunąć zamówień");
    }

    const data = await response.json();
    showNotification(`Usunięto ${data.deleted_count} zamówień`, "success");
    
    // Wyczyść selekcję wizualną
    document.querySelectorAll('#order-list .selected-row').forEach(row => {
      row.classList.remove('selected-row');
    });
    
    selectedOrders.clear();
    
    // Zresetuj checkbox "Zaznacz wszystkie"
    const selectAll = document.getElementById("select-all-orders");
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    
    fetchOrders(); // Odśwież listę
  } catch (error) {
    console.error("Błąd:", error);
    showNotification(error.message, "error");
  } finally {
    deleteSelectedBtn.innerHTML = 'Usuń wybrane';
    deleteSelectedBtn.disabled = false;
  }
}
async function downloadPDF() {
  const button = document.querySelector('.danger-btn');
  try {
    button.innerHTML = '<span class="loader"></span> Przygotowywanie PDF...';
    button.disabled = true;

    const response = await fetch(`https://bestemcatering.onrender.com/admin/orders/pdf?admin_username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) {
      throw new Error("Błąd podczas generowania raportu PDF");
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1] 
      : `raport_zamowien_${new Date().toISOString().slice(0,10)}.pdf`;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showNotification("Raport PDF został pobrany", "success");
  } catch (error) {
    console.error("Błąd pobierania raportu PDF:", error);
    showNotification(error.message, "error");
  } finally {
    button.innerHTML = 'Pobierz raport PDF';
    button.disabled = false;
  }
}
async function downloadERP() {
  const button = document.querySelector('.ripple:not(.warning-btn):not(.success-btn)'); // Wybierz przycisk ERP
  try {
    // Pokaż stan ładowania
    button.innerHTML = '<span class="loader"></span> Przygotowywanie ERP...';
    button.disabled = true;

    const response = await fetch(`https://bestemcatering.onrender.com/admin/orders/erp?admin_username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) {
      throw new Error("Błąd podczas generowania raportu ERP");
    }

    // Pobierz nazwę pliku z nagłówków
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1] 
      : `raport_erp_${new Date().toISOString().slice(0,10)}.csv`;

    // Konwertuj odpowiedź na blob
    const blob = await response.blob();
    
    // Utwórz link do pobrania
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Posprzątaj
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showNotification("Raport ERP został pobrany", "success");
  } catch (error) {
    console.error("Błąd pobierania raportu ERP:", error);
    showNotification(error.message, "error");
  } finally {
    // Przywróć pierwotny stan przycisku
    button.innerHTML = 'Pobierz raport ERP';
    button.disabled = false;
  }
}

async function downloadDishesReport() {
  const button = document.querySelector('.accent-btn');
  try {
    // Pokaż stan ładowania
    button.innerHTML = '<span class="loader"></span> Przygotowywanie raportu...';
    button.disabled = true;

    const response = await fetch(`https://bestemcatering.onrender.com/admin/orders/dishes_report?admin_username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) {
      throw new Error("Błąd podczas generowania raportu");
    }

    // Pobierz nazwę pliku z nagłówków
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1] 
      : `raport_dan_${new Date().toISOString().slice(0,10)}.xlsx`;

    // Konwertuj odpowiedź na blob
    const blob = await response.blob();
    
    // Utwórz link do pobrania
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Posprzątaj
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showNotification("Raport dań został pobrany", "success");
  } catch (error) {
    console.error("Błąd pobierania raportu:", error);
    showNotification(error.message, "error");
  } finally {
    // Przywróć pierwotny stan przycisku
    button.innerHTML = 'Pobierz raport dań';
    button.disabled = false;
  }
}

function logout() {
  // Animacja wyjścia
  document.getElementById("admin-panel").classList.add('animate__animated', 'animate__fadeOut');
  
  setTimeout(() => {
    // Ukryj panel admina i pokaż sekcję logowania
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    document.getElementById("login-section").classList.add('animate__animated', 'animate__fadeIn');
    
    // Wyczyść pola logowania
    document.getElementById("admin-login").value = "";
    document.getElementById("admin-password").value = "";
    
    // Zresetuj zalogowanego użytkownika
    loggedInUser = null;
    
    showNotification("Wylogowano pomyślnie", 'success');
  }, 500);
}

async function downloadWordMailMerge() {
  const button = document.querySelector('.accent-btn');
  try {
    button.innerHTML = '<span class="loader"></span> Przygotowywanie...';
    button.disabled = true;

    const response = await fetch(`https://bestemcatering.onrender.com/admin/orders/word_mailmerge?admin_username=${encodeURIComponent(loggedInUser)}`);
    
    if (!response.ok) {
      throw new Error("Błąd podczas generowania raportu");
    }

    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1] 
      : `raport_korespondencja_${new Date().toISOString().slice(0,10)}.docx`;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showNotification("Plik do korespondencji seryjnej został pobrany", "success");
  } catch (error) {
    console.error("Błąd pobierania:", error);
    showNotification(error.message, "error");
  } finally {
    button.innerHTML = 'Pobierz do Word (korespondencja)';
    button.disabled = false;
  }
}

async function updateLoginMessage() {
  const messageText = document.getElementById('messageText').value.trim();
  if (!messageText) {
    alert("Wpisz komunikat");
    return;
  }
  try {
    const response = await fetch('https://bestemcatering.onrender.com/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: messageText }),
    });
    if (!response.ok) throw new Error('Błąd zapisu');
    document.getElementById('saveMsg').textContent = "Komunikat zapisany";
    fetchCurrentMessage();  // odśwież aktualny komunikat obok
  } catch (error) {
    document.getElementById('saveMsg').style.color = 'red';
    document.getElementById('saveMsg').textContent = "Błąd podczas zapisu";
    console.error(error);
  }
}


async function updateLoginMessage() {
  const messageText = document.getElementById('messageText').value;

  try {
    const response = await fetch('https://bestemcatering.onrender.com/messages', {
      method: 'PUT', // lub 'POST', jeśli Twój backend tak obsługuje
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: messageText }),
    });

    if (!response.ok) throw new Error('Błąd podczas zapisywania wiadomości');

    document.getElementById('saveMsg').textContent = 'Komunikat został zapisany.';
    
    // === ODŚWIEŻ KOMUNIKAT NA STRONIE PO ZAPISIE ===
    await fetchCurrentMessage();

    setTimeout(() => {
      document.getElementById('saveMsg').textContent = '';
    }, 3000);

  } catch (error) {
    console.error(error);
    document.getElementById('saveMsg').textContent = 'Błąd podczas zapisywania komunikatu.';
    setTimeout(() => {
      document.getElementById('saveMsg').textContent = '';
    }, 3000);
  }
}

async function fetchCurrentMessage() {
  try {
    const response = await fetch('https://bestemcatering.onrender.com/messages');
    if (!response.ok) {
      throw new Error(`Błąd sieci: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    document.getElementById('currentMessage').textContent = data.text || "(Brak komunikatu)";
  } catch (error) {
    document.getElementById('currentMessage').textContent = `Nie udało się pobrać komunikatu: ${error.message}`;
    console.error(error);
  }
}


// Wywołaj tę funkcję przy załadowaniu strony:
window.addEventListener('DOMContentLoaded', () => {
  fetchCurrentMessage();
});


