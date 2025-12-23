let currentUser = null;
let currentUserProfile = null;

// Funkcje modala auth
function openAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('authMessage').innerText = '';
}

// Rejestracja
async function register() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const bike = document.getElementById('authBike').value.trim();
  const msg = document.getElementById('authMessage');

  if (!email || !password || !name || !bike) {
    msg.innerText = "Uzupełnij wszystkie pola.";
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await db.collection('users').doc(uid).set({
      name,
      bike,
      email,
      score: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msg.innerText = "Rejestracja udana. Zalogowano.";
  } catch (e) {
    msg.innerText = e.message;
  }
}

// Logowanie
async function login() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const msg = document.getElementById('authMessage');

  if (!email || !password) {
    msg.innerText = "Podaj email i hasło.";
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    msg.innerText = "Zalogowano.";
    setTimeout(closeAuthModal, 700);
  } catch (e) {
    msg.innerText = e.message;
  }
}

// Wylogowanie
function logout() {
  auth.signOut();
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    const doc = await db.collection('users').doc(user.uid).get();
    currentUserProfile = doc.exists ? doc.data() : null;
  } else {
    currentUserProfile = null;
  }
  updateUserInfoUI();
  if (user) {
    subscribeRoutes();
    loadRanking();
  } else {
    clearRoutesUI();
    clearRankingUI();
  }
});

function updateUserInfoUI() {
  const userInfo = document.getElementById('userInfo');
  const authButtons = document.getElementById('authButtons');

  if (currentUser && currentUserProfile) {
    userInfo.innerHTML = `
      <p><strong>${currentUserProfile.name} – ${currentUserProfile.bike}</strong></p>
      <p>Punkty: ${currentUserProfile.score || 0}</p>
      <button class="btn secondary" onclick="logout()">Wyloguj</button>
    `;
    authButtons.style.display = 'none';
  } else {
    userInfo.innerHTML = `<p>Nie jesteś zalogowany.</p>`;
    authButtons.style.display = 'block';
  }
}
