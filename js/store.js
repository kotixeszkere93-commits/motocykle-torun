/* =========================================================================
   store.js — warstwa danych.
   Działa w dwóch trybach:
     • cloud  — Firebase Auth + Firestore (dane wszystkich użytkowników)
     • local  — localStorage (gdy Firebase jest niedostępny lub zablokowany)
   Aplikacja zawsze ma pełny zestaw funkcji; w trybie lokalnym dane są
   tylko w tej przeglądarce i wyraźnie to komunikujemy w UI.
   ========================================================================= */

const Store = (() => {
  'use strict';

  const LS = {
    // dane trybu lokalnego (własne trasy, konta w tej przeglądarce)
    routes: `${APP.storagePrefix}local:routes`,
    users: `${APP.storagePrefix}local:users`,
    session: `${APP.storagePrefix}session`,
    seeded: `${APP.storagePrefix}local:seeded`,
    // kopia danych z chmury — pokazujemy ją natychmiast przy starcie i offline
    cacheRoutes: `${APP.storagePrefix}cache:routes`,
    cacheUsers: `${APP.storagePrefix}cache:users`,
    bike: `${APP.storagePrefix}bike`
  };

  const state = {
    mode: 'local',          // 'cloud' | 'local'
    cloudReason: '',
    readLimited: false,     // baza działa, ale reguły wymagają logowania
    auth: null,
    db: null,
    user: null,             // { uid, email }
    profile: null,          // { name, bike, score, ... }
    routes: [],
    users: [],
    routesReady: false,
    usersReady: false
  };

  const listeners = { routes: new Set(), users: new Set(), auth: new Set() };

  /* ---------------------------------------------------------- NARZĘDZIA */
  const uid = () => `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const docId = () => `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* brak miejsca / tryb prywatny — ignorujemy */
    }
  }

  const toMillis = value => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (value.seconds) return value.seconds * 1000;
    if (value.toMillis) return value.toMillis();
    const t = new Date(value).getTime();
    return isNaN(t) ? 0 : t;
  };

  /** Normalizacja daty do ISO (Firestore Timestamp → ISO). */
  const toISO = value => (toMillis(value) ? new Date(toMillis(value)).toISOString() : new Date().toISOString());

  function emit(kind, payload) {
    listeners[kind].forEach(cb => {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  }

  /* -------------------------------------------------------- TRYB LOKALNY */
  const Local = {
    routes: () => readLS(LS.routes, []),
    saveRoutes: routes => writeLS(LS.routes, routes),
    users: () => readLS(LS.users, []),
    saveUsers: users => writeLS(LS.users, users),

    me() {
      const session = readLS(LS.session, null);
      if (!session) return null;
      const user = Local.users().find(u => u.id === session.id);
      if (!user) return null;
      const { pass, ...safe } = user; // hash hasła nigdy nie trafia do UI
      return safe;
    }
  };

  /** Prosty, deterministyczny skrót hasła (tylko tryb lokalny / demo). */
  function weakHash(text) {
    let h = 5381;
    const salted = `mst::${text}`;
    for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
      .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/[żź]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /* ------------------------------------------------- POWER-ON: FIREBASE? */
  async function init() {
    // 1. Natychmiast pokazujemy dane z ostatniej wizyty (zero białego ekranu)
    preloadCache();

    if (typeof firebase === 'undefined') {
      state.mode = 'local';
      state.cloudReason = 'Brak biblioteki Firebase — pracujemy lokalnie.';
      loadLocalState();
      return state;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      state.auth = firebase.auth();
      state.db = firebase.firestore();
      state.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    } catch (e) {
      console.warn('[Moto Świry] Firebase nie wystartował:', e);
      state.mode = 'local';
      state.cloudReason = 'Nie udało się połączyć z Firebase.';
      loadLocalState();
      return state;
    }

    const probe = await checkCloud();
    state.mode = probe.ok ? 'cloud' : 'local';
    state.readLimited = probe.limited;
    if (!probe.ok) {
      loadLocalState();
      return state;
    }
    if (probe.limited) {
      // Jesteśmy podłączeni, ale reguły Firestore wymagają zalogowania.
      // Pokazujemy to, co mamy w kopii, i czekamy na logowanie.
      preloadCache();
      state.routesReady = true;
      state.usersReady = true;
    }

    state.auth.onAuthStateChanged(async user => {
      state.user = user ? { uid: user.uid, email: user.email } : null;
      if (user) {
        try {
          const doc = await state.db.collection('users').doc(user.uid).get();
          state.profile = doc.exists ? { id: user.uid, ...doc.data() } : { id: user.uid, name: user.email, bike: '—', score: 0 };
        } catch (e) {
          state.profile = { id: user.uid, name: user.email, bike: '—', score: 0 };
        }
      } else {
        state.profile = null;
      }
      emit('auth', { user: state.user, profile: state.profile });
      if (user) {
        subscribeCloudRoutes();
        subscribeCloudUsers();
      } else {
        loadPublicRoutes();
        state.users = state.users.length ? state.users : [];
        emit('users', state.users);
      }
    });

    // Wygaśnięcie sesji / brak sieci w trakcie pracy nie może wywalić UI
    if (typeof state.db.enableNetwork === 'function') state.db.enableNetwork().catch(() => {});

    return state;
  }

  /** Kopia danych z chmury z poprzedniej wizyty — wyświetlana od razu. */
  function preloadCache() {
    const routes = readLS(LS.cacheRoutes, []);
    if (routes.length) {
      state.routes = routes.map(normalizeRoute).sort(byNewest);
      state.routesReady = true;
      emit('routes', state.routes);
    }
    const users = readLS(LS.cacheUsers, []);
    if (users.length) {
      state.users = users;
      state.usersReady = true;
      emit('users', state.users);
    }
  }

  /**
   * Sonda: czy Firestore odpowiada i czy pozwala czytać dane bez logowania.
   * @returns {Promise<{ok: boolean, limited: boolean}>}
   */
  async function checkCloud() {
    try {
      const probe = state.db.collection('routes').limit(1).get();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500));
      await Promise.race([probe, timeout]);
      return { ok: true, limited: false };
    } catch (e) {
      const code = (e && e.code) || '';
      if (/permission-denied|unauthenticated|failed-precondition/.test(code)) {
        // Baza żyje — po prostu wymaga zalogowania (reguły Firestore).
        console.info('[Moto Świry] Reguły Firestore wymagają logowania:', code);
        return { ok: true, limited: true };
      }
      console.warn('[Moto Świry] Firestore niedostępny:', code || (e && e.message));
      state.cloudReason = 'Brak połączenia z bazą społeczności.';
      return { ok: false, limited: false };
    }
  }

  /** Trasy publiczne (bez logowania) — z cache w localStorage jako fallback. */
  async function loadPublicRoutes() {
    if (state.mode === 'cloud' && state.readLimited && !state.user) {
      // Bez logowania nie odczytamy tras — zostajemy przy kopii z pamięci
      state.routesReady = true;
      state.usersReady = true;
      emit('routes', state.routes);
      emit('users', state.users);
      return;
    }
    if (state.mode !== 'cloud') {
      state.routes = Local.routes().sort(byNewest);
      state.routesReady = true;
      emit('routes', state.routes);
      return;
    }
    try {
      const snap = await withTimeout(state.db.collection('routes').limit(200).get());
      applyRoutesSnapshot(snap.docs.map(d => ({ id: d.id, ...d.data() })), { cache: true });
    } catch (e) {
      console.warn('[Moto Świry] Odczyt tras nieudany:', e && e.code);
      state.routes = readLS(LS.cacheRoutes, []).map(normalizeRoute).sort(byNewest);
      state.routesReady = true;
      emit('routes', state.routes);
      if (!navigator.onLine) {
        UI.toast('Tryb offline', 'Pokazujemy ostatnio zapisane trasy.', 'warn');
      }
    }
  }

  function withTimeout(promise, ms = 12000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  function applyRoutesSnapshot(routes, { cache = false } = {}) {
    state.routes = routes
      .map(normalizeRoute)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    state.routesReady = true;
    if (cache) writeLS(LS.cacheRoutes, state.routes);
    emit('routes', state.routes);
  }

  function applyUsersSnapshot(users, { cache = false } = {}) {
    state.users = users.map(u => ({ ...u, score: Number(u.score) || 0 }));
    state.usersReady = true;
    if (cache) writeLS(LS.cacheUsers, state.users);
    emit('users', state.users);
  }

  function normalizeRoute(r) {
    return {
      ...r,
      likes: Array.isArray(r.likes) ? r.likes : [],
      participants: Array.isArray(r.participants) ? r.participants : [],
      comments: Array.isArray(r.comments) ? r.comments : [],
      suggestions: Array.isArray(r.suggestions) ? r.suggestions : [],
      waypoints: Array.isArray(r.waypoints) ? r.waypoints : [],
      path: Array.isArray(r.path) ? r.path : [],
      createdAt: r.createdAt || new Date().toISOString()
    };
  }

  const byNewest = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);

  function subscribeCloudRoutes() {
    const base = state.db.collection('routes');
    const onNext = snap => applyRoutesSnapshot(snap.docs.map(d => ({ id: d.id, ...d.data() })), { cache: true });
    const onError = err => {
      console.warn('[Moto Świry] Subskrypcja tras:', err && err.code);
      if (state.routes.length) return;
      loadPublicRoutes();
    };
    base.orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
      if (snap.empty) loadPublicRoutes(); else onNext(snap);
    }, () => {
      // brak indeksu / uprawnień → odczyt bez sortowania
      base.limit(200).onSnapshot(onNext, onError);
    });
  }

  function subscribeCloudUsers() {
    state.db.collection('users').orderBy('score', 'desc').limit(100)
      .onSnapshot(
        snap => applyUsersSnapshot(snap.docs.map(d => ({ id: d.id, ...d.data() })), { cache: true }),
        err => {
          console.warn('[Moto Świry] Subskrypcja użytkowników:', err && err.code);
          if (state.users.length) return;
          state.db.collection('users').limit(100).get()
            .then(snap => applyUsersSnapshot(snap.docs.map(d => ({ id: d.id, ...d.data() })), { cache: true }))
            .catch(() => applyUsersSnapshot(readLS(LS.cacheUsers, [])));
        }
      );
  }

  function loadLocalState() {
    // Pierwsza wizyta w trybie lokalnym: wypełniamy bazę przykładami,
    // żeby katalog tras i ranking nie były pustymi ścianami.
    if (!readLS(LS.seeded, false)) seedLocalDemo(Local.me());

    state.routes = Local.routes().sort(byNewest);
    state.users = Local.users();
    state.routesReady = true;
    state.usersReady = true;

    const me = Local.me();
    if (me) {
      state.user = { uid: me.id, email: me.email };
      state.profile = me;
    }
    emit('routes', state.routes);
    emit('users', state.users);
    emit('auth', { user: state.user, profile: state.profile });
  }

  /** Pobranie najnowszych danych do widoków, które nie subskrybują. */
  async function refreshLocal() {
    if (state.mode !== 'local') return;
    state.routes = Local.routes().sort(byNewest);
    state.users = Local.users();
    emit('routes', state.routes);
    emit('users', state.users);
  }

  /* -------------------------------------------------------------- AUTH */
  async function register({ email, password, name, bike }) {
    if (state.mode === 'local') {
      const users = Local.users();
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        const err = new Error('Ten email jest już zarejestrowany.');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
      const user = {
        id: uid(), email, name, bike,
        pass: weakHash(password),
        score: 0,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      Local.saveUsers(users);
      writeLS(LS.session, { id: user.id });
      state.user = { uid: user.id, email };
      state.profile = user;
      // Pierwsze konto w tym trybie zakłada też bazę startową z przykładami
      if (!readLS(LS.seeded, false)) seedLocalDemo(user);
      await refreshLocal();
      emit('auth', { user: state.user, profile: state.profile });
      return user;
    }

    const cred = await state.auth.createUserWithEmailAndPassword(email, password);
    const profile = {
      name, bike, email, score: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await state.db.collection('users').doc(cred.user.uid).set(profile);
    await cred.user.updateProfile({ displayName: name }).catch(() => {});
    return cred.user;
  }

  async function login({ email, password }) {
    if (state.mode === 'local') {
      const users = Local.users();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        const err = new Error('Nie ma takiego konta.'); err.code = 'auth/user-not-found'; throw err;
      }
      if (user.pass !== weakHash(password)) {
        const err = new Error('Błędne hasło.'); err.code = 'auth/wrong-password'; throw err;
      }
      writeLS(LS.session, { id: user.id });
      state.user = { uid: user.id, email: user.email };
      state.profile = user;
      emit('auth', { user: state.user, profile: state.profile });
      return user;
    }
    return state.auth.signInWithEmailAndPassword(email, password);
  }

  async function logout() {
    if (state.mode === 'local') {
      localStorage.removeItem(LS.session);
      state.user = null;
      state.profile = null;
      emit('auth', { user: null, profile: null });
      return;
    }
    await state.auth.signOut();
  }

  async function resetPassword(email) {
    if (state.mode === 'local') {
      const user = Local.users().find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        const err = new Error('Nie ma takiego konta.'); err.code = 'auth/user-not-found'; throw err;
      }
      return true;
    }
    return state.auth.sendPasswordResetEmail(email);
  }

  async function updateProfile(patch) {
    if (!state.user) throw new Error('Brak zalogowanego użytkownika.');
    state.profile = { ...state.profile, ...patch };
    if (state.mode === 'local') {
      const users = Local.users().map(u => (u.id === state.user.uid ? { ...u, ...patch } : u));
      Local.saveUsers(users);
      emit('auth', { user: state.user, profile: state.profile });
      emit('users', users);
      return;
    }
    await state.db.collection('users').doc(state.user.uid).set(patch, { merge: true });
    emit('auth', { user: state.user, profile: state.profile });
  }

  async function addScore(points) {
    if (!state.user) return;
    if (state.mode === 'local') {
      const users = Local.users().map(u => (u.id === state.user.uid ? { ...u, score: (Number(u.score) || 0) + points } : u));
      Local.saveUsers(users);
      state.profile = { ...state.profile, score: (Number(state.profile.score) || 0) + points };
      emit('auth', { user: state.user, profile: state.profile });
      emit('users', Local.users());
      return;
    }
    await state.db.collection('users').doc(state.user.uid)
      .set({ score: firebase.firestore.FieldValue.increment(points) }, { merge: true });
    state.profile = { ...state.profile, score: (Number(state.profile.score) || 0) + points };
    emit('auth', { user: state.user, profile: state.profile });
  }

  /* ------------------------------------------------------------ TRASY */
  async function addRoute(data) {
    const author = state.profile || {};
    const route = {
      title: data.title.trim(),
      description: (data.description || '').trim(),
      region: data.region || 'kujawy',
      difficulty: data.difficulty || 'srednia',
      surface: data.surface || 'mieszana',
      authorId: state.user ? state.user.uid : 'gość',
      authorName: author.name || 'Gość',
      authorBike: author.bike || '—',
      start: data.start,
      end: data.end,
      waypoints: data.waypoints || [],
      path: data.path || [],
      distanceKm: Number(data.distanceKm) || 0,
      durationSec: Number(data.durationSec) || 0,
      rideDate: data.rideDate || '',
      meetingPoint: data.meetingPoint || '',
      likes: [],
      participants: [],
      comments: [],
      suggestions: [],
      createdAt: new Date().toISOString()
    };

    if (state.mode === 'local') {
      const routes = Local.routes();
      const record = { id: docId(), ...route };
      routes.push(record);
      Local.saveRoutes(routes);
      await refreshLocal();
      return record;
    }

    const ref = await state.db.collection('routes').add({
      ...route,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, ...route };
  }

  async function updateRoute(id, patch) {
    if (state.mode === 'local') {
      const routes = Local.routes().map(r => (r.id === id ? { ...r, ...patch } : r));
      Local.saveRoutes(routes);
      await refreshLocal();
      return;
    }
    await state.db.collection('routes').doc(id).set(patch, { merge: true });
  }

  async function deleteRoute(id) {
    if (state.mode === 'local') {
      Local.saveRoutes(Local.routes().filter(r => r.id !== id));
      await refreshLocal();
      return;
    }
    await state.db.collection('routes').doc(id).delete();
  }

  /**
   * Mutacja tablicy w dokumencie trasy.
   * @param {string} id       identyfikator trasy
   * @param {string} field    nazwa pola (participants, likes, comments…)
   * @param {*} add           element do dodania (lub null)
   * @param {Function} remove predykat usuwający istniejące elementy
   */

  async function mutateArray(id, field, add, remove) {
    if (!state.user) throw new Error('Wymagane logowanie.');
    const apply = list => {
      let next = Array.isArray(list) ? list.slice() : [];
      if (remove) next = next.filter(item => !remove(item));
      if (add) next = next.concat([add]);
      return next;
    };

    if (state.mode === 'local') {
      Local.saveRoutes(Local.routes().map(r => (r.id === id ? { ...r, [field]: apply(r[field]) } : r)));
      await refreshLocal();
      return;
    }

    const ref = state.db.collection('routes').doc(id);
    try {
      await state.db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) throw new Error('Trasa nie istnieje.');
        tx.update(ref, { [field]: apply(doc.data()[field]) });
      });
    } catch (e) {
      // Offline lub brak transakcji → operacja atomowa na tablicy
      console.warn('[Moto Świry] Transakcja nieudana, próba atomowa:', e && e.code);
      const update = {};
      if (add) update[field] = firebase.firestore.FieldValue.arrayUnion(add);
      if (remove && !add) {
        const current = (state.routes.find(r => r.id === id) || {})[field] || [];
        const toDrop = current.filter(remove);
        if (!toDrop.length) return;
        update[field] = firebase.firestore.FieldValue.arrayRemove(...toDrop);
      }
      await ref.update(update);
    }
  }

  /* ------------------------------------------------- AKCJE NA TRASACH */
  async function joinRoute(routeId) {
    const route = state.routes.find(r => r.id === routeId);
    if (!route) return;
    const me = state.profile || {};
    const entry = { userId: state.user.uid, name: me.name, bike: me.bike, at: new Date().toISOString() };
    await mutateArray(routeId, 'participants', entry, p => p.userId === state.user.uid);
    await addScore(POINTS.join);
    UI.toast('Jesteś w ekipie!', `Trasa „${route.title}” — do zobaczenia na starcie.`, 'ok');
  }

  async function leaveRoute(routeId) {
    const route = state.routes.find(r => r.id === routeId);
    if (!route) return;
    await mutateArray(routeId, 'participants', null, p => p.userId === state.user.uid);
    UI.toast('Wypisano z trasy', route.title, 'info');
  }

  async function toggleLike(routeId) {
    const route = state.routes.find(r => r.id === routeId);
    if (!route || !state.user) return;
    const liked = route.likes.includes(state.user.uid);
    await mutateArray(routeId, 'likes', liked ? null : state.user.uid, id => id === state.user.uid && liked);
    return !liked;
  }

  async function addComment(routeId, text) {
    const me = state.profile || {};
    const comment = {
      id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      userId: state.user.uid,
      authorName: me.name || 'Motocyklista',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    await mutateArray(routeId, 'comments', comment);
    await addScore(POINTS.comment);
    return comment;
  }

  async function deleteComment(routeId, commentId) {
    await mutateArray(routeId, 'comments', null, c => c.id === commentId);
  }

  async function addSuggestion(routeId, text) {
    const me = state.profile || {};
    const suggestion = {
      userId: state.user.uid,
      authorName: me.name || 'Motocyklista',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    await mutateArray(routeId, 'suggestions', suggestion);
    await addScore(POINTS.suggestion);
    UI.toast('Propozycja wysłana', `+${POINTS.suggestion} pkt do rankingu.`, 'ok');
  }

  /* ------------------------------------------- MOTOCYKL / PREFERENCJE */
  function getMyBike() {
    return readLS(LS.bike, null);
  }

  function setMyBike(bike) {
    writeLS(LS.bike, bike);
    emit('auth', { user: state.user, profile: state.profile });
  }

  /* -------------------------------------------- DANE DEMO (TRYB LOKALNY) */
  /**
   * Przykładowa baza dla trybu lokalnego (pierwsza wizyta bez dostępu do chmury).
   * Autorzy mają stałe identyfikatory, żeby ranking liczył się poprawnie.
   */
  function seedLocalDemo(me) {
    if (readLS(LS.seeded, false)) return;
    writeLS(LS.seeded, true);

    const DEMO = {
      marta: { id: 'demo-marta', name: 'Marta „Klocki”', bike: 'Yamaha Ténéré 700', score: 74 },
      piotr: { id: 'demo-piotr', name: 'Piotr „Niedziela”', bike: 'Suzuki V-Strom 650', score: 58 },
      kuba: { id: 'demo-kuba', name: 'Kuba „Kubańczyk”', bike: 'KTM 790 Adventure', score: 46 }
    };

    const demoRoutes = [
      {
        title: 'Pętla wiślana: Toruń → Chełmno → Świecie',
        description: 'Klasyk na dobry początek sezonu. Start pod Zamkiem Krzyżackim, potem wałem przeciwpowodziowym do Chełmna (obowiązkowa kawa na rynku), dalej wzdłuż Wisły do Świecia i powrót przez Chełmżę. Asfalt w dobrym stanie, kilka odcinków z pięknym widokiem na dolinę Wisły.',
        region: 'kujawy', difficulty: 'latwa', surface: 'asfalt',
        start: { lat: 53.0086, lng: 18.6012 }, end: { lat: 53.4096, lng: 18.4465 },
        waypoints: [{ lat: 53.3485, lng: 18.426 }],
        path: [[53.0086,18.6012],[53.09,18.56],[53.19,18.49],[53.29,18.45],[53.3485,18.426],[53.38,18.44],[53.4096,18.4465]],
        distanceKm: 132, durationSec: 8100, rideDate: '', meetingPoint: 'Stacja paliw, Szosa Chełmińska 120',
        author: DEMO.marta
      },
      {
        title: 'Szuter w Borach Tucholskich — Zalew Koronowski',
        description: 'Dla tych, co lubią kurz na błotniku. Z Torunia przez Świecie do Tlenia i wokół Zalewu Koronowskiego. Około 40% trasy to szuter i piach, momentami kopny. Warto mieć opony z klockiem. Po drodze dwa punkty widokowe i smażalnia ryb.',
        region: 'bory-tucholskie', difficulty: 'trudna', surface: 'szuter',
        start: { lat: 53.0138, lng: 18.5984 }, end: { lat: 53.6217, lng: 18.1394 },
        waypoints: [{ lat: 53.65, lng: 18.32 }],
        path: [[53.0138,18.5984],[53.16,18.52],[53.32,18.44],[53.47,18.38],[53.56,18.30],[53.65,18.32],[53.6217,18.1394]],
        distanceKm: 168, durationSec: 12600, rideDate: '', meetingPoint: 'Parking pod Zamkiem w Toruniu',
        author: DEMO.kuba
      },
      {
        title: 'Dolina Drwęcy i zamek w Golubiu-Dobrzyniu',
        description: 'Trasa dla spokojnej niedzieli. Wąskie, kręte asfalty wzdłuż Drwęcy, przystanek na zwiedzanie zamku i obiad w Rynku. Idealne na pierwszy wyjazd z plecaczkiem — mały ruch i dużo cienia.',
        region: 'dolina-drwecy', difficulty: 'latwa', surface: 'asfalt',
        start: { lat: 53.1081, lng: 19.0531 }, end: { lat: 53.2576, lng: 19.3977 },
        waypoints: [{ lat: 53.22, lng: 19.15 }],
        path: [[53.1081,19.0531],[53.16,19.10],[53.22,19.15],[53.24,19.28],[53.2576,19.3977]],
        distanceKm: 96, durationSec: 6600, rideDate: '', meetingPoint: 'Rynek w Golubiu-Dobrzyniu',
        author: DEMO.piotr
      },
      {
        title: 'Weekend na Kaszubach: Wdzydze i Chmielno',
        description: 'Dłuższy wyjazd z noclegiem pod namiotem. Kaszubskie serpentyny, jeziora, punkt widokowy na Górze Zamkowej i obiad z widokiem na Wdzydze. Powrót przez Kościerzynę i Bydgoszcz.',
        region: 'kaszuby', difficulty: 'srednia', surface: 'mieszana',
        start: { lat: 53.0138, lng: 18.5984 }, end: { lat: 54.2, lng: 17.9 },
        waypoints: [{ lat: 53.95, lng: 17.9 }, { lat: 54.15, lng: 18.0 }],
        path: [[53.0138,18.5984],[53.3,18.35],[53.6,18.1],[53.95,17.9],[54.15,18.0],[54.2,17.9]],
        distanceKm: 320, durationSec: 21600, rideDate: '', meetingPoint: 'Moto Spot, Toruń',
        author: DEMO.marta
      },
      {
        title: 'Pojezierze Brodnickie — jeziora i wąskie asfalty',
        description: 'Krótka pętla po pracy (ok. 70 km) wokół jezior brodnickich. Same asfalty, ale wąskie i kręte, z pięknymi widokami. Trasa mało znana, ruch praktycznie zerowy po 18:00.',
        region: 'pojezierze-brodnickie', difficulty: 'latwa', surface: 'asfalt',
        start: { lat: 53.2576, lng: 19.3977 }, end: { lat: 53.32, lng: 19.42 },
        waypoints: [],
        path: [[53.2576,19.3977],[53.28,19.40],[53.30,19.41],[53.32,19.42]],
        distanceKm: 74, durationSec: 4500, rideDate: '', meetingPoint: 'Parking przy jeziorze Niskie Brodno',
        author: DEMO.piotr
      }
    ];

    const now = Date.now();
    const routes = demoRoutes.map((r, i) => {
      const { author, ...rest } = r;
      return {
        id: `demo-route-${i + 1}`,
        ...rest,
        authorId: author.id,
        authorName: author.name,
        authorBike: author.bike,
        likes: i < 3 ? [DEMO.marta.id, DEMO.piotr.id].slice(0, i + 1) : [],
        participants: [
          { userId: DEMO.marta.id, name: DEMO.marta.name, bike: DEMO.marta.bike, at: new Date(now - i * 3_600_000).toISOString() },
          ...(i % 2 === 0 ? [{ userId: DEMO.piotr.id, name: DEMO.piotr.name, bike: DEMO.piotr.bike, at: new Date(now - i * 7_200_000).toISOString() }] : [])
        ],
        comments: i === 0
          ? [{ id: 'demo-c1', userId: DEMO.piotr.id, authorName: DEMO.piotr.name, text: 'Jechałem w zeszłym tygodniu — w Chełmnie objazd przy rynku, ale poza tym czysto.', createdAt: new Date(now - 7_200_000).toISOString() }]
          : [],
        suggestions: i === 0
          ? [{ userId: DEMO.kuba.id, authorName: DEMO.kuba.name, text: 'Proponuję dodać przerwę na punkcie widokowym w Ostromecku.', createdAt: new Date(now - 3_600_000).toISOString() }]
          : [],
        createdAt: new Date(now - (i + 1) * 2 * 86_400_000).toISOString()
      };
    });

    const users = [
      { id: DEMO.marta.id, email: 'marta@example.com', name: DEMO.marta.name, bike: DEMO.marta.bike, score: DEMO.marta.score, createdAt: new Date(now - 90 * 86_400_000).toISOString() },
      { id: DEMO.piotr.id, email: 'piotr@example.com', name: DEMO.piotr.name, bike: DEMO.piotr.bike, score: DEMO.piotr.score, createdAt: new Date(now - 60 * 86_400_000).toISOString() },
      { id: DEMO.kuba.id, email: 'kuba@example.com', name: DEMO.kuba.name, bike: DEMO.kuba.bike, score: DEMO.kuba.score, createdAt: new Date(now - 45 * 86_400_000).toISOString() }
    ];
    if (me) users.unshift({ ...me, score: Math.max(Number(me.score) || 0, 0) });

    Local.saveRoutes(routes);
    Local.saveUsers(users);
  }

  /* --------------------------------------------------------- SUBSKRYPCJE */
  function onRoutes(cb) {
    listeners.routes.add(cb);
    if (state.routesReady) cb(state.routes);
    return () => listeners.routes.delete(cb);
  }

  function onUsers(cb) {
    listeners.users.add(cb);
    if (state.usersReady) cb(state.users);
    return () => listeners.users.delete(cb);
  }

  function onAuth(cb) {
    listeners.auth.add(cb);
    cb({ user: state.user, profile: state.profile });
    return () => listeners.auth.delete(cb);
  }

  /* ------------------------------------------------------------- EKSPORT */
  return {
    init, state,
    onRoutes, onUsers, onAuth,
    register, login, logout, resetPassword, updateProfile, addScore,
    addRoute, updateRoute, deleteRoute,
    joinRoute, leaveRoute, toggleLike, addComment, deleteComment, addSuggestion,
    getMyBike, setMyBike,
    refreshLocal, normalizeRoute, toMillis, slugify,
    get mode() { return state.mode; },
    get isCloud() { return state.mode === 'cloud'; },
    get readLimited() { return state.readLimited; },
    get user() { return state.user; },
    get profile() { return state.profile; },
    get routes() { return state.routes; },
    get users() { return state.users; },
    get hasAccount() { return Boolean(state.user); }
  };
})();
