let routesUnsub = null;

// Subskrypcja tras z Firestore
function subscribeRoutes() {
  if (routesUnsub) routesUnsub();

  routesUnsub = db.collection('routes')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const list = document.getElementById('routesList');
      list.innerHTML = "";
      snapshot.forEach(doc => {
        const r = doc.data();
        const id = doc.id;
        const participantsCount = r.participants ? r.participants.length : 0;
        const suggestionsCount = r.suggestions ? r.suggestions.length : 0;

        const card = document.createElement('div');
        card.className = 'route-card';
        card.innerHTML = `
          <h4>${r.title}</h4>
          <p class="route-meta">
            <strong>Autor:</strong> ${r.authorName} – ${r.authorBike}<br>
            <strong>Dystans:</strong> ${r.distanceKm || '-'} km<br>
            <strong>Uczestnicy:</strong> ${participantsCount}
          </p>
          <p class="route-meta">
            ${r.description ? r.description : ''}
          </p>
          <div class="route-actions">
            <button class="btn" onclick="joinRoute('${id}')">Biorę udział</button>
            <button class="btn" onclick="addSuggestionPrompt('${id}')">Propozycja zmiany</button>
            <button class="btn secondary" onclick="showRouteOnMainMap('${id}')">Pokaż na mapie</button>
          </div>
          <div class="route-suggestions">
            <strong>Propozycje zmian (${suggestionsCount}):</strong>
            <ul>
              ${(r.suggestions || []).map(s => `<li><strong>${s.authorName}:</strong> ${s.text}</li>`).join('')}
            </ul>
          </div>
        `;
        list.appendChild(card);
      });

      if (snapshot.empty) {
        list.innerHTML = "<p>Brak tras. Bądź pierwszy, zaproponuj coś!</p>";
      }
    });
}

function clearRoutesUI() {
  const list = document.getElementById('routesList');
  list.innerHTML = "<p>Zaloguj się, aby zobaczyć i dodawać trasy.</p>";
  if (routesUnsub) routesUnsub();
}

// Udział w trasie
async function joinRoute(routeId) {
  if (!currentUser || !currentUserProfile) {
    alert("Musisz być zalogowany.");
    return;
  }
  const ref = db.collection('routes').doc(routeId);
  await ref.update({
    participants: firebase.firestore.FieldValue.arrayUnion({
      userId: currentUser.uid,
      name: currentUserProfile.name,
      bike: currentUserProfile.bike
    })
  });
}

// Dodawanie propozycji zmiany
function addSuggestionPrompt(routeId) {
  if (!currentUser || !currentUserProfile) {
    alert("Musisz być zalogowany.");
    return;
  }
  const text = prompt("Twoja propozycja zmiany trasy:");
  if (!text) return;
  addSuggestion(routeId, text);
}

async function addSuggestion(routeId, text) {
  const ref = db.collection('routes').doc(routeId);
  await ref.update({
    suggestions: firebase.firestore.FieldValue.arrayUnion({
      userId: currentUser.uid,
      authorName: currentUserProfile.name,
      text,
      createdAt: new Date().toISOString()
    })
  });
}

// Pokaż trasę na głównej mapie
async function showRouteOnMainMap(routeId) {
  const doc = await db.collection('routes').doc(routeId).get();
  if (!doc.exists) return;
  const r = doc.data();
  const p1 = L.latLng(r.start.lat, r.start.lng);
  const p2 = L.latLng(r.end.lat, r.end.lng);
  showRouteOnMainMapFromPoints(p1, p2, r.distanceKm);
}

// Zapis nowej trasy z modala
async function saveRoute() {
  const title = document.getElementById('routeTitle').value.trim();
  const description = document.getElementById('routeDescription').value.trim();
  const msg = document.getElementById('routeMessage');

  if (!currentUser || !currentUserProfile) {
    msg.innerText = "Musisz być zalogowany.";
    return;
  }
  if (!title) {
    msg.innerText = "Podaj nazwę trasy.";
    return;
  }
  if (!window.routeSelection || !window.routeSelection.start || !window.routeSelection.end || !window.routeSelection.distanceKm) {
    msg.innerText = "Zaznacz dwa punkty na mapie.";
    return;
  }

  const p1 = window.routeSelection.start;
  const p2 = window.routeSelection.end;
  const distance = window.routeSelection.distanceKm;

  try {
    await db.collection('routes').add({
      title,
      description,
      authorId: currentUser.uid,
      authorName: currentUserProfile.name,
      authorBike: currentUserProfile.bike,
      start: { lat: p1.lat, lng: p1.lng },
      end: { lat: p2.lat, lng: p2.lng },
      distanceKm: distance,
      participants: [],
      suggestions: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // +1 punkt do rankingu
    await db.collection('users').doc(currentUser.uid).update({
      score: firebase.firestore.FieldValue.increment(1)
    });

    // odśwież profil lokalny
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    currentUserProfile = userDoc.data();
    updateUserInfoUI();
    loadRanking();

    msg.innerText = "Trasa zapisana!";
    setTimeout(closeRouteModal, 800);
  } catch (e) {
    msg.innerText = e.message;
  }
}
