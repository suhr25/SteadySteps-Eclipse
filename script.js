let state = {
    user: localStorage.getItem('ethereal_user') || null,
    tasks: JSON.parse(localStorage.getItem('ethereal_tasks')) || [], 
    history: JSON.parse(localStorage.getItem('ethereal_history')) || {}
};
let activeTimer = null; 
let timerInt = null;
let topicChart = null, velocityChart = null;

document.addEventListener('DOMContentLoaded', () => {
    if(state.user) enterApp();
    setInterval(updateClock, 1000);
    updateHeatmap();
});

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('mobile-overlay');
    if (sb.classList.contains('open')) {
        sb.classList.remove('open');
        ov.style.display = 'none';
    } else {
        sb.classList.add('open');
        ov.style.display = 'block';
    }
}

function updateClock() {
    const now = new Date();
    const t = now.toLocaleTimeString('en-US', {hour12:false});
    const d = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    
    const dashClock = document.getElementById('clock');
    if(dashClock) dashClock.innerText = t;

    const zenClock = document.getElementById('zen-clock');
    if(zenClock) zenClock.innerText = t;
    const zenDate = document.getElementById('zen-date');
    if(zenDate) zenDate.innerText = d;
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

function toggleAudio(checkbox) {
    const container = document.getElementById('audio-container');
    const visualizer = document.getElementById('audio-visuals');
    if (checkbox.checked) {
        container.classList.remove('hidden');
        visualizer.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        visualizer.classList.add('hidden');
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    if(u) {
        state.user = u;
        localStorage.setItem('ethereal_user', u);
        enterApp();
    }
});

function enterApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('greeting').innerText = `Welcome, ${state.user}`;
    renderTasks();
    updateStats();
}
function logout() { localStorage.removeItem('ethereal_user'); location.reload(); }

function setView(id) {
    ['dashboard','scheduler','analytics'].forEach(v => document.getElementById('view-'+v).classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
    
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
        if(t.completed) try { confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } }); } catch(e){}
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
            
            const zenTime = document.getElementById('zen-task-timer');
            if(zenTime && !document.getElementById('view-zen').classList.contains('hidden')) {
                zenTime.innerText = fmtTime(t.elapsed);
                document.getElementById('zen-active-container').classList.remove('hidden');
                document.getElementById('zen-task-name').innerText = t.text;
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
    const pendingCount = state.tasks.filter(t => !t.completed).length;
    document.getElementById('pending-count').innerText = `${pendingCount} Objectives`;

    state.tasks.forEach(t => {
        const isRunning = activeTimer === t.id;
        const icon = isRunning ? 'fa-pause' : 'fa-play';
        const activeClass = isRunning ? 'active-timer' : '';
        const pct = Math.min((t.elapsed / t.duration) * 100, 100);

        list.innerHTML += `
            <li class="task-item ${t.completed ? 'done' : ''} ${activeClass}">
                <div class="task-meta">
                    <div class="task-title">${t.text}</div>
                    <div class="meta-row">
                        <span class="cat-tag ${t.category}">${t.category}</span>
                        <span>${t.start} - ${t.end}</span>
                        <span style="color:var(--neon-blue)">${Math.floor(pct)}%</span>
                    </div>
                </div>
                <div class="task-controls">
                    <div class="ctrl-btn play ${isRunning ? 'active' : ''}" onclick="toggleTimer(${t.id})">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="ctrl-btn check" onclick="toggleTask(${t.id})">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="ctrl-btn del" onclick="deleteTask(${t.id})">
                        <i class="fa-solid fa-trash"></i>
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
    const offset = 339.292 - (339.292 * pct) / 100;
    document.getElementById('daily-ring').style.strokeDashoffset = offset;
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
                backgroundColor: ['#00f3ff', '#bc13fe', '#0aff68']
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
                label: 'Tasks',
                data: [5, 8, 3, 9, 6, 4, todayDone],
                backgroundColor: '#bc13fe'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { ticks: { color: '#8b9bb4' } }, x: { ticks: { color: '#8b9bb4' } } },
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
        const val = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
        
        let lvl = val >= 80 ? 'lvl-3' : (val >= 50 ? 'lvl-2' : (val > 0 ? 'lvl-1' : ''));
        grid.innerHTML += `<div class="cal-day ${lvl}"><div class="date">${d.getDate()}</div><div class="val">${val}%</div></div>`;
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
    localStorage.setItem('ethereal_tasks', JSON.stringify(state.tasks));
    localStorage.setItem('ethereal_history', JSON.stringify(state.history));
}
