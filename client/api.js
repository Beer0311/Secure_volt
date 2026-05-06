const BASE_AUTH = "http://localhost:5001/api/auth";
const BASE_DATA = "http://localhost:5001/api/data";

let sessionPassword = null;

// UI Helpers
function updateFileName(input) {
  const display = document.getElementById("file-name-display");
  if (input.files && input.files[0]) {
    display.textContent = input.files[0].name;
  } else {
    display.textContent = "Choose Image or PDF...";
  }
}

function openModal(src) {
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-image");
  modalImg.src = src;
  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("image-modal");
  modal.classList.add("hidden");
  setTimeout(() => {
    document.getElementById("modal-image").src = "";
  }, 300);
}

function showMessage(msg, isError = false) {
  const msgEl = document.getElementById("auth-message");
  msgEl.textContent = msg;
  msgEl.className = "message " + (isError ? "error" : "success");
  setTimeout(() => {
    msgEl.style.display = 'none';
    msgEl.className = "message"; // reset
  }, 5000);
}

function switchTab(tab) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  
  if (tab === 'login') {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
  }
}

function showDashboard() {
  document.getElementById("auth-card").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.querySelector(".container").classList.add("wide");
  loadSecrets();
}

function logout() {
  localStorage.removeItem("token");
  sessionPassword = null;
  document.querySelector(".container").classList.remove("wide");
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("auth-card").classList.remove("hidden");
  document.getElementById("login-password").value = '';
  document.getElementById("secrets-list").innerHTML = '';
}

// API Calls - Auth
async function register() {
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const btn = document.getElementById("btn-register");
  
  btn.disabled = true;
  btn.textContent = "Creating...";

  try {
    const res = await fetch(BASE_AUTH + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    
    if (res.ok) {
      showMessage(data.message, false);
      switchTab('login');
      document.getElementById("login-email").value = email;
      document.getElementById("register-password").value = '';
    } else {
      showMessage(data.error || "Registration failed", true);
    }
  } catch (err) {
    showMessage("Network error. Is the server running?", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

async function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");

  btn.disabled = true;
  btn.textContent = "Signing In...";

  try {
    const res = await fetch(BASE_AUTH + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("token", data.token);
      sessionPassword = password; // Keep password in memory for encryption
      showDashboard();
    } else {
      showMessage(data.error || "Login failed", true);
    }
  } catch (err) {
    showMessage("Network error. Is the server running?", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

// API Calls - Vault Data
async function loadSecrets() {
  const listEl = document.getElementById("secrets-list");
  listEl.innerHTML = "<p>Loading secrets...</p>";

  try {
    const res = await fetch(BASE_DATA, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();

    listEl.innerHTML = "";
    if (data.length === 0) {
      listEl.innerHTML = "<p style='color: var(--text-secondary); text-align: center;'>No secrets found.</p>";
      return;
    }

    for (const secret of data) {
      // Decrypt using crypto.js
      const decrypted = await decryptText(secret.encryptedData, secret.iv, sessionPassword);
      
      let contentHtml = "";
      if (secret.type === 'image') {
        contentHtml = `<img src="${decrypted}" alt="Encrypted Image" onclick="openModal(this.src)" />`;
      } else if (secret.type === 'document') {
        let decFileName = "document.pdf";
        if (secret.encryptedFileName && secret.fileNameIv) {
          decFileName = await decryptText(secret.encryptedFileName, secret.fileNameIv, sessionPassword);
        }
        contentHtml = `<a href="${decrypted}" download="${decFileName}" class="btn-download">Download ${decFileName}</a>`;
      } else {
        contentHtml = decrypted;
      }

      const item = document.createElement("div");
      item.className = "secret-item";
      item.innerHTML = `
        <div class="secret-content">${contentHtml}</div>
        <button class="btn-delete" onclick="deleteSecret('${secret._id}')">Delete</button>
      `;
      listEl.appendChild(item);
    }

  } catch (err) {
    listEl.innerHTML = "<p class='error'>Failed to load secrets. Session expired?</p>";
    console.error(err);
  }
}

async function saveSecret() {
  const input = document.getElementById("new-secret");
  const text = input.value.trim();
  if (!text) return;

  const btn = document.getElementById("btn-save-secret");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    // Encrypt the text using crypto.js BEFORE sending to server
    const { encryptedData, iv } = await encryptText(text, sessionPassword);

    const res = await fetch(BASE_DATA, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ encryptedData, iv })
    });

    if (res.ok) {
      input.value = "";
      loadSecrets(); // Reload list
    } else {
      alert("Failed to save secret");
    }
  } catch (err) {
    console.error(err);
    alert("Encryption or network error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Text";
  }
}

async function saveFile() {
  const fileInput = document.getElementById("new-file");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a file first");
    return;
  }

  // Check file size limit (approx 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert("File is too large. Please select a file under 10MB.");
    return;
  }

  let type = file.type.startsWith('image/') ? 'image' : 'document';

  const btn = document.getElementById("btn-save-file");
  btn.disabled = true;
  btn.textContent = "Encrypting...";

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      
      // Encrypt the Data URL string using crypto.js
      const { encryptedData, iv } = await encryptText(dataUrl, sessionPassword);
      
      let payload = { encryptedData, iv, type };

      // If document, encrypt the filename too
      if (type === 'document') {
        const encryptedNameObj = await encryptText(file.name, sessionPassword);
        payload.encryptedFileName = encryptedNameObj.encryptedData;
        payload.fileNameIv = encryptedNameObj.iv;
      }
      
      btn.textContent = "Uploading...";

      const res = await fetch(BASE_DATA, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fileInput.value = "";
        document.getElementById("file-name-display").textContent = "Choose Image or PDF...";
        loadSecrets(); // Reload list
      } else {
        alert("Failed to save encrypted file");
      }
      
      btn.disabled = false;
      btn.textContent = "Upload File";
    };
    reader.onerror = () => {
      alert("Error reading file");
      btn.disabled = false;
      btn.textContent = "Upload File";
    };
    
    reader.readAsDataURL(file);
    
  } catch (err) {
    console.error(err);
    alert("Encryption or network error");
    btn.disabled = false;
    btn.textContent = "Upload File";
  }
}

async function deleteSecret(id) {
  if (!confirm("Are you sure you want to delete this secret?")) return;

  try {
    const res = await fetch(`${BASE_DATA}/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (res.ok) {
      loadSecrets(); // Reload list
    } else {
      alert("Failed to delete");
    }
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
}

// Initial check (Note: if user refreshes, they lose sessionPassword, so they must log in again)
if (localStorage.getItem("token")) {
  // If we have a token but no password in memory, we can't decrypt anything.
  // So we just clear the token and force login.
  logout();
}