(() => {
  const STORAGE_KEY = 'moodtracker.checkins';
  const FEEDBACK_KEY = 'moodtracker.feedback';
  const CHAT_KEY = 'moodtracker.chat';

  const MOOD_META = {
    1: { emoji: '😞', label: 'Difficile', color: '#e0796b' },
    2: { emoji: '🙁', label: 'Pas top', color: '#e3a06b' },
    3: { emoji: '😐', label: 'Neutre', color: '#e0b45c' },
    4: { emoji: '🙂', label: 'Plutôt bien', color: '#8fb98a' },
    5: { emoji: '😄', label: 'Très bien', color: '#5f9e6b' },
  };

  const TIPS = {
    lowMood: [
      { title: 'Respiration 4-7-8', text: 'Inspire 4s, retiens 7s, expire 8s. Trois cycles suffisent pour redescendre.' },
      { title: 'Un message à un proche', text: 'Parler à quelqu\'un, même brièvement, allège souvent la charge du moment.' },
      { title: 'Espace d\'écoute campus', text: 'Un rendez-vous gratuit et confidentiel est accessible depuis l\'app.' },
    ],
    highStress: [
      { title: 'Micro-pause de 5 min', text: 'Lève-toi, marche, regarde autre chose que ton écran. Le cerveau a besoin de coupures.' },
      { title: 'Priorise une seule tâche', text: 'Note les 3 choses essentielles du jour, le reste peut attendre demain.' },
      { title: 'Mieux dormir', text: 'Vise un créneau d\'écran coupé 30 min avant le coucher cette semaine.' },
    ],
    goodMood: [
      { title: 'Ancre ce moment', text: 'Note ce qui a contribué à cette bonne journée pour t\'en souvenir plus tard.' },
      { title: 'Partage l\'énergie', text: 'C\'est le bon moment pour prendre des nouvelles d\'un·e ami·e qui va moins bien.' },
      { title: 'Petit défi bien-être', text: 'Ajoute 10 minutes de marche ou d\'étirements à ta routine du jour.' },
    ],
    neutral: [
      { title: 'Ancrage quotidien', text: 'Continue ta série de check-in, la régularité en dit plus qu\'un seul ressenti.' },
      { title: 'Écoute campus', text: 'Un lien direct vers les ressources d\'écoute du campus est toujours disponible.' },
      { title: 'Journal contextuel', text: 'Ajoute un mot-clé à ton check-in : cela aide à repérer tes facteurs récurrents.' },
    ],
  };

  const STOPWORDS = new Set(['de','la','le','les','un','une','des','du','et','ça','ca','ce','cette','pour','avec','pas','plus','très','tres','trop','mon','ma','mes','ta','ton','tes','sa','son','ses','au','aux','en','à','a','on','je','il','elle','nous','vous','ils','elles','que','qui','est','sont','été','ete','être','etre','sur','dans','par']);

  // ---------- storage ----------
  function loadCheckins() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveCheckins(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY)) || []; }
    catch { return []; }
  }
  function saveFeedback(list) {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list));
  }
  function loadChat() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; }
    catch { return []; }
  }
  function saveChat(list) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(list));
  }

  // ---------- date helpers ----------
  function todayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }
  function frenchDate(d = new Date()) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, c => c.toUpperCase());
  }
  function frenchDateShort(iso) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function frenchDateTime(iso) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // ---------- nav / tabs ----------
  function initTabs() {
    const tabs = document.querySelectorAll('.demo-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.demo-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'analyse') renderChart();
        if (tab.dataset.tab === 'conseils') renderTips();
        if (tab.dataset.tab === 'messages') scrollChatToBottom();
        if (tab.dataset.tab === 'historique') renderHistory();
      });
    });
  }

  // ---------- hero live mockup ----------
  function updateHeroMock() {
    const list = loadCheckins();
    document.getElementById('hero-streak').textContent = computeStreak(list);
    const key = todayKey();
    const today = list.find(c => c.date === key);
    document.querySelectorAll('#hero-mood-row .mood-dot').forEach(dot => {
      dot.classList.toggle('hero-active', !!today && Number(dot.dataset.mood) === today.mood);
    });
    const label = document.getElementById('hero-mood-label');
    label.textContent = today ? `Aujourd'hui : ${MOOD_META[today.mood].label}` : 'Comment te sens-tu ?';
  }

  // ---------- check-in ----------
  let selectedMood = null;

  function initCheckin() {
    document.getElementById('hero-date').textContent = frenchDate();

    const buttons = document.querySelectorAll('.mood-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = Number(btn.dataset.mood);
      });
    });

    document.getElementById('save-checkin').addEventListener('click', () => {
      const confirmEl = document.getElementById('save-confirm');
      if (!selectedMood) {
        confirmEl.textContent = 'Choisis une humeur avant d\'enregistrer.';
        confirmEl.style.color = '#c9603f';
        return;
      }
      const stress = Number(document.getElementById('stress-range').value);
      const journal = document.getElementById('journal-input').value.trim();
      const list = loadCheckins();
      const key = todayKey();
      const existingIdx = list.findIndex(c => c.date === key);
      const entry = { date: key, mood: selectedMood, stress, journal };
      if (existingIdx > -1) list[existingIdx] = entry; else list.push(entry);
      saveCheckins(list);

      confirmEl.style.color = '';
      confirmEl.textContent = 'Humeur enregistrée pour aujourd\'hui ✓';
      document.getElementById('journal-input').value = '';

      renderStreak();
      renderLastMood();
      renderChart();
      renderTips();
      updateHeroMock();
    });

    renderStreak();
    renderLastMood();
    updateHeroMock();
  }

  function computeStreak(list) {
    if (!list.length) return 0;
    const dates = new Set(list.map(c => c.date));
    let streak = 0;
    let cursor = new Date();
    while (dates.has(todayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderStreak() {
    const list = loadCheckins();
    document.getElementById('streak-count').textContent = computeStreak(list);
  }

  function renderLastMood() {
    const list = loadCheckins().slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const emojiEl = document.getElementById('last-mood-emoji');
    const dateEl = document.getElementById('last-mood-date');
    if (!last) {
      emojiEl.textContent = '—';
      dateEl.textContent = 'Aucun check-in pour l\'instant';
      return;
    }
    emojiEl.textContent = MOOD_META[last.mood].emoji;
    dateEl.textContent = `${MOOD_META[last.mood].label} · ${new Date(last.date).toLocaleDateString('fr-FR')}`;
  }

  // ---------- analyse ----------
  let chartRange = 7;
  let chartLayout = null; // cache for tooltip hit-testing

  function initChartControls() {
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chartRange = Number(btn.dataset.range);
        renderChart();
      });
    });

    const canvas = document.getElementById('mood-chart');
    const tooltip = document.getElementById('chart-tooltip');
    canvas.addEventListener('mousemove', e => {
      if (!chartLayout || !chartLayout.points.length) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      let nearest = chartLayout.points[0];
      let minDist = Infinity;
      chartLayout.points.forEach(p => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; nearest = p; }
      });
      const scaleXInv = rect.width / canvas.width;
      const scaleYInv = rect.height / canvas.height;
      tooltip.style.left = (nearest.x * scaleXInv) + 'px';
      tooltip.style.top = (nearest.yMood * scaleYInv) + 'px';
      tooltip.innerHTML = `<strong>${frenchDateShort(nearest.date)}</strong><br>Humeur ${nearest.mood}/5 · Stress ${nearest.stress}/5`;
      tooltip.classList.add('visible');
    });
    canvas.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
  }

  function renderChart() {
    const list = loadCheckins().slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-chartRange);
    const canvas = document.getElementById('mood-chart');
    const ctx = canvas.getContext('2d');
    const emptyMsg = document.getElementById('chart-empty');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chartLayout = { points: [] };

    if (list.length < 2) {
      emptyMsg.style.display = 'block';
      document.getElementById('avg-mood').textContent = list.length ? list[0].mood.toFixed(1) : '–';
      document.getElementById('top-factor').textContent = '—';
      return;
    }
    emptyMsg.style.display = 'none';

    const w = canvas.width, h = canvas.height;
    const padX = 30, padY = 24;
    const stepX = list.length > 1 ? (w - padX * 2) / (list.length - 1) : 0;
    const yFor = v => h - padY - ((v - 1) / 4) * (h - padY * 2);

    ctx.strokeStyle = 'rgba(31,42,34,0.08)';
    ctx.lineWidth = 1;
    for (let m = 1; m <= 5; m++) {
      const y = yFor(m);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    function drawLine(valueKey, color, fill) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      list.forEach((c, i) => {
        const x = padX + i * stepX;
        const y = yFor(c[valueKey]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (fill) {
        ctx.lineTo(padX + (list.length - 1) * stepX, h - padY);
        ctx.lineTo(padX, h - padY);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
    }

    drawLine('mood', '#5f9e6b', 'rgba(95,158,107,0.10)');
    drawLine('stress', '#d98a56', null);

    list.forEach((c, i) => {
      const x = padX + i * stepX;
      const yMood = yFor(c.mood);
      const yStress = yFor(c.stress);
      ctx.beginPath();
      ctx.arc(x, yMood, 4, 0, Math.PI * 2);
      ctx.fillStyle = MOOD_META[c.mood].color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, yStress, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#d98a56';
      ctx.fill();
      chartLayout.points.push({ x, yMood, yStress, date: c.date, mood: c.mood, stress: c.stress });
    });

    const avg = list.reduce((s, c) => s + c.mood, 0) / list.length;
    document.getElementById('avg-mood').textContent = avg.toFixed(1);

    const freq = {};
    list.forEach(c => {
      (c.journal || '').toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç'-]+/).forEach(w => {
        if (w.length > 2 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
      });
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('top-factor').textContent = top ? top[0] : 'pas encore assez de données';
  }

  // ---------- conseils ----------
  function renderTips() {
    const list = loadCheckins().slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const grid = document.getElementById('tips-grid');
    let set = TIPS.neutral;
    if (last) {
      if (last.mood <= 2) set = TIPS.lowMood;
      else if (last.stress >= 4) set = TIPS.highStress;
      else if (last.mood >= 4) set = TIPS.goodMood;
    }
    grid.innerHTML = set.map(t => `
      <div class="tip-card">
        <strong>${t.title}</strong>
        <p>${t.text}</p>
      </div>
    `).join('');
  }

  // ---------- feedback ----------
  function initFeedback() {
    renderFeedbackWall();

    document.getElementById('send-feedback').addEventListener('click', () => {
      const text = document.getElementById('feedback-text').value.trim();
      const confirmEl = document.getElementById('feedback-confirm');
      if (!text) {
        confirmEl.style.color = '#c9603f';
        confirmEl.textContent = 'Écris un message avant d\'envoyer.';
        return;
      }
      const anon = document.getElementById('anon-toggle').checked;
      const list = loadFeedback();
      list.unshift({ text, anon, date: new Date().toISOString() });
      saveFeedback(list);
      renderFeedbackWall();
      document.getElementById('feedback-text').value = '';
      confirmEl.style.color = '';
      confirmEl.textContent = anon ? 'Merci, ton retour anonyme a bien été envoyé ✓' : 'Merci pour ton retour ✓';
    });
  }

  function renderFeedbackWall() {
    const list = loadFeedback().slice(0, 5);
    const wall = document.getElementById('feedback-wall');
    wall.innerHTML = '<p class="muted small">Aperçu (démo locale) des 5 derniers retours — historique complet dans l\'onglet dédié :</p>' +
      list.map(f => `
        <div class="feedback-item">
          <strong>${f.anon ? 'Étudiant·e anonyme' : 'Retour identifié'}</strong> — ${f.text}
        </div>
      `).join('');
  }

  // ---------- historique ----------
  function renderHistory() {
    const checkins = loadCheckins().slice().sort((a, b) => b.date.localeCompare(a.date));
    const checkinsEl = document.getElementById('history-checkins');
    checkinsEl.innerHTML = checkins.length ? checkins.map(c => `
      <div class="history-item">
        <span class="h-emoji">${MOOD_META[c.mood].emoji}</span>
        <div>
          <span class="h-date">${new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · Stress ${c.stress}/5</span>
          ${c.journal ? `<span class="h-note">${c.journal}</span>` : ''}
        </div>
      </div>
    `).join('') : '<p class="muted small">Aucun check-in enregistré pour l\'instant.</p>';

    const feedback = loadFeedback();
    const feedbackEl = document.getElementById('history-feedback');
    feedbackEl.innerHTML = feedback.length ? feedback.map(f => `
      <div class="history-item">
        <span class="h-emoji">${f.anon ? '🕶️' : '🙂'}</span>
        <div>
          <span class="h-date">${frenchDateTime(f.date)} · ${f.anon ? 'Anonyme' : 'Identifié'}</span>
          <span class="h-note">${f.text}</span>
        </div>
      </div>
    `).join('') : '<p class="muted small">Aucun retour envoyé pour l\'instant.</p>';
  }

  function initHistory() {
    document.getElementById('reset-history').addEventListener('click', () => {
      if (!confirm('Réinitialiser toutes les données de démo (check-in, feedback, messages) sur cet appareil ?')) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FEEDBACK_KEY);
      localStorage.removeItem(CHAT_KEY);
      renderStreak();
      renderLastMood();
      renderChart();
      renderTips();
      renderFeedbackWall();
      renderHistory();
      updateHeroMock();
      renderChat(true);
    });
  }

  // ---------- chat / messages ----------
  const CHAT_TOPICS = {
    stress: {
      user: 'Je stresse pour un examen.',
      bot: 'C\'est normal d\'avoir un peu d\'appréhension. Essaie la respiration 4-7-8 (inspire 4s, retiens 7s, expire 8s) et découpe tes révisions en blocs de 25 minutes. Veux-tu que je t\'indique une ressource campus pour la gestion du stress ?',
    },
    sommeil: {
      user: 'J\'ai du mal à dormir.',
      bot: 'Le manque de sommeil pèse beaucoup sur l\'humeur. Essaie de couper les écrans 30 minutes avant de te coucher et de garder des horaires réguliers cette semaine. Si ça persiste plus de quelques jours, un rendez-vous à l\'espace d\'écoute campus peut aider.',
    },
    triste: {
      user: 'Je me sens seul·e en ce moment.',
      bot: 'Merci de me le dire, ça demande du courage. Tu n\'es pas seul·e à ressentir ça. Un message à un proche, même court, peut déjà faire du bien. L\'espace d\'écoute campus propose aussi des créneaux confidentiels et gratuits si tu veux en parler à quelqu\'un.',
    },
    bien: {
      user: 'Ça va plutôt bien !',
      bot: 'Super nouvelle ! C\'est le bon moment pour noter ce qui contribue à cette bonne journée dans ton check-in — ça t\'aidera à repérer ce qui te fait du bien sur la durée.',
    },
  };

  function botReply(text) {
    const t = text.toLowerCase();
    if (/(stress|examen|partiel|révis)/.test(t)) return CHAT_TOPICS.stress.bot;
    if (/(dorm|sommeil|fatigu|insomn)/.test(t)) return CHAT_TOPICS.sommeil.bot;
    if (/(triste|seul|isolé|isole|déprim|deprim|mal)/.test(t)) return CHAT_TOPICS.triste.bot;
    if (/(bien|content|heureux|motiv|top)/.test(t)) return CHAT_TOPICS.bien.bot;
    return 'Merci de partager ça. Peux-tu m\'en dire un peu plus sur ce que tu ressens en ce moment ? Tu peux aussi utiliser les suggestions rapides ci-dessus si l\'une d\'elles correspond à ta situation.';
  }

  function scrollChatToBottom() {
    const el = document.getElementById('chat-messages');
    el.scrollTop = el.scrollHeight;
  }

  function renderChat(forceReseed) {
    let messages = loadChat();
    if (forceReseed || !messages.length) {
      messages = [{ sender: 'bot', text: 'Bonjour, je suis ton assistant de soutien MoodTracker. Comment te sens-tu aujourd\'hui ?', time: new Date().toISOString() }];
      saveChat(messages);
    }
    const el = document.getElementById('chat-messages');
    el.innerHTML = messages.map(m => `<div class="chat-bubble ${m.sender}">${m.text}</div>`).join('');
    scrollChatToBottom();
  }

  function pushChatMessages(entries) {
    const messages = loadChat();
    entries.forEach(e => messages.push({ ...e, time: new Date().toISOString() }));
    saveChat(messages);
    renderChat();
  }

  function initChat() {
    renderChat();

    document.getElementById('chat-send').addEventListener('click', sendFromInput);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendFromInput();
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const topic = CHAT_TOPICS[btn.dataset.topic];
        pushChatMessages([{ sender: 'user', text: topic.user }, { sender: 'bot', text: topic.bot }]);
      });
    });

    function sendFromInput() {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      pushChatMessages([{ sender: 'user', text }, { sender: 'bot', text: botReply(text) }]);
      input.value = '';
    }
  }

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCheckin();
    initChartControls();
    initFeedback();
    initHistory();
    initChat();
    renderChart();
    renderTips();
  });
})();
