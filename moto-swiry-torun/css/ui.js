// Modale tras
function openRouteModal() {
  if (!currentUser) {
    alert("Musisz być zalogowany, aby dodać trasę.");
    return;
  }
  document.getElementById('routeModal').style.display = 'flex';
  setTimeout(initRouteMap, 50);
}

function closeRouteModal() {
  document.getElementById('routeModal').style.display = 'none';
  document.getElementById('routeTitle').value = "";
  document.getElementById('routeDescription').value = "";
  document.getElementById('routeInfo').innerText = "Dystans: -";
  document.getElementById('routeMessage').innerText = "";
  window.routeSelection = null;
  resetRouteMapSelection();
}

// Ładowanie danych motocykli
fetch("data/motorcycles.json")
  .then(res => res.json())
  .then(data => {
    const brandsDiv = document.getElementById("brands");
    const modelsDiv = document.getElementById("models");

    Object.keys(data).forEach(brand => {
      const btn = document.createElement("button");
      btn.textContent = brand;
      btn.className = "btn secondary";
      btn.onclick = () => showBrand(brand);
      brandsDiv.appendChild(btn);
    });

    function showBrand(brand) {
      modelsDiv.innerHTML = `<h3>${brand}</h3>`;
      Object.keys(data[brand]).forEach(year => {
        let html = `<h4>${year}</h4><table>
          <tr><th>Model</th><th>Cena (PLN)</th></tr>`;

        data[brand][year].forEach(m => {
          html += `<tr>
            <td>${m.model}</td>
            <td>${m.price.min} – ${m.price.max}</td>
          </tr>`;
        });

        html += "</table>";
        modelsDiv.innerHTML += html;
      });
    }
  })
  .catch(err => {
    console.error("Błąd ładowania motorcycles.json:", err);
  });
