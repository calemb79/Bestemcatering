let loggedInUser = "";
let userOrders = [];
let isHistoryVisible = false;
let homeOrders = [];
let isHomeOrderSectionVisible = false;
let cartMeals = [];


window.login = async function() {
  const login = document.getElementById("login").value;
  const password = document.getElementById("password").value;

  const loginBtn = document.querySelector('#login-section button');
  loginBtn.innerHTML = '<span class="loader"></span> Logowanie...';
  loginBtn.disabled = true;

  try {
    const res = await fetch("https://bestemcatering.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: login, password: password })
    });

    if (res.ok) {
      const data = await res.json();
      loggedInUser = data.username;
      
      document.getElementById("login-section").classList.add('animate__animated', 'animate__fadeOut');
      
      setTimeout(() => {
        document.getElementById("login-section").style.display = "none";
        
        document.getElementById("user-name").textContent = loggedInUser;
        document.getElementById("user-id").textContent = data.user_code || 'Brak kodu';
        
        document.getElementById("user-panel").style.display = "block";
fetchCurrentWeekAndDisplay().then(updateOrderSummary);
document.getElementById("order-week").addEventListener("change", updateOrderSummary);
        document.getElementById("user-panel").classList.add('animate__animated', 'animate__fadeInUp');
if (document.getElementById('order-week').value) {
  updateWeekCalendar(document.getElementById('order-week').value);
}
        
        document.querySelector(".logout-btn").style.display = "flex";
	window.dispatchEvent(new Event('userLoggedIn'));
        document.querySelector(".logout-btn").classList.add('animate__animated', 'animate__fadeIn');
        
        loadMenu();
        loadOrderHistory();
      }, 500);
    } else {
      throw new Error("Błędny login lub hasło");
    }
  } catch (error) {
    document.getElementById("login-section").classList.add('animate__animated', 'animate__shakeX');
    setTimeout(() => {
      document.getElementById("login-section").classList.remove('animate__animated', 'animate__shakeX');
    }, 1000);
    
    alert(error.message);
  } finally {
    loginBtn.innerHTML = 'Zaloguj';
    loginBtn.disabled = false;
  }
}

async function loadOrderHistory() {
  try {
    const res = await fetch(`https://bestemcatering.onrender.com/order/history?username=${loggedInUser}`);
    userOrders = await res.json();
    await 
    updateOrderSummary();
  } catch (error) {
    console.error("Błąd ładowania historii:", error);
  }
}

function updateOrderSummary() {
  const summaryElement = document.getElementById("order-summary");
  const deductionInfo = document.getElementById("deduction-info");
  
  // Grupuj zamówienia według tygodni
  const ordersByWeek = {};
  userOrders.forEach(order => {
    if (!ordersByWeek[order.week]) {
      ordersByWeek[order.week] = [];
    }
    ordersByWeek[order.week].push(order);
  });

  let summaryHTML = '';
  let deductionHTML = '';
  
  // Przetwarzaj każdy tydzień osobno
  for (const week in ordersByWeek) {
    let weekTotal = 0;
    
    ordersByWeek[week].forEach(order => {
      order.meals.forEach(meal => {
        weekTotal += parseFloat(meal.price);
      });
    });
    
    // Dodaj podsumowanie dla tygodnia
    summaryHTML += `<div class="week-summary">
      <strong>${week}:</strong> ${weekTotal.toFixed(2)} zł
    </div>`;
    
    // Sprawdź przekroczenie dofinansowania dla tygodnia
    if (weekTotal > 55) {
      const difference = weekTotal - 55;
      deductionHTML += `<div class="week-deduction">
        <strong>${week}:</strong> Przekroczenie o ${difference.toFixed(2)} zł
      </div>`;
    }
  }
  
  // Jeśli nie ma zamówień, pokaż domyślny tekst
  if (summaryHTML === '') {
    summaryHTML = 'Suma tygodniowych zamówień: 0.00 zł';
  }
  
  // Aktualizuj elementy DOM
  summaryElement.innerHTML = summaryHTML;
  
  if (deductionHTML !== '') {
    deductionInfo.innerHTML = deductionHTML;
    deductionInfo.style.display = "block";
    deductionInfo.classList.add('animate__animated', 'animate__pulse');
  } else {
    deductionInfo.style.display = "none";
    deductionInfo.classList.remove('animate__animated', 'animate__pulse');
  }
}

function updateOrderPreview() {
  const selects = document.querySelectorAll("#menu-container select");
  let total = 0;
  let hasSelection = false;
  
  selects.forEach(select => {
    if (select.value) {
      const { price } = JSON.parse(select.value);
      total += parseFloat(price);
      hasSelection = true;
    }
  });
  
  const preview = document.getElementById("order-preview");
  preview.textContent = `Suma zamówienia: ${total.toFixed(2)} zł`;
  
  if (hasSelection) {
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
  }
  
  // Animacja
  preview.classList.add('animate__animated', 'animate__pulse');
  setTimeout(() => {
    preview.classList.remove('animate__animated', 'animate__pulse');
  }, 500);
}

async function loadMenu() {
  try {
    const res = await fetch("https://bestemcatering.onrender.com/menu/list");
    const menuItems = await res.json();

    const days = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
    const container = document.getElementById("menu-container");
    container.innerHTML = "";

    days.forEach((day, index) => {
      const groupDiv = document.createElement("div");
      groupDiv.classList.add('menu-group', 'animate__animated', 'animate__fadeIn');
      groupDiv.style.animationDelay = `${index * 0.1}s`;

      const label = document.createElement("label");
      label.textContent = `${day}:`;

      const select = document.createElement("select");
      select.name = day;
      select.classList.add('ripple');
      select.addEventListener('change', function() {
        if (this.value) {
          animateMealToCart(day, this.value, this);
        }
      });

      const defaultOption = document.createElement("option");
      defaultOption.text = "Wybierz danie";
      defaultOption.value = "";
      select.appendChild(defaultOption);

      const dayMenuItems = menuItems.filter(item => item.day === day);
      
      dayMenuItems.forEach(item => {
        const option = document.createElement("option");
        option.value = JSON.stringify({ name: item.name, price: item.price });
        option.text = `${item.name} (${item.price.toFixed(2)} zł)`;
        select.appendChild(option);
      });

      groupDiv.appendChild(label);
      groupDiv.appendChild(select);
      container.appendChild(groupDiv);
    });
    
    // TUTAJ NIE WYWOŁUJEMY JUŻ updateOrderPreview()
  } catch (error) {
    console.error("Błąd ładowania menu:", error);
  }
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
	updateWeekCalendar(week);

  } catch (err) {
    console.error("Błąd pobierania tygodnia:", err);
  }
}


async function submitOrder() {
  const week = await fetchCurrentWeek();
  const deliveryLocation = document.getElementById("delivery-location").value;
  const shift = document.getElementById("shift").value; // Pobierz wartość zmiany
  const selects = document.querySelectorAll("#menu-container select");

  if (!week) {
    showError("Proszę wybrać tydzień zamówienia!");
    return;
  }
  
  if (hasExistingOrderForWeek(week)) {
    showError("Zamówienie na ten tydzień zostało już złożone. !SPRAWDŹ HISTORIĘ ZAMÓWIEŃ!");
    return;
  }  
  
  if (!deliveryLocation) {
    showError("Proszę wybrać miejsce dostawy!");
    return;
  }

  if (!shift) {
    showError("Proszę wybrać zmianę!");
    return;
  }

  const meals = {};
  let hasMeals = false;

  selects.forEach(select => {
    if (select.value) {
      const { name, price } = JSON.parse(select.value);
      meals[select.name] = [{ name, price, day: select.name }];
      hasMeals = true;
    }
  });

  if (!hasMeals) {
    showError("Proszę wybrać przynajmniej jedno danie!");
    return;
  }

  const payload = {
    username: loggedInUser,
    week: week,
    date_range: deliveryLocation,
    shift: shift, // Dodajemy wybraną zmianę
    meals: meals
  };

  const submitBtn = document.querySelector('#user-panel button[onclick="submitOrder()"]');
  submitBtn.innerHTML = '<span class="loader"></span> Przetwarzanie...';
  submitBtn.disabled = true;

  try {
    const response = await fetch("https://bestemcatering.onrender.com/order/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      showSuccess("Zamówienie złożone pomyślnie i jest już widoczne w histroii zamówień! ");
      loadOrderHistory();
      
      // Reset formularza
      document.getElementById('order-week').value = '';
      document.getElementById('week-calendar').style.display = 'none'; // Dodaj tę linijkę
      document.getElementById('delivery-location').value = '';
      selects.forEach(select => {
        select.value = '';
        select.classList.add('animate__animated', 'animate__flash');
        setTimeout(() => {
          select.classList.remove('animate__animated', 'animate__flash');
        }, 1000);
      });
      
      updateOrderPreview();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Nie udało się złożyć zamówienia");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.innerHTML = 'Złóż zamówienie';
    submitBtn.disabled = false;
  }
}


async function fetchCurrentWeek() {
  try {
    const response = await fetch("https://bestemcatering.onrender.com/current_week");
    if (!response.ok) throw new Error("Brak ustawionego tygodnia");
    const data = await response.json();
    return data.week;
  } catch (error) {
    console.error("Błąd pobierania tygodnia:", error);
    return "Nie ustawiono";
  }
}


async function toggleHistory() {
  const button = document.getElementById("toggle-history");
  const container = document.getElementById("order-history");

  button.innerHTML = '<span class="loader"></span> Ładowanie...';
  button.disabled = true;

  try {
    if (!isHistoryVisible) {
      const res = await fetch(`https://bestemcatering.onrender.com/order/history?username=${loggedInUser}`);
      userOrders = await res.json();
      updateOrderSummary();

      container.innerHTML = "";
      container.classList.add('animate__animated', 'animate__fadeIn');

if (userOrders.length > 0) {
  const header = document.createElement('h4');
  header.textContent = 'Twoje zamówienia:';
  header.style.marginBottom = '15px';
  header.style.color = 'var(--secondary)';
  container.appendChild(header);
}
      
      userOrders.forEach((order, index) => {
        const div = document.createElement("div");
        div.classList.add('order-item', 'animate__animated', 'animate__fadeIn');
        
        // Dodaj klasę w zależności od typu zamówienia
        if (order.week === "Domowe") {
          div.classList.add('home-order');
        } else {
          div.classList.add('work-order');
        }
        
        div.style.animationDelay = `${index * 0.1}s`;
        
        // Dodaj ikonę w zależności od typu zamówienia
        const icon = order.week === "Domowe" ? 
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' : 
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>';
        
        div.innerHTML = `
          <div class="order-header">
            ${icon}
            <strong>Tydzień:</strong> ${order.week} 
            ${order.date_range ? `(${order.date_range})` : ''}<br>
            ${order.shift ? `<strong>Zmiana:</strong> ${order.shift}` : ''}
          </div>
          <div class="order-meals">
            <strong>Zamówione posiłki:</strong>
            <ul>
              ${order.meals.map(meal => `<li>${meal.day}: ${meal.name} (${meal.price} zł)</li>`).join("")}
            </ul>
          </div>
          <hr class="order-divider">
        `;
        container.appendChild(div);
      });

      button.textContent = "Ukryj historię";
      isHistoryVisible = true;
    } else {
      container.classList.add('animate__animated', 'animate__fadeOut');
      setTimeout(() => {
        container.innerHTML = "";
        container.classList.remove('animate__animated', 'animate__fadeOut');
      }, 500);
      button.textContent = "Pokaż historię";
      isHistoryVisible = false;
    }
  } catch (error) {
    console.error("Błąd ładowania historii:", error);
    showError("Nie udało się załadować historii zamówień");
  } finally {
    button.disabled = false;
    button.innerHTML = isHistoryVisible ? "Ukryj historię" : "Pokaż historię";
  }
}

function logout() {
    document.getElementById("user-panel").classList.add('animate__animated', 'animate__fadeOut');
    document.getElementById("order-summary-section").classList.add('animate__animated', 'animate__fadeOut');
    document.querySelectorAll(".logout-btn").forEach(btn => {
        btn.classList.add('animate__animated', 'animate__fadeOut');
    });
    
    setTimeout(() => {
        loggedInUser = "";
        isHistoryVisible = false;
        userOrders = [];
        cartMeals = [];

        document.getElementById("login-section").style.display = "block";
        document.getElementById("login-section").classList.add('animate__animated', 'animate__fadeIn');
        document.getElementById("user-panel").style.display = "none";
        document.getElementById("order-summary-section").style.display = "none";
        document.getElementById("user-panel").classList.remove('animate__animated', 'animate__fadeOut');
        document.getElementById("order-summary-section").classList.remove('animate__animated', 'animate__fadeOut');
        document.querySelectorAll(".logout-btn").forEach(btn => {
            btn.style.display = "none";
        });

        document.getElementById("login").value = "";
        document.getElementById("password").value = "";

        document.getElementById("user-name").textContent = "";
        document.getElementById("menu-container").innerHTML = "";
        document.getElementById("order-history").innerHTML = "";
        document.getElementById("order-summary").textContent = "Suma zamówień: 0.00 zł";
        document.getElementById("deduction-info").style.display = "none";

        fetch("https://bestemcatering.onrender.com/logout", { 
            method: "POST",
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => {
                showSuccess("Wylogowano pomyślnie");
            })
            .catch(error => showError("Błąd wylogowania"));

    }, 500);
}

function showAddingToCartMessage() {
  const msg = document.createElement("div");
  msg.className = "adding-to-cart-message";
  msg.textContent = "Dodawanie dania do koszyka...";
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.remove();
  }, 1500); // usunięcie po 1,5 sekundy
}


function showError(message) {
  // 1. Wrapper do centrowania
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  // 2. Wewnętrzny box z treścią i animacją
  const errorDiv = document.createElement('div');
  errorDiv.className = 'message-box error animate__animated animate__fadeIn';
  
  errorDiv.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <span>${message}</span>
  `;
  
  // 3. Złożenie i dodanie do body
  wrapper.appendChild(errorDiv);
  document.body.appendChild(wrapper);
  
  // 4. Usunięcie po czasie
  setTimeout(() => {
    errorDiv.classList.remove('animate__fadeIn');
    errorDiv.classList.add('animate__fadeOut');
    errorDiv.addEventListener('animationend', () => {
        wrapper.remove(); // Usuwamy cały wrapper
    }, { once: true });
  }, 3000);
}

function showSuccess(message) {
  // 1. Wrapper do centrowania
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';
  
  // 2. Wewnętrzny box z treścią i animacją
  const successDiv = document.createElement('div');
  successDiv.className = 'message-box success animate__animated animate__fadeIn';
  
  successDiv.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;
  
  // 3. Złożenie i dodanie do body
  wrapper.appendChild(successDiv);
  document.body.appendChild(wrapper);
  
  // 4. Usunięcie po czasie
  setTimeout(() => {
    successDiv.classList.remove('animate__fadeIn');
    successDiv.classList.add('animate__fadeOut');
    successDiv.addEventListener('animationend', () => {
        wrapper.remove(); // Usuwamy cały wrapper
    }, { once: true });
  }, 4000);
}

const style = document.createElement('style');
style.textContent = `
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
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

function updateWeekCalendar(weekString) {
  const calendar = document.getElementById('week-calendar');
  calendar.innerHTML = '';
  
  if (!weekString || !weekString.includes('-W')) {
    calendar.style.display = 'none';
    return;
  }
  
  try {
    calendar.style.display = 'grid';
    
    const [year, weekNum] = weekString.split('-W').map(Number);
    
    // Oblicz datę dla pierwszego dnia tygodnia (poniedziałek)
    const date = new Date(year, 0, 1 + (weekNum - 1) * 7);
    while (date.getDay() !== 1) {
      date.setDate(date.getDate() - 1);
    }
    
    const days = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
    
    for (let i = 0; i < 7; i++) {
      // Nagłówek dnia
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = days[i];
      calendar.appendChild(dayHeader);
      
      // Dzień z datą
      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      dayElement.textContent = date.getDate();
      calendar.appendChild(dayElement);
      
      date.setDate(date.getDate() + 1);
    }
  } catch (error) {
    console.error("Błąd generowania kalendarza:", error);
    calendar.style.display = 'none';
  }
}

async function checkOrderExists(username, week) {
  const url = `/order/exists?username=${encodeURIComponent(username)}&week=${week}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Błąd podczas sprawdzania zamówienia");
    return false;
  }
  const data = await response.json();
  return data.exists;
}

document.addEventListener('DOMContentLoaded', function() {
  fetchLoginMessage();
  
  // Dodajemy nasłuchiwanie po zalogowaniu, a nie od razu
  window.addEventListener('userLoggedIn', function() {
    const orderForm = document.getElementById("orderForm");
    if (orderForm) {
      orderForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const week = document.getElementById("order-week").value;
        
        if (await checkOrderExists(loggedInUser, week)) {
          document.getElementById("orderExistsMessage").style.display = "block";
          disableForm();
          return;
        }
        
        await submitOrder();
      });
    }
  });
});

function disableForm() {
  const form = document.getElementById("orderForm");
  if (form) {
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
      elements[i].disabled = true;
    }
  }
}

function hasExistingOrderForWeek(week) {
  return userOrders.some(order => order.week === week);
}

async function fetchLoginMessage() {
  const messageElement = document.getElementById("loginMessage");
  
  try {
    const response = await fetch("https://bestemcatering.onrender.com/messages");
    
    if (!response.ok) {
      throw new Error(`Błąd HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Ustawiamy tylko wiadomość z bazy danych
    if (data.text) {
      messageElement.textContent = data.text;
      
      // Dodajemy efekt pulsowania co 3 sekund
      setInterval(() => {
        messageElement.classList.add('animate__animated', 'animate__pulse');
        setTimeout(() => {
          messageElement.classList.remove('animate__animated', 'animate__pulse');
        }, 1000);
      }, 3000);
    }
    
  } catch (error) {
    console.error("Błąd pobierania wiadomości:", error);
    // W przypadku błędu pozostawiamy element pusty (bez domyślnego tekstu)
    messageElement.style.display = 'none';
  }
}

// Add these new functions
function showHomeOrderSection() {
  document.getElementById("user-panel").style.display = "none";
  document.getElementById("home-order-section").style.display = "block";
  isHomeOrderSectionVisible = true;
  loadHomeMenu();
  loadHomeOrderHistory();
}

function hideHomeOrderSection() {
  document.getElementById("home-order-section").style.display = "none";
  document.getElementById("user-panel").style.display = "block";
fetchCurrentWeekAndDisplay().then(updateOrderSummary);
document.getElementById("order-week").addEventListener("change", updateOrderSummary);
  isHomeOrderSectionVisible = false;
}

async function loadHomeMenu() {
  try {
    const res = await fetch("https://bestemcatering.onrender.com/menu/list");
    const menuItems = await res.json();

    const days = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
    const container = document.getElementById("home-menu-container");
    container.innerHTML = "";

    days.forEach((day, index) => {
      const groupDiv = document.createElement("div");
      groupDiv.classList.add('menu-group', 'animate__animated', 'animate__fadeIn');
      groupDiv.style.animationDelay = `${index * 0.1}s`;

      const label = document.createElement("label");
      label.textContent = `${day}:`;

      const select = document.createElement("select");
      select.name = day;
      select.classList.add('ripple');
      select.addEventListener('change', updateHomeOrderPreview);

      const defaultOption = document.createElement("option");
      defaultOption.text = "Wybierz danie";
      defaultOption.value = "";
      select.appendChild(defaultOption);

      const dayMenuItems = menuItems.filter(item => item.day === day);
      
      dayMenuItems.forEach(item => {
        const option = document.createElement("option");
        option.value = JSON.stringify({ name: item.name, price: item.price });
        option.text = `${item.name} (${item.price.toFixed(2)} zł)`;
        select.appendChild(option);
      });

      groupDiv.appendChild(label);
      groupDiv.appendChild(select);
      container.appendChild(groupDiv);
    });
    
    updateHomeOrderPreview();
  } catch (error) {
    console.error("Błąd ładowania menu domowego:", error);
  }
}

function updateHomeOrderPreview() {
  const selects = document.querySelectorAll("#home-menu-container select");
  let total = 0;
  let hasSelection = false;
  
  selects.forEach(select => {
    if (select.value) {
      const { price } = JSON.parse(select.value);
      total += parseFloat(price);
      hasSelection = true;
    }
  });
  
  const preview = document.getElementById("home-order-preview");
  preview.textContent = `Suma zamówienia domowego: ${total.toFixed(2)} zł`;
  
  if (hasSelection) {
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
  }
  
  preview.classList.add('animate__animated', 'animate__pulse');
  setTimeout(() => {
    preview.classList.remove('animate__animated', 'animate__pulse');
  }, 500);
}

async function submitHomeOrder() {
  const selects = document.querySelectorAll("#home-menu-container select");
  
  const meals = {};
  let hasMeals = false;

  selects.forEach(select => {
    if (select.value) {
      const { name, price } = JSON.parse(select.value);
      meals[select.name] = [{ name, price, day: select.name }];
      hasMeals = true;
    }
  });

  if (!hasMeals) {
    showError("Proszę wybrać przynajmniej jedno danie!");
    return;
  }

  const payload = {
    username: loggedInUser,
    week: "Domowe",
    date_range: "Dom",
    shift: "Domowa",
    meals: meals
  };

  const submitBtn = document.querySelector('#home-order-section button[onclick="submitHomeOrder()"]');
  submitBtn.innerHTML = '<span class="loader"></span> Przetwarzanie...';
  submitBtn.disabled = true;

  try {
    const response = await fetch("https://bestemcatering.onrender.com/order/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      showSuccess("Zamówienie domowe złożone pomyślnie!");
      loadHomeOrderHistory();
      
      // Reset formularza
      selects.forEach(select => {
        select.value = '';
        select.classList.add('animate__animated', 'animate__flash');
        setTimeout(() => {
          select.classList.remove('animate__animated', 'animate__flash');
        }, 1000);
      });
      
      updateHomeOrderPreview();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Nie udało się złożyć zamówienia domowego");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.innerHTML = 'Złóż zamówienie domowe';
    submitBtn.disabled = false;
  }
}

async function loadHomeOrderHistory() {
  try {
    const res = await fetch(`https://bestemcatering.onrender.com/order/history?username=${loggedInUser}`);
    const allOrders = await res.json();

    console.log(allOrders);  // <-- Dodaj to by sprawdzić dane z serwera

    // Zmieniamy filtrację na date_range
    homeOrders = allOrders.filter(order => order.date_range === "Dom");

    const container = document.getElementById("home-order-history");
    container.innerHTML = "";

    if (homeOrders.length === 0) {
      container.innerHTML = "<p>Brak zamówień domowych.</p>";
      return;
    }

    homeOrders.forEach((order, index) => {
      const div = document.createElement("div");
      div.classList.add('order-item', 'home-order', 'animate__animated', 'animate__fadeIn');
      div.style.animationDelay = `${index * 0.1}s`;

      const icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>`;

      div.innerHTML = `
        <div class="order-header">
          ${icon}
          <strong>Tydzień:</strong> ${order.week} 
          ${order.date_range ? `(${order.date_range})` : ''}<br>
          ${order.shift ? `<strong>Zmiana:</strong> ${order.shift}` : ''}
        </div>
        <div class="order-meals">
          <strong>Zamówione posiłki:</strong>
          <ul>
            ${order.meals.map(meal => `<li>${meal.day}: ${meal.name} (${meal.price} zł)</li>`).join("")}
          </ul>
        </div>
        <hr class="order-divider">
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error("Błąd ładowania historii zamówień domowych:", error);
  }
}

function addMealToCart(day, mealData) {
    const { name, price } = JSON.parse(mealData);
    const existingMealIndex = cartMeals.findIndex(meal => meal.day === day);
    
    if (existingMealIndex > -1) {
        cartMeals[existingMealIndex] = { day, name, price };
    } else {
        cartMeals.push({ day, name, price });
    }
    
    updateCartDisplay();
}

function updateCartDisplay(isSummaryPage = false) {
  const cartContent = document.getElementById("cart-content");

  if (cartMeals.length === 0) {
    cartContent.innerHTML = "<p>Koszyk jest pusty</p>";
    document.getElementById("summary-btn").disabled = true;
    document.getElementById("submit-cart-btn").style.display = "none";
    const cartHeader = document.querySelector("#order-cart h4");
    if (cartHeader) {
      cartHeader.innerHTML = "Aktualne zamówienie";
    }
    return;
  }

  // Grupowanie identycznych dań wg dnia i nazwy
  const groupedMeals = {};
  cartMeals.forEach(meal => {
    const key = `${meal.day}-${meal.name}`;
    if (!groupedMeals[key]) {
      groupedMeals[key] = { ...meal, count: 0 };
    }
    groupedMeals[key].count++;
  });

  const mealsList = Object.values(groupedMeals);
  let total = mealsList.reduce((sum, meal) => sum + parseFloat(meal.price) * meal.count, 0);

  // Aktualizacja tekstu obok nagłówka
const totalPriceElement = document.getElementById("cart-total-price");
if (totalPriceElement) {
    totalPriceElement.textContent = total.toFixed(2);
}


  cartContent.innerHTML = `
    <ul style="margin-top: 10px;">
      ${mealsList.map((meal, index) => `
        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span><strong>${meal.day}:</strong> ${meal.name} (${meal.price} zł)</span>
          ${isSummaryPage ? `<button onclick="removeMealFromCart(${index})" class="delete-btn-custom">Usuń</button>` : ""}
        </li>
      `).join("")}
    </ul>
  `;

  document.getElementById("summary-btn").disabled = false;
  document.getElementById("submit-cart-btn").style.display = isSummaryPage ? "block" : "none";
}


function removeMealFromCart(index) {
  cartMeals.splice(index, 1);
  updateCartDisplay();
}

async function submitCartOrder() {
  const week = await fetchCurrentWeek();
  const deliveryLocation = document.getElementById("delivery-location").value;
  const shift = document.getElementById("shift").value;

  if (!week) return showError("Proszę wybrać tydzień zamówienia!");
  if (!deliveryLocation) return showError("Proszę wybrać miejsce dostawy!");
  if (!shift) return showError("Proszę wybrać zmianę!");
  if (cartMeals.length === 0) return showError("Koszyk jest pusty!");

  // 🔹 Zbierz wszystkie dni, które już mają zamówienie
  const alreadyOrderedDays = cartMeals
    .map(meal => meal.day)
    .filter((day, index, self) => self.indexOf(day) === index) // unikalne dni
    .filter(day =>
      userOrders.some(order =>
        order.week === week &&
        order.meals.some(m => m.day === day)
      )
    );

  if (alreadyOrderedDays.length > 0) {
    showWarningConfirm(
      `Zamówienie na poniższe dni zostało już przyjęte:<br><strong>${alreadyOrderedDays.join(", ")}</strong><br><br>Czy chcesz ponownie złożyć zamówienie?`,
      async () => { // ✅ Tak
        await actuallySubmitCartOrder(week, deliveryLocation, shift);
      },
      () => { // ❌ Nie
        showError("Anulowano składanie zamówienia.");
      }
    );
    return;
  }

  // Jeśli brak kolizji – składamy od razu
  await actuallySubmitCartOrder(week, deliveryLocation, shift);
}


// 🔹 Wyciągnięta logika wysyłania zamówienia
async function actuallySubmitCartOrder(week, deliveryLocation, shift) {
  const meals = {};
  cartMeals.forEach(meal => {
    if (!meals[meal.day]) meals[meal.day] = [];
    meals[meal.day].push({ name: meal.name, price: meal.price, day: meal.day });
  });

  const payload = {
    username: loggedInUser,
    week: week,
    date_range: deliveryLocation,
    shift: shift,
    meals: meals
  };

  const submitBtn = document.getElementById("submit-cart-btn"); 
  submitBtn.innerHTML = '<span class="loader"></span> Przetwarzanie...';
  submitBtn.disabled = true;

  try {
    const response = await fetch("https://bestemcatering.onrender.com/order/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      showSuccess("Zamówienie złożone pomyślnie!");
      cartMeals = [];
      updateCartDisplay();
      loadOrderHistory();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Nie udało się złożyć zamówienia");
    }
  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.innerHTML = 'Złóż zamówienie';
    submitBtn.disabled = false;
  }
}


function animateMealToCart(day, mealData, element) {
    // 🔹 1. Pokaż komunikat od razu
    showAddingToCartMessage();

    // 🔹 2. Znajdź ikonkę koszyka (cel animacji)
    const cartIcon = document.querySelector("#order-cart");
    if (!cartIcon) {
        // Jeśli nie ma koszyka — dodaj od razu
        addMealToCart(day, mealData);
        return;
    }

    // 🔹 3. Skopiuj wybrany element do animacji
    const img = document.createElement("div");
    img.textContent = "🍽️"; // Ikonka talerza — można zamienić na grafikę
    img.style.position = "fixed";
    img.style.zIndex = "2000";
    img.style.fontSize = "24px";
    img.style.pointerEvents = "none";

    const rect = element.getBoundingClientRect();
    img.style.left = `${rect.left}px`;
    img.style.top = `${rect.top}px`;
    document.body.appendChild(img);

    // 🔹 4. Pozycja celu
    const cartRect = cartIcon.getBoundingClientRect();
    const targetX = cartRect.left + cartRect.width / 2;
    const targetY = cartRect.top + cartRect.height / 2;

    // 🔹 5. Animacja lotu do koszyka
    img.animate([
        { transform: `translate(0, 0) scale(1)`, opacity: 1 },
        { transform: `translate(${targetX - rect.left}px, ${targetY - rect.top}px) scale(0.3)`, opacity: 0.5 }
    ], {
        duration: 800,
        easing: "ease-in-out"
    }).onfinish = () => {
        img.remove();

        // 🔹 6. Efekt „skoku koszyka”
        cartIcon.classList.add("cart-bounce");
        setTimeout(() => {
            cartIcon.classList.remove("cart-bounce");
        }, 300);

        // 🔹 7. Po zakończeniu animacji — faktycznie dodaj do koszyka
        addMealToCart(day, mealData);
    };
}


function showWarningConfirm(message, onConfirm, onCancel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const box = document.createElement('div');
  box.className = 'message-box warning animate__animated animate__fadeIn';
  box.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <span style="font-size: 1.1em;">${message}</span>
    <div style="display:flex; gap:10px; margin-top:15px;">
      <button id="confirm-yes" style="background-color:var(--success); color:white; border:none; padding:8px 16px; border-radius:8px;">Tak</button>
      <button id="confirm-no" style="background-color:var(--danger); color:white; border:none; padding:8px 16px; border-radius:8px;">Nie</button>
    </div>
  `;

  wrapper.appendChild(box);
  document.body.appendChild(wrapper);

  document.getElementById('confirm-yes').addEventListener('click', () => {
    wrapper.remove();
    if (onConfirm) onConfirm();
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    wrapper.remove();
    if (onCancel) onCancel();
  });
}



function showOrderSummary() {
    // Wypełnij dane w podsumowaniu
    document.getElementById("summary-week").textContent = document.getElementById("order-week").value;
    document.getElementById("summary-location").textContent = document.getElementById("delivery-location").value;
    document.getElementById("summary-shift").textContent = document.getElementById("shift").value;
    
    // Pokazujemy przycisk "Złóż zamówienie" tylko w podsumowaniu
    document.getElementById("submit-order-btn").style.display = "block";
    
    // Skopiuj zawartość koszyka do podsumowania z funkcją usuwania
    const summaryCart = document.getElementById("summary-cart");
    summaryCart.innerHTML = `
        <h4>Podsumowanie dań zamawianych na kolejny tydzień:</h4>
        <div id="summary-cart-content">
            ${cartMeals.length === 0 ? '<p>Koszyk jest pusty</p>' : `
                <ul style="margin-top: 10px;">
                    ${cartMeals.map((meal, index) => `
                        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span><strong>${meal.day}:</strong> ${meal.name} (${meal.price} zł)</span>
                            <button onclick="removeMealFromCart(${index}, true)" class="delete-btn-custom">Usuń</button>
                        </li>
                    `).join("")}
                </ul>
                <strong style="display: block; margin-top: 10px; text-align: right;">
                    Suma: ${cartMeals.reduce((sum, meal) => sum + parseFloat(meal.price), 0).toFixed(2)} zł
                </strong>
            `}
        </div>
    `;
    
    // Ukryj panel użytkownika, pokaż podsumowanie
    document.getElementById("user-panel").style.display = "none";
    document.getElementById("order-summary-section").style.display = "block";
    updateCartDisplay(true);
}

function hideOrderSummary() {
    // Ukryj podsumowanie, pokaż panel użytkownika
    document.getElementById("order-summary-section").style.display = "none";
    document.getElementById("user-panel").style.display = "block";
    fetchCurrentWeekAndDisplay().then(updateOrderSummary);
    document.getElementById("order-week").addEventListener("change", updateOrderSummary);
    
    // Ukrywamy przycisk "Złóż zamówienie" gdy wracamy do głównego panelu
    document.getElementById("submit-order-btn").style.display = "none";
    updateCartDisplay(false); 
}

// Zmodyfikowana funkcja usuwania, która działa na obu stronach
function removeMealFromCart(index, fromSummary = false) {
    cartMeals.splice(index, 1);
    
    if (fromSummary) {
        // Jeśli usuwamy z podsumowania, zaktualizuj tylko podsumowanie
        showOrderSummary();
    } else {
        // Jeśli usuwamy z głównego panelu, zaktualizuj koszyk
        updateCartDisplay(false);
    }
}