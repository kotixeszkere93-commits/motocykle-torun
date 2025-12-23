function loadRanking() {
  db.collection('users')
    .orderBy('score', 'desc')
    .limit(20)
    .onSnapshot(snapshot => {
      const container = document.getElementById('ranking');
      container.innerHTML = "";
      let pos = 1;

      snapshot.forEach(doc => {
        const u = doc.data();
        const div = document.createElement('div');
        div.className = 'rank-item';
        const isMe = currentUser && doc.id === currentUser.uid;
        div.innerHTML = `
          <span>${pos}. ${u.name} – ${u.bike} ${isMe ? '<span class="badge-me">(Ty)</span>' : ''}</span>
          <span>${u.score || 0} pkt</span>
        `;
        container.appendChild(div);
        pos++;
      });

      if (snapshot.empty) {
        container.innerHTML = "<p>Brak użytkowników w rankingu.</p>";
      }
    });
}

function clearRankingUI() {
  const container = document.getElementById('ranking');
  container.innerHTML = "<p>Zaloguj się, aby zobaczyć ranking.</p>";
}
