let state = {
    user: localStorage.getItem('infinity_user') || null,
    tasks: JSON.parse(localStorage.getItem('infinity_tasks')) || [], 
    history: JSON.parse(localStorage.getItem('infinity_history')) || {}
};
let activeTimer = null; 
let timerInt = null;
let topicChart = null, velocityChart = null;

document.addEventListener('DOMContentLoaded', () => {
    if(state.user) enterApp();
    setInterval(updateClock, 1000);
    updateHeatmap();
});

// Mobile Sidebar Logic
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sb.classList.contains('open')) {
        sb.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        sb.classList.add('open');
        overlay.style.display = 'block';
    }
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {hour12:false});
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    
    const dashClock = document.getElementById('clock');
    if(dashClock) dashClock.innerText = timeStr;

    const zenClock = document.getElementById('zen-clock');
    if(zenClock) zenClock.innerText = timeStr;
    const zenDate = document.getElementById('zen-date');
    if(zenDate) zenDate.innerText = dateStr;
}

function toggleZenMode() {
    const zen = document.getElementById('view-zen');
    const app = document.getElementById('app-screen');
    
    if (zen.classList.contains('hidden')) {
        zen.classList.remove('hidden');
        app.classList.add('hidden');
        if(activeTimer) {
            const t = state.tasks.find(x => x.id === activeTimer);
            if(t) {
                document.getElementById('zen-active-container').classList.remove('hidden');
                document.getElementById('zen-task-name').innerText = t.text;
            }
        }
    } else {
        zen.classList.add('hidden');
        app.classList.remove('hidden');
    }
}

function toggleAudio() {
    document.getElementById('audio-container').classList.toggle('hidden');
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    if(u) {
        state.user = u;
        localStorage.setItem('infinity_user', u);
        enterApp();
    }
});

function enterApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('greeting').innerText = `Hello, ${state.user}`;
    renderTasks();
    updateStats();
}
function logout() { localStorage.removeItem('infinity_user'); location.reload(); }

function setView(id) {
    ['dashboard','scheduler','analytics'].forEach(v => document.getElementById('view-'+v).classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
    
    // Auto close sidebar on mobile
    if(window.innerWidth <= 768) toggleSidebar();
    
    if(id === 'analytics') renderAnalyticsCharts();
}

function addTask() {
    const txt = document.getElementById('task-text').value;
    const cat = document.getElementById('task-cat').value;
    const start = document.getElementById('task-start').value || "09:00";
    const end = document.getElementById('task-end').value || "10:00";
    if(!txt) return;

    const s = new Date(`1970-01-01T${start}:00`);
    const e = new Date(`1970-01-01T${end}:00`);
    const dur = (e - s) / 1000;

    state.tasks.push({
        id: Date.now(), text: txt, category: cat, start, end, 
        duration: dur > 0 ? dur : 3600, elapsed: 0, completed: false, date: new Date().toISOString().split('T')[0]
    });
    state.tasks.sort((a,b) => a.start.localeCompare(b.start));
    
    save();
    document.getElementById('task-text').value = '';
    renderTasks();
    updateStats();
}

function toggleTask(id) {
    const t = state.tasks.find(x => x.id === id);
    if(t) {
        t.completed = !t.completed;
        if(t.completed) {
            try { confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } }); } catch(e){}
        }
        updateHistory(t.date);
        save();
        renderTasks();
        updateStats();
    }
}

function deleteTask(id) {
    const t = state.tasks.find(x => x.id === id);
    state.tasks = state.tasks.filter(x => x.id !== id);
    if(activeTimer === id) stopTimer();
    if(t) updateHistory(t.date);
    save();
    renderTasks();
    updateStats();
}

function updateHistory(date) {
    const dayTasks = state.tasks.filter(t => t.date === date);
    const done = dayTasks.filter(t => t.completed).length;
    state.history[date] = { done, total: dayTasks.length };
}

function toggleTimer(id) {
    if(activeTimer === id) stopTimer();
    else {
        if(activeTimer) stopTimer();
        startTimer(id);
    }
}

function startTimer(id) {
    activeTimer = id;
    timerInt = setInterval(() => {
        const t = state.tasks.find(x => x.id === id);
        if(t) {
            t.elapsed++;
            
            const timerEl = document.getElementById(`time-${id}`);
            if(timerEl) timerEl.innerText = fmtTime(t.elapsed);
            
            const pct = Math.min((t.elapsed / t.duration) * 100, 100);
            const bar = document.getElementById(`prog-${id}`);
            const badge = document.getElementById(`pct-${id}`);
            if(bar) bar.style.width = `${pct}%`;
            if(badge) badge.innerText = `${Math.floor(pct)}%`;

            const zenTime = document.getElementById('zen-task-timer');
            if(zenTime && !document.getElementById('view-zen').classList.contains('hidden')) {
                zenTime.innerText = fmtTime(t.elapsed);
                document.getElementById('zen-active-container').classList.remove('hidden');
                document.getElementById('zen-task-name').innerText = t.text;
                document.getElementById('zen-task-pct').innerText = `${Math.floor(pct)}%`;
            }
        }
    }, 1000);
    renderTasks();
}

function stopTimer() {
    clearInterval(timerInt);
    activeTimer = null;
    document.getElementById('zen-active-container').classList.add('hidden');
    save();
    renderTasks();
}

function fmtTime(s) {
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sec = (s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
}

function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    state.tasks.forEach(t => {
        const isRunning = activeTimer === t.id;
        const pct = Math.min((t.elapsed / t.duration) * 100, 100);
        const catColors = { work: 'cat-work', study: 'cat-study', health: 'cat-health' };

        list.innerHTML += `
            <li class="task-item ${t.completed ? 'done' : ''} ${isRunning ? 'active-timer' : ''}">
                <div class="task-progress-bg" id="prog-${t.id}" style="width: ${pct}%"></div>
                <div class="task-content">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">
                            <span class="cat-badge ${catColors[t.category]}">${t.category}</span>
                            ${t.start} - ${t.end}
                        </div>
                        <div style="font-size:1.1rem; display:flex; align-items:center;">
                            ${t.text}
                            <span class="pct-badge" id="pct-${t.id}">${Math.floor(pct)}%</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="timer-badge ${isRunning ? 'running' : ''}" onclick="toggleTimer(${t.id})">
                            <i class="fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}"></i>
                            <span class="mono" id="time-${t.id}">${fmtTime(t.elapsed)}</span>
                        </div>
                        <button onclick="toggleTask(${t.id})" style="background:none; border:none; color:var(--neon-green); cursor:pointer;"><i class="fa-solid fa-check-circle"></i></button>
                        <button onclick="deleteTask(${t.id})" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </li>
        `;
    });
}

function updateStats() {
    const done = state.tasks.filter(t=>t.completed).length;
    const pct = state.tasks.length ? Math.round((done/state.tasks.length)*100) : 0;
    document.getElementById('daily-score').innerText = `${pct}%`;
}

function renderAnalyticsCharts() {
    const ctx1 = document.getElementById('topicChart').getContext('2d');
    if(topicChart) topicChart.destroy();
    topicChart = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: ['Work', 'Study', 'Health'],
            datasets: [{
                data: [
                    state.tasks.filter(t=>t.category==='work').length,
                    state.tasks.filter(t=>t.category==='study').length,
                    state.tasks.filter(t=>t.category==='health').length
                ],
                backgroundColor: ['#29b6f6', '#ab47bc', '#00e676']
            }]
        },
        options: { plugins: { legend: { labels: { color: 'white' } } }, maintainAspectRatio: false }
    });

    const ctx2 = document.getElementById('velocityChart').getContext('2d');
    if(velocityChart) velocityChart.destroy();
    const todayDone = state.tasks.filter(t=>t.completed).length;
    velocityChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Tasks Completed',
                data: [5, 8, 3, 9, 6, 4, todayDone],
                backgroundColor: '#ab47bc'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } },
            plugins: { legend: { display: false } }
        }
    });

    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const stats = state.history[dateStr] || { done: 0, total: 0 };
        const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
        
        let cls = pct >= 80 ? 'high' : (pct >= 50 ? 'med' : (pct > 0 ? 'low' : ''));
        grid.innerHTML += `<div class="cal-day ${cls}"><div class="cal-date">${d.getDate()}</div><div class="cal-pct">${pct}%</div></div>`;
    }
}

function generateSchedule(mode) {
    const templates = {
        student: [{text:"Math", cat:"study", s:"09:00", e:"11:00"}, {text:"Gym", cat:"health", s:"17:00", e:"18:00"}],
        dev: [{text:"Code", cat:"work", s:"10:00", e:"13:00"}, {text:"Walk", cat:"health", s:"15:00", e:"15:30"}],
        ceo: [{text:"Strategy", cat:"work", s:"08:00", e:"10:00"}, {text:"Reading", cat:"study", s:"20:00", e:"21:00"}]
    };
    const items = templates[mode];
    items.forEach(i => {
        const s = new Date(`1970-01-01T${i.s}:00`); const e = new Date(`1970-01-01T${i.e}:00`);
        const dur = (e - s) / 1000;
        state.tasks.push({
            id: Date.now()+Math.random(), text: i.text, category: i.cat, start: i.s, end: i.e,
            duration: dur > 0 ? dur : 3600, elapsed: 0, completed: false, date: new Date().toISOString().split('T')[0]
        });
    });
    state.tasks.sort((a,b) => a.start.localeCompare(b.start));
    save(); renderTasks(); updateStats(); setView('dashboard');
}

function save() { 
    localStorage.setItem('infinity_tasks', JSON.stringify(state.tasks));
    localStorage.setItem('infinity_history', JSON.stringify(state.history));
}
